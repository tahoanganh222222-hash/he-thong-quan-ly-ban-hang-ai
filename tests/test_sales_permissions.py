import asyncio
import json
import sys
import unittest
from pathlib import Path

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models import (
    ActivityLog, Base, Category, Inventory, Product, PurchaseReceipt,
    PurchaseReceiptDetail, RolePermission, User,
)
from app.routers.sales import router
from app.routers.auth import router as auth_router


class SalesPermissionTests(unittest.TestCase):
    """Exercise HTTP routing and real permission dependencies using only SQLite memory."""

    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.include_router(auth_router)

        def fixture_db():
            with Session(self.engine) as db:
                yield db

        self.app.dependency_overrides[get_db] = fixture_db
        with Session(self.engine) as db:
            users = {
                role: User(username=role, full_name=role, password_hash="test-only",
                           role=role, is_active=True)
                for role in ("admin", "owner", "staff", "customer")
            }
            category = Category(name="Test", is_active=True)
            db.add_all([*users.values(), category])
            db.flush()
            product = Product(code="TEST", name="Test", category_id=category.id,
                              purchase_price=100, selling_price=150, unit="Cái", is_active=True)
            db.add(product)
            db.flush()
            db.add(Inventory(product_id=product.id, quantity=12, min_quantity=3))
            receipt = PurchaseReceipt(receipt_code="PN-TEST", user_id=users["admin"].id,
                                      supplier_name="Test supplier", total_amount=200)
            db.add(receipt)
            db.flush()
            db.add(PurchaseReceiptDetail(receipt_id=receipt.id, product_id=product.id,
                                        quantity=2, unit_price=100, amount=200))
            db.add(ActivityLog(user_id=users["admin"].id, action="Test", action_type="add",
                               object_type="Phiếu nhập", object_code=receipt.receipt_code, detail="Test"))
            for role, keys in {
                "customer": ("login", "ai_product_advice"),
                "staff": ("login", "history_view", "invoice_create"),
                "owner": ("login", "purchase_track"),
            }.items():
                db.add_all(RolePermission(role=role, permission_key=key, allowed=True) for key in keys)
            db.commit()
            self.product_id = product.id
            self.receipt_id = receipt.id
            self.tokens = {
                role: create_access_token(user.id, user.username, user.role)
                for role, user in users.items()
            }

    def tearDown(self):
        self.engine.dispose()

    def set_permission(self, role, key, allowed):
        with Session(self.engine) as db:
            row = db.query(RolePermission).filter_by(role=role, permission_key=key).first()
            if row is None:
                row = RolePermission(role=role, permission_key=key)
                db.add(row)
            row.allowed = allowed
            db.commit()

    def request(self, method, path, role=None, body=None):
        async def run():
            messages = []
            headers = [(b"content-type", b"application/json")]
            if role:
                headers.append((b"authorization", ("Bearer " + self.tokens[role]).encode()))
            scope = {
                "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
                "method": method, "scheme": "http", "path": path, "raw_path": path.encode(),
                "query_string": b"", "root_path": "", "headers": headers,
                "client": ("127.0.0.1", 1), "server": ("test", 80),
            }

            async def receive():
                return {"type": "http.request", "body": json.dumps(body or {}).encode(), "more_body": False}

            async def send(message):
                messages.append(message)

            await self.app(scope, receive, send)
            status = next(m["status"] for m in messages if m["type"] == "http.response.start")
            payload = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
            return status, json.loads(payload)

        return asyncio.run(run())

    def purchase_paths(self):
        return ("/api/purchases", "/api/purchases/items", f"/api/purchases/{self.receipt_id}")

    def test_customer_product_list_and_detail_omit_cost_but_keep_sales_data(self):
        for path in ("/api/products", f"/api/products/{self.product_id}"):
            with self.subTest(path=path):
                status, payload = self.request("GET", path, "customer")
                self.assertEqual(status, 200)
                items = payload if isinstance(payload, list) else [payload]
                self.assertTrue(items)
                for item in items:
                    self.assertNotIn("purchasePrice", item)
                    self.assertEqual(item["sellingPrice"], 150)
                    self.assertEqual(item["stock"], 12)
                    self.assertEqual(item["minimum"], 3)

    def test_internal_roles_still_receive_product_cost(self):
        for role in ("admin", "owner", "staff"):
            for path in ("/api/products", f"/api/products/{self.product_id}"):
                with self.subTest(role=role, path=path):
                    status, payload = self.request("GET", path, role)
                    self.assertEqual(status, 200)
                    item = payload[0] if isinstance(payload, list) else payload
                    self.assertEqual(item["purchasePrice"], 100)

    def test_customer_write_responses_also_omit_cost_if_management_is_granted(self):
        self.set_permission("customer", "product_manage", True)
        status, created = self.request("POST", "/api/products", "customer", {
            "code": "NEW", "name": "New", "category": "Test",
            "purchasePrice": 200, "sellingPrice": 250, "unit": "Cái",
        })
        self.assertEqual(status, 201)
        self.assertNotIn("purchasePrice", created)
        status, updated = self.request("PUT", f'/api/products/{created["id"]}', "customer", {"purchasePrice": 210})
        self.assertEqual(status, 200)
        self.assertNotIn("purchasePrice", updated)
        with Session(self.engine) as db:
            self.assertEqual(db.get(Product, created["id"]).purchase_price, 210)

    def test_history_permission_does_not_allow_any_purchase_read(self):
        # Remove other business permissions to isolate history_view itself.
        self.set_permission("staff", "invoice_create", False)
        status, history = self.request("GET", "/api/history", "staff")
        self.assertEqual(status, 200)
        self.assertEqual(len(history), 1)
        for path in self.purchase_paths():
            with self.subTest(path=path):
                self.assertEqual(self.request("GET", path, "staff")[0], 403)

    def test_customer_cannot_read_purchase_documents(self):
        for path in self.purchase_paths():
            with self.subTest(path=path):
                self.assertEqual(self.request("GET", path, "customer")[0], 403)

    def test_purchase_permission_allows_reads_and_revocation_is_immediate(self):
        for path in self.purchase_paths():
            self.assertEqual(self.request("GET", path, "owner")[0], 200)
        self.set_permission("owner", "purchase_track", False)
        for path in self.purchase_paths():
            self.assertEqual(self.request("GET", path, "owner")[0], 403)

    def test_report_permission_keeps_read_access_without_purchase_write_access(self):
        self.set_permission("staff", "report_export", True)
        for path in self.purchase_paths():
            self.assertEqual(self.request("GET", path, "staff")[0], 200)
        self.assertEqual(self.request("POST", "/api/purchases", "staff", {})[0], 403)

    def test_admin_and_anonymous_access(self):
        for path in self.purchase_paths():
            self.assertEqual(self.request("GET", path, "admin")[0], 200)
            self.assertEqual(self.request("GET", path)[0], 403)

    def role_permissions(self, role):
        return self.request("GET", "/api/auth/permissions", "admin")[1][role]

    def test_session_exposes_current_role_permissions_without_private_auth_fields(self):
        status, snapshot = self.request("GET", "/api/auth/session", "staff")
        self.assertEqual(status, 200)
        self.assertTrue(snapshot["permissions"]["login"])
        self.assertTrue(snapshot["permissions"]["history_view"])
        self.assertFalse(snapshot["permissions"]["permission"])
        self.assertEqual(snapshot["user"]["role"], "staff")
        self.assertNotIn("password_hash", snapshot["user"])
        self.assertNotIn("session_version", snapshot["user"])
        self.assertNotIn("avatar_data", snapshot["user"])

    def test_disabling_login_revokes_old_token_permanently_even_after_reenable(self):
        with Session(self.engine) as db:
            db.query(User).filter_by(role="staff").one().password_hash = hash_password("test-password")
            db.commit()
        permissions = self.role_permissions("SALES")
        permissions["login"] = False
        self.assertEqual(self.request("PUT", "/api/auth/permissions/SALES", "admin", permissions)[0], 200)
        for path in ("/api/auth/session", "/api/auth/me", "/api/history", "/api/products"):
            self.assertEqual(self.request("GET", path, "staff")[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/login", body={"username": "staff", "password": "test-password"})[0], 403)
        self.assertEqual(self.request("GET", "/api/auth/session", "owner")[0], 200)
        permissions["login"] = True
        self.assertEqual(self.request("PUT", "/api/auth/permissions/SALES", "admin", permissions)[0], 200)
        self.assertEqual(self.request("GET", "/api/auth/session", "staff")[0], 401)
        with Session(self.engine) as db:
            user = db.query(User).filter_by(role="staff").one()
            self.assertEqual(user.session_version, 1)
        status, login = self.request("POST", "/api/auth/login", body={"username": "staff", "password": "test-password"})
        self.assertEqual(status, 200)
        self.tokens["staff"] = login["access_token"]
        self.assertEqual(self.request("GET", "/api/auth/session", "staff")[0], 200)

    def test_other_permission_changes_update_session_without_logging_out(self):
        permissions = self.role_permissions("SALES")
        permissions["history_view"] = False
        self.assertEqual(self.request("PUT", "/api/auth/permissions/SALES", "admin", permissions)[0], 200)
        status, snapshot = self.request("GET", "/api/auth/session", "staff")
        self.assertEqual(status, 200)
        self.assertFalse(snapshot["permissions"]["history_view"])
        self.assertEqual(self.request("GET", "/api/history", "staff")[0], 403)

    def test_locked_accounts_cannot_keep_a_session(self):
        with Session(self.engine) as db:
            db.query(User).filter_by(role="staff").one().is_active = False
            db.commit()
        self.assertEqual(self.request("GET", "/api/auth/session", "staff")[0], 401)

    def set_test_password(self, role, password="OldTest123"):
        with Session(self.engine) as db:
            user = db.query(User).filter_by(role=role).one()
            user.password_hash = hash_password(password)
            db.commit()
            return user.id

    def test_password_change_revokes_old_sessions_and_requires_new_password(self):
        self.set_test_password("staff")
        status, _ = self.request("PUT", "/api/auth/me/password", "staff", {
            "currentPassword": "OldTest123", "newPassword": "NewTest123",
        })
        self.assertEqual(status, 200)
        self.assertEqual(self.request("GET", "/api/auth/session", "staff")[0], 401)
        self.assertEqual(self.request("GET", "/api/auth/session", "admin")[0], 200)
        self.assertEqual(self.request("POST", "/api/auth/login", body={
            "username": "staff", "password": "OldTest123",
        })[0], 401)
        status, login = self.request("POST", "/api/auth/login", body={
            "username": "staff", "password": "NewTest123",
        })
        self.assertEqual(status, 200)
        old_token = self.tokens["staff"]
        self.tokens["staff"] = login["access_token"]
        self.assertEqual(self.request("GET", "/api/auth/session", "staff")[0], 200)
        self.tokens["staff"] = old_token
        self.assertEqual(self.request("GET", "/api/auth/session", "staff")[0], 401)

    def test_rejected_password_changes_preserve_password_and_session(self):
        self.set_test_password("staff")
        for current, new in [("Wrong123", "NewTest123"), ("OldTest123", "OldTest123"),
                             ("OldTest123", "a"), ("OldTest123", "á" * 40)]:
            with self.subTest(current=current, new_length=len(new)):
                self.assertIn(self.request("PUT", "/api/auth/me/password", "staff", {
                    "currentPassword": current, "newPassword": new,
                })[0], (400, 422))
                self.assertEqual(self.request("GET", "/api/auth/session", "staff")[0], 200)
        self.assertEqual(self.request("POST", "/api/auth/login", body={
            "username": "staff", "password": "OldTest123",
        })[0], 200)

    def test_admin_password_reset_revokes_target_sessions_only(self):
        target_id = self.set_test_password("staff")
        self.assertEqual(self.request("PUT", f"/api/auth/users/{target_id}", "admin", {
            "password": "ResetTest123",
        })[0], 200)
        self.assertEqual(self.request("GET", "/api/auth/session", "staff")[0], 401)
        self.assertEqual(self.request("GET", "/api/auth/session", "admin")[0], 200)
        self.assertEqual(self.request("POST", "/api/auth/login", body={
            "username": "staff", "password": "OldTest123",
        })[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/login", body={
            "username": "staff", "password": "ResetTest123",
        })[0], 200)

    def test_editing_profile_without_password_preserves_session(self):
        target_id = self.set_test_password("staff")
        self.assertEqual(self.request("PUT", f"/api/auth/users/{target_id}", "admin", {
            "fullName": "Updated Staff",
        })[0], 200)
        self.assertEqual(self.request("GET", "/api/auth/session", "staff")[0], 200)

    def test_session_detects_updated_role_and_keeps_admin_unrestricted(self):
        with Session(self.engine) as db:
            db.query(User).filter_by(role="staff").one().role = "customer"
            db.commit()
        status, snapshot = self.request("GET", "/api/auth/session", "staff")
        self.assertEqual(status, 200)
        self.assertEqual(snapshot["user"]["role"], "customer")
        self.assertTrue(snapshot["permissions"]["ai_product_advice"])
        self.assertFalse(snapshot["permissions"]["history_view"])
        self.assertTrue(all(self.request("GET", "/api/auth/session", "admin")[1]["permissions"].values()))


if __name__ == "__main__":
    unittest.main()
