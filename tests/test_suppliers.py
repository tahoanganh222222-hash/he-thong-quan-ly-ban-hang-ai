import sys
import unittest
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.models import Base, Category, Inventory, Product, PurchaseReceipt, Supplier, User
from app.schemas.sales import PurchaseCreate, SupplierCreate, SupplierUpdate
from app.routers.sales import create_purchase, create_supplier, list_suppliers, update_supplier
from app.services.suppliers import import_historical_suppliers
from app.dependencies.auth import require_permission


class SupplierTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(username="supplier-test", full_name="Admin", password_hash="test-only", role="admin", is_active=True)
        category = Category(name="Test", is_active=True)
        self.db.add_all([self.user, category])
        self.db.flush()
        self.product = Product(code="TEST", name="Test", category_id=category.id, purchase_price=100, selling_price=120, unit="Cái", is_active=True)
        self.db.add(self.product)
        self.db.flush()
        self.stock = Inventory(product_id=self.product.id, quantity=0, min_quantity=1)
        self.db.add(self.stock)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_supplier(self, name="Nhà cung cấp Ánh Dương"):
        return create_supplier(SupplierCreate(name=name), db=self.db, current_user=self.user)

    def purchase(self, **values):
        return create_purchase(PurchaseCreate(items=[{"productId": self.product.id, "quantity": 2}], **values), db=self.db, current_user=self.user)

    def test_saves_unicode_and_rejects_duplicate_names(self):
        supplier = self.add_supplier("  Nhà cung cấp Ánh Dương  ")
        self.assertEqual(supplier["name"], "Nhà cung cấp Ánh Dương")
        self.assertEqual(len(list_suppliers(db=self.db, current_user=self.user)), 1)
        with self.assertRaises(HTTPException) as error:
            self.add_supplier("nhà cung cấp ánh dương")
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.query(Supplier).count(), 1)

    def test_rejects_blank_name_and_invalid_email(self):
        for values in ({"name": "   "}, {"name": "A", "email": "not-an-email"}, {"name": "A" * 151}):
            with self.assertRaises(ValidationError):
                SupplierCreate(**values)

    def test_import_is_idempotent_and_does_not_change_receipts(self):
        self.db.add_all([PurchaseReceipt(receipt_code="OLD1", user_id=self.user.id, supplier_name=" Minh Long ", total_amount=100),
                         PurchaseReceipt(receipt_code="OLD2", user_id=self.user.id, supplier_name="minh long", total_amount=200)])
        self.db.commit()
        before = [(r.id, r.supplier_name, r.total_amount) for r in self.db.query(PurchaseReceipt).all()]
        import_historical_suppliers(self.db)
        import_historical_suppliers(self.db)
        self.assertEqual(self.db.query(Supplier).count(), 1)
        self.assertEqual(before, [(r.id, r.supplier_name, r.total_amount) for r in self.db.query(PurchaseReceipt).all()])

    def test_supplier_id_uses_server_name_and_updates_inventory(self):
        supplier = self.add_supplier()
        self.purchase(supplierId=supplier["id"], supplierName="Tên giả từ client")
        receipt = self.db.query(PurchaseReceipt).one()
        self.assertEqual(receipt.supplier_name, supplier["name"])
        self.assertEqual(self.stock.quantity, 2)
        self.assertEqual(receipt.total_amount, 200)

    def test_invalid_or_inactive_supplier_never_changes_stock(self):
        supplier = self.add_supplier()
        self.db.get(Supplier, supplier["id"]).is_active = False
        self.db.commit()
        for supplier_id, expected in ((9999, 404), (supplier["id"], 400)):
            with self.assertRaises(HTTPException) as error:
                self.purchase(supplierId=supplier_id)
            self.assertEqual(error.exception.status_code, expected)
        self.assertEqual(self.db.query(PurchaseReceipt).count(), 0)
        self.assertEqual(self.stock.quantity, 0)

    def test_legacy_clients_and_missing_selection(self):
        with self.assertRaises(HTTPException) as error:
            self.purchase(supplierName=" ")
        self.assertEqual(error.exception.status_code, 422)
        self.purchase(supplierName="Nhà cung cấp cũ")
        self.assertEqual(self.db.query(PurchaseReceipt).one().supplier_name, "Nhà cung cấp cũ")

    def test_supplier_permission_is_purchase_permission(self):
        checker = require_permission("purchase_track")
        self.assertEqual(checker(current_user=self.user, db=self.db), self.user)
        self.user.role = "customer"
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            checker(current_user=self.user, db=self.db)
        self.assertEqual(error.exception.status_code, 403)

    def test_rename_preserves_old_receipt_and_does_not_reimport_old_name(self):
        self.db.add(PurchaseReceipt(receipt_code="OLD", user_id=self.user.id, supplier_name="Minh Long", total_amount=100))
        self.db.commit()
        import_historical_suppliers(self.db)
        supplier = self.db.query(Supplier).one()
        update_supplier(supplier.id, SupplierUpdate(name="Minh Long mới", phone="123"), db=self.db, current_user=self.user)
        import_historical_suppliers(self.db)
        self.assertEqual(self.db.query(Supplier).count(), 1)
        self.assertEqual(self.db.query(PurchaseReceipt).one().supplier_name, "Minh Long")

    def test_lock_blocks_ids_and_legacy_names_until_unlocked(self):
        supplier = self.add_supplier()
        update_supplier(supplier["id"], SupplierUpdate(isActive=False), db=self.db, current_user=self.user)
        for values in ({"supplierId": supplier["id"]}, {"supplierName": supplier["name"]}):
            with self.assertRaises(HTTPException) as error:
                self.purchase(**values)
            self.assertEqual(error.exception.status_code, 400)
        update_supplier(supplier["id"], SupplierUpdate(isActive=True), db=self.db, current_user=self.user)
        self.purchase(supplierId=supplier["id"])
        self.assertEqual(self.stock.quantity, 2)

    def test_update_rejects_duplicate_and_blank_names(self):
        first = self.add_supplier("A")
        self.add_supplier("B")
        with self.assertRaises(HTTPException) as error:
            update_supplier(first["id"], SupplierUpdate(name=" b "), db=self.db, current_user=self.user)
        self.assertEqual(error.exception.status_code, 409)
        for name in (None, "  "):
            with self.assertRaises(ValidationError):
                SupplierUpdate(name=name)


if __name__ == "__main__":
    unittest.main()
