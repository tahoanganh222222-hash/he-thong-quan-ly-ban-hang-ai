import sys
import unittest
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.models import (
    ActivityLog, Base, Category, Customer, Inventory, Invoice, InvoiceDetail,
    Product, PurchaseReceipt, PurchaseReceiptDetail, User,
)
from seed_demo import (
    LEGACY_CUSTOMER_CODES, LEGACY_INVOICE_CODES, LEGACY_PRODUCT_CODES,
    LEGACY_RECEIPT_CODES, refresh_seed_catalog, seed_demo_data,
)


class DemoSeedTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, _record):
            connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(User(username="test-admin", password_hash="test-only", full_name="Admin", role="admin", is_active=True))
        self.db.commit()
        self.reference_date = date(2026, 10, 28)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def snapshot(self):
        return {
            table.name: [tuple(row) for row in self.db.execute(select(table).order_by(table.c.id))]
            for table in Base.metadata.sorted_tables
        }

    def seed(self, reference_date=None):
        added = seed_demo_data(self.db, reference_date or self.reference_date)
        self.db.commit()
        return added

    def test_creates_balanced_transactions_and_stock_scenarios(self):
        added = self.seed()
        self.assertEqual(added, dict(categories=2, products=6, customers=2, inventories=6, purchases=4, invoices=10, activity_logs=28))
        for product in self.db.query(Product).all():
            purchased = self.db.query(func.sum(PurchaseReceiptDetail.quantity)).filter_by(product_id=product.id).scalar() or 0
            sold = self.db.query(func.sum(InvoiceDetail.quantity)).filter_by(product_id=product.id).scalar() or 0
            inventory = self.db.query(Inventory).filter_by(product_id=product.id).one()
            self.assertEqual(inventory.quantity, purchased - sold)
            self.assertGreaterEqual(inventory.quantity, 0)
        for invoice in self.db.query(Invoice).all():
            details = self.db.query(InvoiceDetail).filter_by(invoice_id=invoice.id).all()
            self.assertEqual(invoice.total_amount, sum((row.amount for row in details), Decimal("0")))
            self.assertEqual(invoice.final_amount, invoice.total_amount - invoice.discount)
            for row in details:
                self.assertEqual(row.amount, row.unit_price * row.quantity)
        for receipt in self.db.query(PurchaseReceipt).all():
            details = self.db.query(PurchaseReceiptDetail).filter_by(receipt_id=receipt.id).all()
            self.assertEqual(receipt.total_amount, sum((row.amount for row in details), Decimal("0")))
        stock = {product.code: inventory.quantity for product, inventory in self.db.query(Product, Inventory).join(Inventory, Inventory.product_id == Product.id)}
        self.assertEqual(stock['SP021'], 3)
        self.assertEqual(stock['SP022'], 0)
        self.assertFalse(self.db.query(Product).filter_by(code='SP023').one().is_active)
        for product in self.db.query(Product).all():
            self.assertTrue(product.image_data.startswith(("data:image/png;base64,", "data:image/jpeg;base64,")))
            self.assertNotIn("DEMO", product.name)
            self.assertNotIn("DEMO", product.code)
        today_invoices = [row for row in self.db.query(Invoice).all() if row.created_at.date() == self.reference_date]
        self.assertEqual(len(today_invoices), 2)
        self.assertEqual(sum((row.final_amount for row in today_invoices), Decimal("0")), Decimal("188000"))

    def test_rerun_does_not_duplicate_or_reset_edited_demo_data(self):
        self.seed()
        self.db.query(Product).filter_by(code="SP018").one().selling_price = Decimal("12000")
        inventory = self.db.query(Inventory).join(Product, Product.id == Inventory.product_id).filter(Product.code == "SP018").one()
        inventory.quantity = 9
        self.db.commit()
        before = self.snapshot()
        added = self.seed(self.reference_date + timedelta(days=3))
        self.assertTrue(all(value == 0 for value in added.values()))
        self.assertEqual(self.snapshot(), before)

    def test_existing_non_demo_records_are_unchanged(self):
        category = Category(name="Existing category", is_active=True)
        customer = Customer(code="KH001", name="Existing customer", customer_group="Khách VIP", is_active=True)
        self.db.add_all([category, customer])
        self.db.flush()
        product = Product(code="SP001", name="Existing product", category_id=category.id, purchase_price=123, selling_price=456, unit="Cái", is_active=True)
        self.db.add(product)
        self.db.flush()
        self.db.add(Inventory(product_id=product.id, quantity=77, min_quantity=11))
        self.db.commit()
        before = self.snapshot()
        self.seed()
        after = self.snapshot()
        for table_name, rows in before.items():
            after_by_id = {row[0]: row for row in after[table_name]}
            for row in rows:
                self.assertEqual(after_by_id[row[0]], row)

    def test_missing_admin_fails_without_creating_demo_data(self):
        self.db.query(User).one().is_active = False
        self.db.commit()
        before = self.snapshot()
        with self.assertRaises(ValueError):
            seed_demo_data(self.db, self.reference_date)
        self.db.rollback()
        self.assertEqual(self.snapshot(), before)

    def test_error_rolls_back_the_entire_batch(self):
        category = Category(name="Existing", is_active=True)
        self.db.add(category)
        self.db.flush()
        self.db.add(Product(code="SP018", name="Inactive sample product", category_id=category.id, purchase_price=6000, selling_price=10000, unit="Chai", is_active=False))
        self.db.commit()
        before = self.snapshot()
        with self.assertRaises(ValueError):
            seed_demo_data(self.db, self.reference_date)
        self.db.rollback()
        self.assertEqual(self.snapshot(), before)

    def test_migrates_legacy_labels_without_new_transactions(self):
        self.seed()
        original_stock = {row.id: row.quantity for row in self.db.query(Inventory).all()}
        original_invoices = {row.id: (row.total_amount, row.final_amount, row.created_at) for row in self.db.query(Invoice).all()}
        original_details = self.snapshot()["InvoiceDetails"]
        for old_code, new_code in LEGACY_PRODUCT_CODES.items():
            product = self.db.query(Product).filter_by(code=new_code).one()
            product.code = old_code
            product.name += " (DEMO)"
            product.image_data = None
        for old_code, new_code in LEGACY_CUSTOMER_CODES.items():
            customer = self.db.query(Customer).filter_by(code=new_code).one()
            customer.code = old_code
            customer.name = "Khách mẫu DEMO"
        for old_code, new_code in LEGACY_RECEIPT_CODES.items():
            receipt = self.db.query(PurchaseReceipt).filter_by(receipt_code=new_code).one()
            receipt.receipt_code = old_code
            receipt.supplier_name = "Nhà cung cấp mẫu DEMO"
        for old_code, new_code in LEGACY_INVOICE_CODES.items():
            self.db.query(Invoice).filter_by(invoice_code=new_code).one().invoice_code = old_code
        category_names = {"Sữa và đồ uống": "Đồ uống (DEMO)", "Hàng tiêu dùng": "Hàng tiêu dùng (DEMO)"}
        for category in self.db.query(Category).all():
            category.name = category_names[category.name]
        reverse_codes = {new: old for old, new in {**LEGACY_INVOICE_CODES, **LEGACY_RECEIPT_CODES}.items()}
        for log in self.db.query(ActivityLog).all():
            log.object_code = reverse_codes[log.object_code]
            log.detail = "[Dữ liệu mẫu DEMO] " + log.detail
            for new_code, old_code in reverse_codes.items():
                log.detail = log.detail.replace(new_code, old_code)
        self.db.commit()
        self.assertTrue(all(value == 0 for value in self.seed().values()))
        self.assertEqual({row.id: row.quantity for row in self.db.query(Inventory).all()}, original_stock)
        self.assertEqual({row.id: (row.total_amount, row.final_amount, row.created_at) for row in self.db.query(Invoice).all()}, original_invoices)
        self.assertEqual(self.snapshot()["InvoiceDetails"], original_details)
        for table in (Product, Category, Customer, PurchaseReceipt, Invoice, ActivityLog):
            for record in self.db.query(table).all():
                for field in ("name", "code", "receipt_code", "invoice_code", "supplier_name", "object_code", "detail"):
                    self.assertNotIn("DEMO", getattr(record, field, "") or "")
        before = self.snapshot()
        refresh_seed_catalog(self.db)
        self.db.commit()
        self.assertEqual(self.snapshot(), before)

    def test_legacy_code_collision_rolls_back_without_overwrite(self):
        self.seed()
        original = self.db.query(Product).filter_by(code="SP018").one()
        self.db.add(Product(code="DEMO-SP001", name="Legacy tea (DEMO)", category_id=original.category_id, purchase_price=6000, selling_price=10000, unit="Chai", is_active=True))
        self.db.commit()
        before = self.snapshot()
        with self.assertRaises(ValueError):
            refresh_seed_catalog(self.db)
        self.db.rollback()
        self.assertEqual(self.snapshot(), before)


if __name__ == "__main__":
    unittest.main()
