import unittest

from sqlalchemy.orm import Session

import test_sales_permissions as permission_tests
from app.models import ActivityLog, Category, Customer, Inventory, Invoice, InvoiceDetail, Product, PurchaseReceipt
from app.routers.ai import _sales_snapshot


class StockDocumentTests(unittest.TestCase):
    setUp = permission_tests.SalesPermissionTests.setUp
    tearDown = permission_tests.SalesPermissionTests.tearDown
    request = permission_tests.SalesPermissionTests.request

    def quantity(self):
        with Session(self.engine) as db:
            return db.query(Inventory).filter_by(product_id=self.product_id).one().quantity

    def invoice(self, quantity=5, **values):
        status, result = self.request("POST", "/api/invoices", "admin", {
            "items": [{"productId": self.product_id, "quantity": quantity}], **values,
        })
        self.assertEqual(status, 201, result)
        return result

    def test_quantity_is_read_only_in_all_direct_api_paths(self):
        with Session(self.engine) as db:
            inventory_id = db.query(Inventory).one().id
        path = f"/api/inventory/{inventory_id}"
        for body in ({"quantity": 99}, {"quantity": 99, "minimum": 2}):
            self.assertEqual(self.request("PUT", path, "admin", body)[0], 422)
        self.assertEqual(self.quantity(), 12)
        self.assertEqual(self.request("PUT", path, "admin", {"minimum": 5})[0], 200)
        self.assertEqual(self.quantity(), 12)
        self.assertEqual(self.request("DELETE", path, "admin")[0], 405)
        self.assertEqual(self.request("POST", "/api/inventory", "admin", {
            "productId": self.product_id, "quantity": 99,
        })[0], 422)
        self.assertEqual(self.request("POST", "/api/products", "admin", {
            "code": "BYPASS", "name": "Bypass", "category": "Test", "unit": "Cái",
            "purchasePrice": 10, "sellingPrice": 20, "stock": 99,
        })[0], 422)

    def test_invoice_edit_then_cancel_returns_stock_once_and_keeps_details(self):
        invoice = self.invoice()
        self.assertEqual(self.quantity(), 7)
        path = f'/api/invoices/{invoice["id"]}'
        status, edited = self.request("PUT", path, "admin", {
            "items": [{"productId": self.product_id, "quantity": 3, "unitPrice": 200}],
        })
        self.assertEqual(status, 200, edited)
        self.assertEqual(self.quantity(), 9)
        self.assertEqual(edited["finalAmount"], 600)
        status, cancelled = self.request("POST", path + "/cancel", "admin", {"reason": "  Khách đặt nhầm  "})
        self.assertEqual(status, 200, cancelled)
        self.assertEqual(cancelled["status"], "cancelled")
        self.assertEqual(cancelled["cancellationReason"], "Khách đặt nhầm")
        self.assertIsNotNone(cancelled["cancelledAt"])
        self.assertIsNotNone(cancelled["cancelledBy"])
        self.assertEqual(len(cancelled["items"]), 1)
        self.assertEqual(self.quantity(), 12)
        self.assertEqual(self.request("POST", path + "/cancel", "admin", {"reason": "Hủy lần hai"})[0], 409)
        self.assertEqual(self.request("PUT", path, "admin", {"discount": 2})[0], 409)
        self.assertEqual(self.request("DELETE", path, "admin")[0], 405)
        self.assertEqual(self.quantity(), 12)
        with Session(self.engine) as db:
            self.assertEqual(db.query(InvoiceDetail).count(), 1)
            self.assertEqual(db.query(ActivityLog).filter_by(action_type="cancel").count(), 1)

    def test_purchase_edit_and_cancel_adjust_stock_and_keep_history(self):
        path = f"/api/purchases/{self.receipt_id}"
        status, result = self.request("PUT", path, "admin", {
            "items": [{"productId": self.product_id, "quantity": 5}],
        })
        self.assertEqual(status, 200, result)
        self.assertEqual(self.quantity(), 15)
        status, result = self.request("POST", path + "/cancel", "admin", {"reason": "Nhập sai chứng từ"})
        self.assertEqual(status, 200, result)
        self.assertEqual(result["status"], "cancelled")
        self.assertEqual(result["items"][0]["quantity"], 5)
        self.assertEqual(self.quantity(), 10)
        self.assertEqual(self.request("POST", path + "/cancel", "admin", {"reason": "Hủy lần hai"})[0], 409)
        self.assertEqual(self.request("PUT", path, "admin", {"supplierName": "Other"})[0], 409)
        self.assertEqual(self.request("DELETE", path, "admin")[0], 405)
        self.assertEqual(self.request("GET", "/api/purchases/items", "admin")[1][0]["status"], "cancelled")
        self.assertEqual(self.quantity(), 10)

    def test_insufficient_stock_blocks_purchase_cancellation_atomically(self):
        with Session(self.engine) as db:
            db.query(Inventory).one().quantity = 1
            db.commit()
        path = f"/api/purchases/{self.receipt_id}"
        self.assertEqual(self.request("POST", path + "/cancel", "admin", {"reason": "Hủy phiếu nhập"})[0], 409)
        self.assertEqual(self.quantity(), 1)
        with Session(self.engine) as db:
            self.assertEqual(db.get(PurchaseReceipt, self.receipt_id).status, "completed")
            self.assertEqual(db.query(ActivityLog).count(), 1)

    def test_purchase_price_only_edit_does_not_require_original_quantity_in_stock(self):
        with Session(self.engine) as db:
            db.query(Inventory).one().quantity = 1
            db.commit()
        path = f"/api/purchases/{self.receipt_id}"
        status, result = self.request("PUT", path, "admin", {
            "items": [{"productId": self.product_id, "quantity": 2, "unitPrice": 120}],
        })
        self.assertEqual(status, 200, result)
        self.assertEqual(self.quantity(), 1)
        self.assertEqual(result["totalAmount"], 240)
        status, result = self.request("PUT", path, "admin", {
            "items": [{"productId": self.product_id, "quantity": 1, "unitPrice": 120}],
        })
        self.assertEqual(status, 200, result)
        self.assertEqual(self.quantity(), 0)

    def test_rejected_invoice_edit_preserves_document_and_inventory(self):
        invoice = self.invoice()
        path = f'/api/invoices/{invoice["id"]}'
        status, _ = self.request("PUT", path, "admin", {
            "discount": 100, "items": [{"productId": self.product_id, "quantity": 20}],
        })
        self.assertEqual(status, 409)
        self.assertEqual(self.quantity(), 7)
        result = self.request("GET", path, "admin")[1]
        self.assertEqual(result["discount"], 0)
        self.assertEqual(result["items"][0]["quantity"], 5)

    def test_multi_product_failure_rolls_back_all_changes(self):
        with Session(self.engine) as db:
            product = Product(code="SECOND", name="Second", category_id=db.query(Category).one().id,
                              purchase_price=10, selling_price=20, unit="Cái", is_active=True)
            db.add(product); db.flush()
            db.add(Inventory(product_id=product.id, quantity=1, min_quantity=0))
            db.commit(); second_id = product.id
        status, _ = self.request("POST", "/api/invoices", "admin", {"items": [
            {"productId": self.product_id, "quantity": 3}, {"productId": second_id, "quantity": 5},
        ]})
        self.assertEqual(status, 409)
        self.assertEqual(self.quantity(), 12)
        with Session(self.engine) as db:
            self.assertEqual(db.query(Invoice).count(), 0)
            self.assertEqual(db.query(ActivityLog).count(), 1)
            self.assertEqual(db.query(Inventory).filter_by(product_id=second_id).one().quantity, 1)

    def test_duplicate_products_empty_items_and_blank_reason_are_rejected(self):
        status, _ = self.request("POST", "/api/invoices", "admin", {"items": [
            {"productId": self.product_id, "quantity": 1}, {"productId": self.product_id, "quantity": 1},
        ]})
        self.assertEqual(status, 400)
        invoice = self.invoice(1)
        path = f'/api/invoices/{invoice["id"]}'
        self.assertEqual(self.request("PUT", path, "admin", {"items": []})[0], 422)
        for reason in (" ", "ab", "a" * 501):
            self.assertEqual(self.request("POST", path + "/cancel", "admin", {"reason": reason})[0], 422)
        self.assertEqual(self.quantity(), 11)

    def test_cancelled_sales_are_excluded_from_ai_and_customer_totals(self):
        with Session(self.engine) as db:
            customer = Customer(code="C", name="Customer", is_active=True)
            db.add(customer); db.commit(); customer_id = customer.id
        invoice = self.invoice(3, customerId=customer_id)
        path = f'/api/invoices/{invoice["id"]}'
        with Session(self.engine) as db:
            self.assertEqual(_sales_snapshot(db)["total_revenue"], 450)
        self.request("POST", path + "/cancel", "admin", {"reason": "Khách hủy đơn"})
        with Session(self.engine) as db:
            snapshot = _sales_snapshot(db)
            self.assertEqual(snapshot["total_revenue"], 0)
            self.assertEqual(snapshot["total_invoices"], 0)
            self.assertEqual(snapshot["top_products"], [])
        history = self.request("GET", f"/api/customers/{customer_id}/purchase-history", "admin")[1]
        summary = history["summary"]
        self.assertEqual(summary["totalSpent"], 0)
        self.assertEqual(summary["totalItems"], 0)
        self.assertEqual(history["invoices"][0]["status"], "cancelled")
        self.assertEqual(self.request("DELETE", f"/api/customers/{customer_id}", "admin")[0], 409)
        self.assertEqual(self.request("GET", path, "admin")[1]["status"], "cancelled")

    def test_edit_and_cancel_obey_existing_permissions(self):
        invoice = self.invoice(1)
        for method, path, body in [
            ("POST", f'/api/invoices/{invoice["id"]}/cancel', {"reason": "Khách hủy đơn"}),
            ("PUT", f'/api/invoices/{invoice["id"]}', {"discount": 0}),
            ("POST", f"/api/purchases/{self.receipt_id}/cancel", {"reason": "Nhập sai đơn"}),
            ("PUT", f"/api/purchases/{self.receipt_id}", {"supplierName": "Other"}),
        ]:
            self.assertEqual(self.request(method, path, "customer", body)[0], 403)
        self.assertEqual(self.quantity(), 11)


if __name__ == "__main__":
    unittest.main()
