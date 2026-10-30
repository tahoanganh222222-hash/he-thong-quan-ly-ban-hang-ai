"""Add a small, identifiable demo dataset without replacing existing data.

Run explicitly with: python seed_demo.py
The normal backend startup does not call this script.
"""

import argparse
import base64
import json
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import true
from sqlalchemy.orm import Session

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
    User,
)


# Stable business codes prevent duplicates when the script is run again.
DEMO_PRODUCTS = [
    ("SP018", "Trà xanh Không Độ 455ml", "Sữa và đồ uống", 6000, 10000, "Chai", 10, True),
    ("SP019", "Bánh quy bơ Danisa 200g", "Hàng tiêu dùng", 25000, 35000, "Hộp", 5, True),
    ("SP020", "Dầu gội Pantene 300ml", "Hàng tiêu dùng", 45000, 65000, "Chai", 5, True),
    ("SP021", "Nước lau sàn Lix 1L", "Hàng tiêu dùng", 22000, 32000, "Chai", 5, True),
    ("SP022", "Sữa tươi Vinamilk có đường 180ml", "Sữa và đồ uống", 5000, 8000, "Hộp", 5, True),
    ("SP023", "Khăn giấy Pulppy 100 tờ", "Hàng tiêu dùng", 12000, 18000, "Gói", 5, False),
    ("SP024", "Nước tăng lực Sting việt quất 320ml", "Sữa và đồ uống", 8500, 12000, "Lon", 12, True),
    ("SP025", "Nước tăng lực Sting dâu 500ml", "Sữa và đồ uống", 10500, 15000, "Chai", 10, True),
    ("SP026", "Trà ô long Tea Plus hương chanh 450ml", "Sữa và đồ uống", 8500, 12000, "Chai", 10, True),
    ("SP027", "Sữa lúa mạch Milo nắp vặn 210ml", "Sữa và đồ uống", 10500, 14000, "Hộp", 12, True),
    ("SP028", "Bánh quy Oreo nhân kem vani 133g", "Thực phẩm", 13000, 18000, "Gói", 10, True),
    ("SP029", "Bánh quế Oreo sô cô la 54g", "Thực phẩm", 10000, 15000, "Hộp", 8, True),
    ("SP030", "Xốt ướp thịt nướng Cholimex 200g", "Thực phẩm", 18000, 26000, "Hũ", 5, True),
    ("SP031", "Snack tôm cay nồng Oishi 65g", "Thực phẩm", 6500, 10000, "Gói", 15, True),
    ("SP032", "Cà phê G7 3 trong 1 336g", "Thực phẩm", 45000, 60000, "Hộp", 6, True),
    ("SP033", "Bột giặt Aba sạch tinh tươm 380g", "Hàng tiêu dùng", 16000, 22000, "Gói", 6, True),
    ("SP034", "Kem đánh răng Closeup tinh thể băng tuyết 180g", "Hàng tiêu dùng", 32000, 45000, "Tuýp", 5, True),
    ("SP035", "Sữa tắm Lifebuoy chăm sóc da 850g", "Hàng tiêu dùng", 90000, 120000, "Chai", 5, True),
]

DEMO_CUSTOMERS = [
    ("KH013", "Khách hàng 013", "Khách thường"),
    ("KH014", "Khách hàng 014", "Khách thân thiết"),
    ("KH015", "Nguyễn Minh Khang", "Khách thường"),
    ("KH016", "Trần Ngọc Mai", "Khách thân thiết"),
    ("KH017", "Lê Hoàng Phúc", "Khách thường"),
    ("KH018", "Phạm Thanh Thảo", "Khách VIP"),
]

CATALOG_IMAGE_ROOT = Path(__file__).resolve().parents[1] / "frontend" / "assets" / "catalog" / "products"
CATALOG_IMAGES = {
    "SP018": "tra-xanh-khong-do.png",
    "SP019": "banh-quy-bo-danisa.png",
    "SP020": "dau-goi-pantene.jpg",
    "SP021": "nuoc-lau-san-lix.jpg",
    "SP022": "sua-tuoi-vinamilk.jpg",
    "SP023": "khan-giay-pulppy.png",
    "SP024": "sting-viet-quat-320ml.jpg",
    "SP025": "sting-dau-500ml.jpg",
    "SP026": "tra-olong-tea-plus-chanh-450ml.jpg",
    "SP027": "sua-milo-210ml.jpg",
    "SP028": "banh-oreo-vani-133g.jpg",
    "SP029": "banh-que-oreo-socola-54g.jpg",
    "SP030": "xot-uop-thit-cholimex-200g.jpg",
    "SP031": "snack-oishi-tom-cay-65g.jpg",
    "SP032": "ca-phe-g7-336g.jpg",
    "SP033": "bot-giat-aba-380g.jpg",
    "SP034": "kem-danh-rang-closeup-180g.jpg",
    "SP035": "sua-tam-lifebuoy-850g.jpg",
}
PRODUCT_CODES = {suffix: item[0] for suffix, item in enumerate(DEMO_PRODUCTS, 1)}
# Only the original six products ever used these legacy labels.
LEGACY_PRODUCT_CODES = {f"DEMO-SP{suffix:03d}": PRODUCT_CODES[suffix] for suffix in range(1, 7)}
LEGACY_CUSTOMER_CODES = {"DEMO-KH001": "KH013", "DEMO-KH002": "KH014"}
LEGACY_RECEIPT_CODES = {f"DEMO-PN{index:03d}": f"PN-BS{index:03d}" for index in range(1, 5)}
LEGACY_INVOICE_CODES = {f"DEMO-HD{index:03d}": f"HD-BS{index:03d}" for index in range(1, 11)}

# Code, days before reference date, product suffix/quantity pairs.
DEMO_PURCHASES = [
    ("PN-BS001", 14, [(1, 30), (2, 20), (3, 12), (4, 8), (5, 6), (6, 12)]),
    ("PN-BS002", 9, [(1, 20), (2, 10)]),
    ("PN-BS003", 4, [(1, 15), (3, 8)]),
    ("PN-BS004", 1, [(2, 10), (3, 4)]),
    ("PN-BS005", 28, [(7, 48), (8, 36), (9, 30), (10, 36), (11, 40), (12, 30), (13, 16), (14, 50), (15, 18), (16, 20), (17, 18), (18, 8)]),
    ("PN-BS006", 18, [(7, 24), (10, 24), (11, 20), (14, 30)]),
    ("PN-BS007", 10, [(8, 24), (9, 24), (12, 18), (15, 12)]),
    ("PN-BS008", 5, [(10, 24), (11, 20), (16, 12), (17, 12)]),
    ("PN-BS009", 2, [(7, 24), (13, 12), (14, 30)]),
    ("PN-BS010", 0, [(9, 12), (10, 12), (15, 6)]),
]

# Code, days before reference date, customer, payment, discount, items.
DEMO_INVOICES = [
    ("HD-BS001", 13, "KH013", "cash", 0, [(1, 4), (2, 2)]),
    ("HD-BS002", 10, "KH014", "transfer", 0, [(3, 1), (4, 2)]),
    ("HD-BS003", 7, None, "cash", 0, [(1, 6), (5, 3)]),
    ("HD-BS004", 5, "KH014", "transfer", 5000, [(2, 3), (3, 2)]),
    ("HD-BS005", 3, "KH013", "cash", 0, [(1, 2), (4, 3)]),
    ("HD-BS006", 2, None, "cash", 0, [(2, 4), (5, 3)]),
    ("HD-BS007", 1, "KH013", "transfer", 0, [(1, 3), (3, 1)]),
    ("HD-BS008", 1, "KH014", "cash", 0, [(2, 2), (3, 2)]),
    ("HD-BS009", 0, "KH013", "cash", 2000, [(1, 2), (2, 1)]),
    ("HD-BS010", 0, "KH014", "transfer", 0, [(2, 2), (3, 1)]),
    ("HD-BS011", 27, "KH015", "cash", 0, [(7, 4), (11, 2), (14, 3)]),
    ("HD-BS012", 25, "KH016", "transfer", 5000, [(8, 3), (10, 4), (15, 1)]),
    ("HD-BS013", 23, None, "cash", 0, [(9, 2), (12, 2), (13, 1)]),
    ("HD-BS014", 21, "KH018", "transfer", 10000, [(16, 2), (17, 1), (18, 1)]),
    ("HD-BS015", 19, "KH017", "cash", 0, [(7, 6), (10, 3), (14, 5)]),
    ("HD-BS016", 17, "KH016", "transfer", 5000, [(11, 4), (12, 2), (15, 1)]),
    ("HD-BS017", 15, "KH015", "cash", 0, [(8, 4), (9, 3), (13, 2)]),
    ("HD-BS018", 13, None, "cash", 0, [(10, 5), (14, 6)]),
    ("HD-BS019", 11, "KH018", "transfer", 10000, [(11, 3), (15, 2), (17, 2)]),
    ("HD-BS020", 9, "KH017", "cash", 5000, [(16, 2), (18, 2)]),
    ("HD-BS021", 7, "KH016", "transfer", 0, [(7, 5), (9, 4), (12, 3)]),
    ("HD-BS022", 5, "KH015", "cash", 2000, [(8, 2), (10, 6), (14, 4)]),
    ("HD-BS023", 3, "KH018", "transfer", 5000, [(11, 4), (13, 2), (15, 1)]),
    ("HD-BS024", 2, None, "cash", 0, [(7, 3), (12, 2), (16, 1)]),
    ("HD-BS025", 1, "KH017", "cash", 0, [(9, 3), (11, 2), (17, 1)]),
    ("HD-BS026", 0, "KH015", "cash", 2000, [(7, 3), (11, 2), (14, 4)]),
    ("HD-BS027", 0, "KH016", "transfer", 10000, [(10, 6), (15, 1), (17, 1)]),
    ("HD-BS028", 0, "KH018", "transfer", 0, [(8, 2), (9, 2), (12, 2), (18, 2)]),
]


def catalog_image_data(code: str) -> str:
    image_path = CATALOG_IMAGE_ROOT / CATALOG_IMAGES[code]
    image_bytes = image_path.read_bytes()
    if not image_bytes or len(image_bytes) > 2 * 1024 * 1024:
        raise ValueError(f"Ảnh sản phẩm {code} không hợp lệ hoặc vượt quá 2 MB.")
    mime_type = "image/png" if image_path.suffix == ".png" else "image/jpeg"
    return f"data:{mime_type};base64," + base64.b64encode(image_bytes).decode("ascii")


def refresh_seed_catalog(db: Session) -> dict[str, int]:
    """Migrate the previous sample labels in place, preserving IDs and stock."""
    updated = dict(categories=0, products=0, customers=0, purchases=0, invoices=0, activity_logs=0)

    def rename_codes(model, field_name, mapping, counter):
        for old_code, new_code in mapping.items():
            field = getattr(model, field_name)
            old_record = db.query(model).filter(field == old_code).first()
            if old_record is None:
                continue
            if db.query(model.id).filter(field == new_code).first():
                raise ValueError(f"Mã {new_code} đã tồn tại. Dừng cập nhật để tránh ghi đè dữ liệu.")
            setattr(old_record, field_name, new_code)
            updated[counter] += 1
        db.flush()

    rename_codes(Product, "code", LEGACY_PRODUCT_CODES, "products")
    rename_codes(Customer, "code", LEGACY_CUSTOMER_CODES, "customers")
    rename_codes(PurchaseReceipt, "receipt_code", LEGACY_RECEIPT_CODES, "purchases")
    rename_codes(Invoice, "invoice_code", LEGACY_INVOICE_CODES, "invoices")

    category_names = {"Đồ uống (DEMO)": "Sữa và đồ uống", "Hàng tiêu dùng (DEMO)": "Hàng tiêu dùng"}
    for old_name, new_name in category_names.items():
        category = db.query(Category).filter(Category.name == old_name).first()
        if category is not None:
            if db.query(Category.id).filter(Category.name == new_name).first():
                raise ValueError(f"Danh mục {new_name} đã tồn tại. Dừng cập nhật để tránh tạo trùng.")
            category.name = new_name
            category.description = "Danh mục sản phẩm bổ sung"
            updated["categories"] += 1

    for code, name, *_ in DEMO_PRODUCTS:
        product = db.query(Product).filter(Product.code == code).first()
        if product is None:
            continue
        if "(DEMO)" in product.name:
            product.name = name
        if not product.image_data:
            product.image_data = catalog_image_data(code)

    for code, name, _group in DEMO_CUSTOMERS:
        customer = db.query(Customer).filter(Customer.code == code).first()
        if customer is not None and "DEMO" in customer.name:
            customer.name = name

    for code in LEGACY_RECEIPT_CODES.values():
        receipt = db.query(PurchaseReceipt).filter(PurchaseReceipt.receipt_code == code).first()
        if receipt is not None and receipt.supplier_name == "Nhà cung cấp mẫu DEMO":
            receipt.supplier_name = "Nhà cung cấp tổng hợp"

    transaction_codes = {**LEGACY_RECEIPT_CODES, **LEGACY_INVOICE_CODES}
    relevant_codes = list(transaction_codes) + list(transaction_codes.values())
    for log in db.query(ActivityLog).filter(ActivityLog.object_code.in_(relevant_codes)).all():
        previous = (log.object_code, log.detail)
        log.object_code = transaction_codes.get(log.object_code, log.object_code)
        detail = log.detail.removeprefix("[Dữ liệu mẫu DEMO] ")
        for old_code, new_code in transaction_codes.items():
            detail = detail.replace(old_code, new_code)
        log.detail = detail.replace("Nhà cung cấp mẫu DEMO", "Nhà cung cấp tổng hợp")
        if (log.object_code, log.detail) != previous:
            updated["activity_logs"] += 1
    db.flush()
    return updated


def seed_demo_data(db: Session, reference_date: date | None = None) -> dict[str, int]:
    """Add missing sample records. The caller owns commit/rollback.

    Fixed record codes prevent additional copies on later runs, even when the
    reference date changes. Existing prices, stock and records are not reset.
    """
    reference_date = reference_date or date.today()
    actor = (
        db.query(User)
        .filter(User.role == "admin", User.is_active == true())
        .order_by(User.id)
        .first()
    )
    if actor is None:
        raise ValueError("Cần một tài khoản quản trị viên đang hoạt động trước khi nạp dữ liệu mẫu.")

    refresh_seed_catalog(db)

    added = dict(categories=0, products=0, customers=0, inventories=0, purchases=0, invoices=0, activity_logs=0)

    def record_activity(action, action_type, object_type, object_code, detail, created_at):
        db.add(ActivityLog(
            user_id=actor.id,
            action=action,
            action_type=action_type,
            object_type=object_type,
            object_code=object_code,
            detail=detail,
            created_at=created_at,
        ))
        added["activity_logs"] += 1

    categories = {}
    for category_name in sorted({item[2] for item in DEMO_PRODUCTS}):
        category = db.query(Category).filter(Category.name == category_name).first()
        if category is None:
            category = Category(name=category_name, description="Danh mục sản phẩm bổ sung", is_active=True)
            db.add(category)
            db.flush()
            added["categories"] += 1
        categories[category_name] = category

    products = {}
    inventories = {}
    for code, name, category_name, buy_price, sell_price, unit, minimum, active in DEMO_PRODUCTS:
        product = db.query(Product).filter(Product.code == code).first()
        if product is None:
            product = Product(
                code=code, name=name, category_id=categories[category_name].id,
                purchase_price=buy_price, selling_price=sell_price, unit=unit, is_active=active,
                image_data=catalog_image_data(code),
            )
            db.add(product)
            db.flush()
            added["products"] += 1
        inventory = db.query(Inventory).filter(Inventory.product_id == product.id).first()
        if inventory is None:
            inventory = Inventory(product_id=product.id, quantity=0, min_quantity=minimum)
            db.add(inventory)
            db.flush()
            added["inventories"] += 1
        products[code] = product
        inventories[code] = inventory

    customers = {}
    for code, name, group in DEMO_CUSTOMERS:
        customer = db.query(Customer).filter(Customer.code == code).first()
        if customer is None:
            customer = Customer(code=code, name=name, customer_group=group, is_active=True)
            db.add(customer)
            db.flush()
            added["customers"] += 1
        customers[code] = customer

    for code, days_ago, items in DEMO_PURCHASES:
        if db.query(PurchaseReceipt.id).filter(PurchaseReceipt.receipt_code == code).first():
            continue
        created_at = datetime.combine(reference_date - timedelta(days=days_ago), time(0, 1))
        total = sum((products[PRODUCT_CODES[suffix]].purchase_price * quantity for suffix, quantity in items), Decimal("0"))
        receipt = PurchaseReceipt(
            receipt_code=code, user_id=actor.id, supplier_name="Nhà cung cấp tổng hợp",
            total_amount=total, created_at=created_at,
        )
        db.add(receipt)
        db.flush()
        for suffix, quantity in items:
            product_code = PRODUCT_CODES[suffix]
            product = products[product_code]
            db.add(PurchaseReceiptDetail(
                receipt_id=receipt.id, product_id=product.id, quantity=quantity,
                unit_price=product.purchase_price, amount=product.purchase_price * quantity,
            ))
            inventories[product_code].quantity += quantity
        record_activity("Nhập", "import", "Phiếu nhập", code, f"Tạo phiếu nhập, tổng tiền {total}", created_at)
        record_activity("Nhập", "update", "Tồn kho", code, f"Tăng tồn kho theo phiếu nhập {code}", created_at)
        added["purchases"] += 1

    for index, (code, days_ago, customer_code, payment, discount, items) in enumerate(DEMO_INVOICES):
        if db.query(Invoice.id).filter(Invoice.invoice_code == code).first():
            continue
        created_at = datetime.combine(reference_date - timedelta(days=days_ago), time(0, 5 + index))
        total = sum((products[PRODUCT_CODES[suffix]].selling_price * quantity for suffix, quantity in items), Decimal("0"))
        invoice = Invoice(
            invoice_code=code, customer_id=customers[customer_code].id if customer_code else None,
            user_id=actor.id, total_amount=total, discount=discount,
            final_amount=total - Decimal(discount), payment_method=payment, created_at=created_at,
        )
        db.add(invoice)
        db.flush()
        for suffix, quantity in items:
            product_code = PRODUCT_CODES[suffix]
            product = products[product_code]
            inventory = inventories[product_code]
            if not product.is_active or inventory.quantity < quantity:
                raise ValueError(f"Sản phẩm {product_code} không đủ điều kiện bán hoặc không đủ tồn kho. Không nạp dữ liệu mẫu.")
            db.add(InvoiceDetail(
                invoice_id=invoice.id, product_id=product.id, quantity=quantity,
                unit_price=product.selling_price, discount=0, amount=product.selling_price * quantity,
            ))
            inventory.quantity -= quantity
        record_activity("Tạo", "create", "Hóa đơn", code, f"Tạo hóa đơn, tổng tiền {invoice.final_amount}", created_at)
        record_activity("Xuất", "update", "Tồn kho", code, f"Giảm tồn kho theo hóa đơn {code}", created_at)
        added["invoices"] += 1

    db.flush()
    return added


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Nạp bổ sung dữ liệu mẫu, không xóa hay đặt lại dữ liệu hiện có.")
    parser.add_argument("--refresh-catalog-only", action="store_true", help="Chỉ cập nhật nhãn cũ và ảnh sản phẩm, không thêm giao dịch.")
    parser.add_argument("--reference-date", type=date.fromisoformat, default=date.today(), help="Ngày cuối của bộ giao dịch mẫu, định dạng YYYY-MM-DD.")
    args = parser.parse_args()

    from app.core.config import settings
    from app.core.database import SessionLocal, engine

    engine.echo = False
    with SessionLocal.begin() as db:
        if args.refresh_catalog_only:
            result = {"updated": refresh_seed_catalog(db)}
        else:
            result = {"added": seed_demo_data(db, args.reference_date)}
    print(json.dumps({"database": settings.DB_NAME, "reference_date": args.reference_date.isoformat(), **result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
