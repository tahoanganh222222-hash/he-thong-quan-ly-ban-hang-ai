from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.core.permissions import DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS
from app.models import (
    ActivityLog,
    Category,
    Customer,
    Inventory,
    Invoice,
    InvoiceDetail,
    Product,
    PurchaseReceipt,
    PurchaseReceiptDetail,
    RolePermission,
    User,
)


INITIAL_USERS = [
    ("admin", "Quản trị viên", "admin"),
    ("owner01", "Nguyễn Văn A", "owner"),
    ("staff01", "Trần Văn B", "staff"),
    ("user01", "Lê Văn C", "customer"),
]

INITIAL_PRODUCTS = [
    ("SP001", "Nước suối Aquafina 500ml", "Đồ uống", 4000, 6000, "Chai", 120, 20),
    ("SP002", "Nước ngọt Coca Cola", "Đồ uống", 7500, 10000, "Lon", 85, 20),
    ("SP003", "Bột giặt OMO 3kg", "Hàng gia dụng", 85000, 105000, "Túi", 35, 15),
    ("SP004", "Nước rửa chén Sunlight", "Hàng gia dụng", 28000, 35000, "Chai", 40, 10),
    ("SP005", "Giấy vệ sinh Pulppy", "Hàng gia dụng", 45000, 55000, "Bịch", 50, 20),
    ("SP006", "Quạt điện Senko", "Thiết bị điện", 380000, 490000, "Cái", 12, 10),
    ("SP007", "Nồi cơm điện Sharp", "Thiết bị điện", 650000, 790000, "Cái", 31, 10),
    ("SP008", "Máy sấy tóc Panasonic", "Thiết bị điện", 420000, 520000, "Cái", 8, 10),
    ("SP009", "Bóng đèn LED 12W", "Vật tư", 35000, 50000, "Cái", 45, 15),
    ("SP010", "Ổ cắm điện 3 lỗ", "Vật tư", 45000, 65000, "Cái", 25, 10),
    ("SP011", "Nước giặt Ariel 2.4kg", "Hàng gia dụng", 90000, 115000, "Túi", 30, 10),
    ("SP012", "Mì Hảo Hảo tôm chua cay", "Thực phẩm", 3500, 5000, "Gói", 150, 30),
    ("SP013", "Dầu ăn Neptune 1L", "Thực phẩm", 38000, 45000, "Chai", 40, 10),
    ("SP014", "Ấm siêu tốc Sunhouse", "Thiết bị điện", 250000, 320000, "Cái", 18, 8),
    ("SP015", "Dây điện đôi 2x1.5", "Vật tư", 12000, 18000, "Mét", 100, 25),
]

INITIAL_CUSTOMERS = [
    ("KH001", "Nguyễn Văn An", "0912345678", "nguyenvanan@gmail.com", "Thái Nguyên", "Khách thường", True),
    ("KH002", "Trần Thị Bình", "0987654321", "tranthibinh@gmail.com", "Hà Nội", "Khách thân thiết", True),
    ("KH003", "Lê Văn Cường", "0905123456", "levancuong@gmail.com", "Thái Nguyên", "Khách thường", True),
    ("KH004", "Phạm Thị Dung", "0978123456", "phamthidung@gmail.com", "Bắc Ninh", "Khách thân thiết", True),
    ("KH005", "Hoàng Văn Đức", "0961234567", "", "Thái Nguyên", "Khách thường", False),
    ("KH006", "Đỗ Thị Hà", "0934567890", "dothiha@gmail.com", "Hà Nội", "Khách VIP", True),
    ("KH007", "Nguyễn Minh Hoàng", "0923456789", "nguyenminhhoang@gmail.com", "Thái Nguyên", "Khách thường", True),
    ("KH008", "Vũ Thị Lan", "0945678901", "vuthilan@gmail.com", "Bắc Giang", "Khách thân thiết", True),
    ("KH009", "Bùi Văn Nam", "0915678901", "", "Thái Nguyên", "Khách thường", True),
    ("KH010", "Phan Thị Oanh", "0981234567", "phanthioanh@gmail.com", "Hà Nội", "Khách VIP", True),
]

INITIAL_PURCHASES = [
    (
        "PN20260901-001",
        "Nhà cung cấp Minh Long",
        datetime(2026, 9, 1, 8, 30),
        [("SP001", 100, 4000), ("SP002", 60, 7500), ("SP012", 100, 3500)],
    ),
    (
        "PN20260903-002",
        "Nhà phân phối An Phát",
        datetime(2026, 9, 3, 9, 15),
        [("SP006", 10, 380000), ("SP008", 8, 420000), ("SP014", 12, 250000)],
    ),
]

INITIAL_INVOICES = [
    ("HD20260901-1001", "KH001", datetime(2026, 9, 1, 10, 5), "cash", 0, [("SP001", 1), ("SP012", 2)]),
    ("HD20260901-1002", "KH002", datetime(2026, 9, 1, 14, 20), "transfer", 0, [("SP008", 1)]),
    ("HD20260902-1003", "KH003", datetime(2026, 9, 2, 9, 10), "cash", 0, [("SP004", 2), ("SP005", 1)]),
    ("HD20260903-1004", "KH004", datetime(2026, 9, 3, 16, 35), "transfer", 5000, [("SP003", 1), ("SP002", 2)]),
    ("HD20260904-1005", "KH006", datetime(2026, 9, 4, 11, 45), "cash", 0, [("SP009", 1), ("SP015", 2)]),
    ("HD20260905-1006", "KH007", datetime(2026, 9, 5, 15, 5), "transfer", 10000, [("SP006", 1), ("SP002", 3)]),
    ("HD20260906-1007", None, datetime(2026, 9, 6, 8, 50), "cash", 0, [("SP013", 1)]),
]


def _has_broken_unicode(value: str | None) -> bool:
    return bool(value and ("?" in value or "\ufffd" in value))


def seed_initial_data(db: Session) -> None:
    existing_permissions = {
        (item.role, item.permission_key)
        for item in db.query(RolePermission).all()
    }
    for role, allowed_permissions in DEFAULT_ROLE_PERMISSIONS.items():
        for permission_key in PERMISSION_KEYS:
            if (role, permission_key) not in existing_permissions:
                db.add(RolePermission(
                    role=role,
                    permission_key=permission_key,
                    allowed=allowed_permissions.get(permission_key, False),
                ))

    categories: dict[str, Category] = {
        item.name: item for item in db.query(Category).all()
    }

    products = {item.code: item for item in db.query(Product).all()}
    for code, _, category_name, *_ in INITIAL_PRODUCTS:
        product = products.get(code)
        if product is not None:
            category = db.get(Category, product.category_id)
            if category is not None:
                categories[category_name] = category
                if _has_broken_unicode(category.name):
                    category.name = category_name
                    category.description = f"Danh mục {category_name}"

    for name in sorted({item[2] for item in INITIAL_PRODUCTS}):
        if name not in categories:
            category = Category(name=name, description=f"Danh mục {name}", is_active=True)
            db.add(category)
            db.flush()
            categories[name] = category

    users = {item.username: item for item in db.query(User).all()}
    for username, full_name, role in INITIAL_USERS:
        if username not in users:
            user = User(
                username=username,
                    password_hash=hash_password("123456"),
                    full_name=full_name,
                    phone=None,
                    email=None,
                    role=role,
                is_active=True,
            )
            db.add(user)
            db.flush()
            users[username] = user
        elif _has_broken_unicode(users[username].full_name):
            users[username].full_name = full_name

    for code, name, category_name, purchase_price, selling_price, unit, stock, minimum in INITIAL_PRODUCTS:
        product = products.get(code)
        if product is None:
            product = Product(
                code=code,
                name=name,
                category_id=categories[category_name].id,
                purchase_price=purchase_price,
                selling_price=selling_price,
                unit=unit,
                is_active=True,
            )
            db.add(product)
            db.flush()
            products[code] = product
        else:
            if _has_broken_unicode(product.name):
                product.name = name
            if _has_broken_unicode(product.unit):
                product.unit = unit
        inventory = db.query(Inventory).filter(Inventory.product_id == product.id).first()
        if inventory is None:
            db.add(Inventory(product_id=product.id, quantity=stock, min_quantity=minimum))

    customers = {item.code: item for item in db.query(Customer).all()}
    for code, name, phone, email, address, group, is_active in INITIAL_CUSTOMERS:
        if code not in customers:
            customer = Customer(
                code=code,
                name=name,
                phone=phone,
                email=email or None,
                address=address,
                customer_group=group,
                is_active=is_active,
            )
            db.add(customer)
            db.flush()
            customers[code] = customer
        else:
            customer = customers[code]
            if _has_broken_unicode(customer.name):
                customer.name = name
            if _has_broken_unicode(customer.address):
                customer.address = address
            if _has_broken_unicode(customer.customer_group):
                customer.customer_group = group

    existing_receipts = {item.receipt_code for item in db.query(PurchaseReceipt).all()}
    for receipt_code, supplier, created_at, items in INITIAL_PURCHASES:
        if receipt_code in existing_receipts:
            receipt = (
                db.query(PurchaseReceipt)
                .filter(PurchaseReceipt.receipt_code == receipt_code)
                .first()
            )
            if receipt and _has_broken_unicode(receipt.supplier_name):
                receipt.supplier_name = supplier
            continue
        total = sum(Decimal(str(price)) * quantity for _, quantity, price in items)
        receipt = PurchaseReceipt(
            receipt_code=receipt_code,
            user_id=users["admin"].id,
            supplier_name=supplier,
            total_amount=total,
            created_at=created_at,
        )
        db.add(receipt)
        db.flush()
        for product_code, quantity, price in items:
            amount = Decimal(str(price)) * quantity
            db.add(PurchaseReceiptDetail(
                receipt_id=receipt.id,
                product_id=products[product_code].id,
                quantity=quantity,
                unit_price=price,
                amount=amount,
            ))

    existing_invoices = {item.invoice_code for item in db.query(Invoice).all()}
    for invoice_code, customer_code, created_at, payment, discount, items in INITIAL_INVOICES:
        if invoice_code in existing_invoices:
            continue
        total = sum(products[code].selling_price * quantity for code, quantity in items)
        invoice = Invoice(
            invoice_code=invoice_code,
            customer_id=customers[customer_code].id if customer_code else None,
            user_id=users["admin"].id,
            total_amount=total,
            discount=discount,
            final_amount=max(Decimal("0"), total - Decimal(str(discount))),
            payment_method=payment,
            created_at=created_at,
        )
        db.add(invoice)
        db.flush()
        for product_code, quantity in items:
            price = products[product_code].selling_price
            db.add(InvoiceDetail(
                invoice_id=invoice.id,
                product_id=products[product_code].id,
                quantity=quantity,
                unit_price=price,
                discount=0,
                amount=price * quantity,
            ))

    # Tạo nhật ký ban đầu đúng một lần cho dữ liệu mẫu đã có trong hệ thống.
    if db.query(ActivityLog).count() == 0:
        for invoice in db.query(Invoice).order_by(Invoice.created_at).all():
            db.add(ActivityLog(
                user_id=invoice.user_id,
                action="Tạo",
                action_type="create",
                object_type="Hóa đơn",
                object_code=invoice.invoice_code,
                detail=f"Tạo hóa đơn, tổng tiền {invoice.final_amount}",
                created_at=invoice.created_at,
            ))
        for receipt in db.query(PurchaseReceipt).order_by(PurchaseReceipt.created_at).all():
            db.add(ActivityLog(
                user_id=receipt.user_id,
                action="Nhập",
                action_type="import",
                object_type="Phiếu nhập",
                object_code=receipt.receipt_code,
                detail=f"Nhập hàng từ {receipt.supplier_name}, tổng tiền {receipt.total_amount}",
                created_at=receipt.created_at,
            ))

    db.commit()
