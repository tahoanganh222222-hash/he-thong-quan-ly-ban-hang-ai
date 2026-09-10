from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_any_permission, require_permission
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
from app.schemas.sales import (
    CategoryCreate,
    CategoryUpdate,
    CustomerCreate,
    CustomerUpdate,
    HistoryCreate,
    InventoryCreate,
    InventoryUpdate,
    InvoiceCreate,
    InvoiceUpdate,
    ProductCreate,
    ProductUpdate,
    PurchaseCreate,
    PurchaseUpdate,
)


router = APIRouter(prefix="/api", tags=["Sales Management"])

PRODUCT_READ_PERMISSIONS = (
    "product_manage",
    "invoice_create",
    "purchase_track",
    "inventory_view",
    "top_products",
    "ai_product_advice",
    "report_export",
    "revenue_statistics",
    "sales_data_qa",
)


def _not_found(name: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Không tìm thấy {name}")


def _commit(db: Session, duplicate_message: str = "Dữ liệu đã tồn tại") -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=duplicate_message) from exc


def _record_activity(
    db: Session,
    user: User,
    action: str,
    action_type: str,
    object_type: str,
    object_code: str = "",
    detail: str = "",
) -> ActivityLog:
    log = ActivityLog(
        user_id=user.id,
        action=action,
        action_type=action_type,
        object_type=object_type,
        object_code=object_code,
        detail=detail,
    )
    db.add(log)
    return log


def _activity_dict(db: Session, log: ActivityLog) -> dict:
    user = db.get(User, log.user_id)
    return {
        "id": log.id,
        "time": log.created_at.strftime("%d/%m/%Y %H:%M"),
        "createdAt": log.created_at.isoformat(),
        "user": user.full_name if user else "Người dùng",
        "username": user.username if user else "",
        "action": log.action,
        "actionType": log.action_type,
        "object": log.object_type,
        "code": log.object_code,
        "detail": log.detail,
    }


@router.get("/history")
def list_history(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("history_view")),
):
    logs = db.query(ActivityLog).order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc()).limit(1000).all()
    return [_activity_dict(db, log) for log in logs]


@router.post("/history", status_code=status.HTTP_201_CREATED)
def create_history(
    data: HistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("report_export")),
):
    log = _record_activity(
        db,
        current_user,
        data.action,
        data.actionType,
        data.object,
        data.code.strip(),
        data.detail.strip(),
    )
    db.commit()
    db.refresh(log)
    return _activity_dict(db, log)


def _get_or_create_category(db: Session, name: str) -> Category:
    clean_name = name.strip()
    category = (
        db.query(Category)
        .filter(func.lower(Category.name) == clean_name.lower())
        .first()
    )
    if category is None:
        category = Category(name=clean_name, description="", is_active=True)
        db.add(category)
        db.flush()
    return category


def _category_dict(category: Category) -> dict:
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description or "",
        "isActive": category.is_active,
    }


@router.get("/categories")
def list_categories(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_any_permission(*PRODUCT_READ_PERMISSIONS)),
):
    return [_category_dict(item) for item in db.query(Category).order_by(Category.id).all()]


@router.post("/categories", status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_manage")),
):
    category = Category(
        name=data.name.strip(),
        description=(data.description or "").strip() or None,
        is_active=data.isActive,
    )
    db.add(category)
    _record_activity(
        db, current_user, "Thêm", "add", "Danh mục", "",
        f"Thêm danh mục mới: {category.name}",
    )
    _commit(db, "Tên danh mục đã tồn tại")
    db.refresh(category)
    return _category_dict(category)


@router.put("/categories/{category_id}")
def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_manage")),
):
    category = db.get(Category, category_id)
    if category is None:
        raise _not_found("danh mục")
    changes = data.model_dump(exclude_unset=True)
    field_map = {"isActive": "is_active"}
    for key, value in changes.items():
        target = field_map.get(key, key)
        if isinstance(value, str):
            value = value.strip() or None
        setattr(category, target, value)
    _record_activity(
        db, current_user, "Cập nhật", "update", "Danh mục", "",
        f"Cập nhật danh mục: {category.name}",
    )
    _commit(db, "Tên danh mục đã tồn tại")
    db.refresh(category)
    return _category_dict(category)


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_manage")),
):
    category = db.get(Category, category_id)
    if category is None:
        raise _not_found("danh mục")
    if db.query(Product.id).filter(Product.category_id == category_id).first():
        raise HTTPException(
            status_code=409,
            detail="Không thể xóa danh mục đang có sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước.",
        )
    category_name = category.name
    db.delete(category)
    _record_activity(
        db, current_user, "Xóa", "delete", "Danh mục", "",
        f"Xóa danh mục: {category_name}",
    )
    db.commit()
    return {"message": "Đã xóa danh mục", "id": category_id}


def _product_dict(db: Session, product: Product) -> dict:
    category = db.get(Category, product.category_id)
    inventory = (
        db.query(Inventory)
        .filter(Inventory.product_id == product.id)
        .first()
    )
    return {
        "id": product.id,
        "code": product.code,
        "name": product.name,
        "categoryId": product.category_id,
        "category": category.name if category else "",
        "purchasePrice": float(product.purchase_price),
        "sellingPrice": float(product.selling_price),
        "unit": product.unit,
        "isActive": product.is_active,
        "stock": inventory.quantity if inventory else 0,
        "minimum": inventory.min_quantity if inventory else 0,
    }


def _customer_dict(customer: Customer) -> dict:
    return {
        "id": customer.id,
        "code": customer.code,
        "name": customer.name,
        "phone": customer.phone or "",
        "email": customer.email or "",
        "address": customer.address or "",
        "customerGroup": customer.customer_group or "",
        "isActive": customer.is_active,
    }


def _inventory_dict(db: Session, inventory: Inventory) -> dict:
    product = db.get(Product, inventory.product_id)
    category = db.get(Category, product.category_id) if product else None
    return {
        "id": inventory.id,
        "productId": inventory.product_id,
        "code": product.code if product else "",
        "name": product.name if product else "",
        "category": category.name if category else "",
        "unit": product.unit if product else "",
        "quantity": inventory.quantity,
        "minimum": inventory.min_quantity,
        "isActive": product.is_active if product else False,
    }


def _invoice_dict(db: Session, invoice: Invoice, include_items: bool = True) -> dict:
    customer = db.get(Customer, invoice.customer_id) if invoice.customer_id else None
    payload = {
        "id": invoice.id,
        "code": invoice.invoice_code,
        "invoiceCode": invoice.invoice_code,
        "customerId": invoice.customer_id,
        "customerCode": customer.code if customer else "",
        "customerName": customer.name if customer else "Khách lẻ",
        "customerPhone": customer.phone if customer else "",
        "userId": invoice.user_id,
        "totalAmount": float(invoice.total_amount),
        "discount": float(invoice.discount),
        "finalAmount": float(invoice.final_amount),
        "paymentMethod": invoice.payment_method,
        "date": invoice.created_at.strftime("%Y-%m-%d"),
        "createdAt": invoice.created_at.isoformat(),
        "status": "completed",
    }
    if include_items:
        details = (
            db.query(InvoiceDetail)
            .filter(InvoiceDetail.invoice_id == invoice.id)
            .order_by(InvoiceDetail.id)
            .all()
        )
        payload["items"] = [
            {
                "id": detail.id,
                "productId": detail.product_id,
                "productName": (db.get(Product, detail.product_id).name),
                "quantity": detail.quantity,
                "unitPrice": float(detail.unit_price),
                "discount": float(detail.discount),
                "amount": float(detail.amount),
            }
            for detail in details
        ]
    return payload


def _purchase_dict(db: Session, receipt: PurchaseReceipt, include_items: bool = True) -> dict:
    payload = {
        "id": receipt.id,
        "code": receipt.receipt_code,
        "receiptCode": receipt.receipt_code,
        "supplierName": receipt.supplier_name or "",
        "userId": receipt.user_id,
        "totalAmount": float(receipt.total_amount),
        "date": receipt.created_at.strftime("%Y-%m-%d"),
        "createdAt": receipt.created_at.isoformat(),
    }
    if include_items:
        details = (
            db.query(PurchaseReceiptDetail)
            .filter(PurchaseReceiptDetail.receipt_id == receipt.id)
            .order_by(PurchaseReceiptDetail.id)
            .all()
        )
        payload["items"] = [
            {
                "id": detail.id,
                "productId": detail.product_id,
                "productName": (db.get(Product, detail.product_id).name),
                "quantity": detail.quantity,
                "unitPrice": float(detail.unit_price),
                "amount": float(detail.amount),
            }
            for detail in details
        ]
    return payload


@router.get("/products")
def list_products(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_any_permission(*PRODUCT_READ_PERMISSIONS)),
):
    return [_product_dict(db, item) for item in db.query(Product).order_by(Product.id).all()]


@router.get("/products/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_any_permission(*PRODUCT_READ_PERMISSIONS)),
):
    product = db.get(Product, product_id)
    if product is None:
        raise _not_found("sản phẩm")
    return _product_dict(db, product)


@router.post("/products", status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_manage")),
):
    category = _get_or_create_category(db, data.category)
    product = Product(
        code=data.code.strip(),
        name=data.name.strip(),
        category_id=category.id,
        purchase_price=Decimal(str(data.purchasePrice)),
        selling_price=Decimal(str(data.sellingPrice)),
        unit=data.unit.strip(),
        is_active=data.isActive,
    )
    db.add(product)
    db.flush()
    db.add(
        Inventory(
            product_id=product.id,
            quantity=data.stock,
            min_quantity=data.minimum,
        )
    )
    _record_activity(
        db, current_user, "Thêm", "add", "Sản phẩm", product.code,
        f"Thêm sản phẩm mới: {product.name}",
    )
    _commit(db, "Mã sản phẩm đã tồn tại")
    db.refresh(product)
    return _product_dict(db, product)


@router.put("/products/{product_id}")
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_manage")),
):
    product = db.get(Product, product_id)
    if product is None:
        raise _not_found("sản phẩm")
    changes = data.model_dump(exclude_unset=True)
    if "category" in changes:
        product.category_id = _get_or_create_category(db, changes.pop("category")).id
    field_map = {
        "purchasePrice": "purchase_price",
        "sellingPrice": "selling_price",
        "isActive": "is_active",
    }
    for key, value in changes.items():
        target = field_map.get(key, key)
        if key in {"purchasePrice", "sellingPrice"}:
            value = Decimal(str(value))
        if isinstance(value, str):
            value = value.strip()
        setattr(product, target, value)
    _record_activity(
        db, current_user, "Cập nhật", "update", "Sản phẩm", product.code,
        f"Cập nhật sản phẩm: {product.name}",
    )
    _commit(db, "Mã sản phẩm đã tồn tại")
    db.refresh(product)
    return _product_dict(db, product)


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("product_manage")),
):
    product = db.get(Product, product_id)
    if product is None:
        raise _not_found("sản phẩm")
    has_invoice = db.query(InvoiceDetail.id).filter(
        InvoiceDetail.product_id == product_id
    ).first()
    has_purchase = db.query(PurchaseReceiptDetail.id).filter(
        PurchaseReceiptDetail.product_id == product_id
    ).first()
    if has_invoice or has_purchase:
        raise HTTPException(
            status_code=409,
            detail=(
                "Không thể xóa sản phẩm đã có trong hóa đơn hoặc phiếu nhập. "
                "Bạn có thể dùng nút Ngừng để giữ nguyên lịch sử dữ liệu."
            ),
        )
    product_code = product.code
    product_name = product.name
    db.query(Inventory).filter(Inventory.product_id == product_id).delete(
        synchronize_session=False
    )
    db.delete(product)
    _record_activity(
        db, current_user, "Xóa", "delete", "Sản phẩm", product_code,
        f"Xóa sản phẩm: {product_name}",
    )
    db.commit()
    return {"message": "Đã xóa sản phẩm", "id": product_id}


@router.get("/customers")
def list_customers(
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_any_permission(
            "customer_manage", "invoice_create", "sales_data_qa", "revenue_statistics"
        )
    ),
):
    return [_customer_dict(item) for item in db.query(Customer).order_by(Customer.id).all()]


@router.get("/customers/{customer_id}")
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(
        require_any_permission(
            "customer_manage", "invoice_create", "sales_data_qa", "revenue_statistics"
        )
    ),
):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise _not_found("khách hàng")
    return _customer_dict(customer)


@router.get("/customers/{customer_id}/purchase-history")
def get_customer_purchase_history(
    customer_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("customer_manage")),
):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise _not_found("khách hàng")

    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id == customer_id)
        .order_by(Invoice.created_at.desc(), Invoice.id.desc())
        .all()
    )
    invoice_payloads = [_invoice_dict(db, invoice) for invoice in invoices]

    return {
        "customer": _customer_dict(customer),
        "summary": {
            "invoiceCount": len(invoice_payloads),
            "totalSpent": sum(
                float(invoice.final_amount or 0) for invoice in invoices
            ),
            "totalItems": sum(
                int(item.get("quantity", 0))
                for invoice in invoice_payloads
                for item in invoice.get("items", [])
            ),
            "lastPurchaseAt": (
                invoices[0].created_at.isoformat() if invoices else None
            ),
        },
        "invoices": invoice_payloads,
    }


@router.post("/customers", status_code=status.HTTP_201_CREATED)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("customer_manage")),
):
    customer = Customer(
        code=data.code.strip(),
        name=data.name.strip(),
        phone=data.phone or None,
        email=data.email or None,
        address=data.address or None,
        customer_group=data.customerGroup or None,
        is_active=data.isActive,
    )
    db.add(customer)
    _record_activity(
        db, current_user, "Thêm", "add", "Khách hàng", customer.code,
        f"Thêm khách hàng mới: {customer.name}",
    )
    _commit(db, "Mã khách hàng đã tồn tại")
    db.refresh(customer)
    return _customer_dict(customer)


@router.put("/customers/{customer_id}")
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("customer_manage")),
):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise _not_found("khách hàng")
    changes = data.model_dump(exclude_unset=True)
    field_map = {"customerGroup": "customer_group", "isActive": "is_active"}
    for key, value in changes.items():
        target = field_map.get(key, key)
        if isinstance(value, str):
            value = value.strip() or None
        setattr(customer, target, value)
    _record_activity(
        db, current_user, "Cập nhật", "update", "Khách hàng", customer.code,
        f"Cập nhật khách hàng: {customer.name}",
    )
    _commit(db, "Mã khách hàng đã tồn tại")
    db.refresh(customer)
    return _customer_dict(customer)


@router.delete("/customers/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("customer_manage")),
):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise _not_found("khách hàng")
    if db.query(Invoice.id).filter(Invoice.customer_id == customer_id).first():
        raise HTTPException(
            status_code=409,
            detail=(
                "Không thể xóa khách hàng đã có hóa đơn. "
                "Bạn có thể dùng nút Khóa để giữ nguyên lịch sử dữ liệu."
            ),
        )
    customer_code = customer.code
    customer_name = customer.name
    db.delete(customer)
    _record_activity(
        db, current_user, "Xóa", "delete", "Khách hàng", customer_code,
        f"Xóa khách hàng: {customer_name}",
    )
    db.commit()
    return {"message": "Đã xóa khách hàng", "id": customer_id}


INVENTORY_READ_PERMISSIONS = (
    "inventory_view",
    "purchase_track",
    "report_export",
    "sales_data_qa",
    "revenue_statistics",
)


@router.get("/inventory")
def list_inventory(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_any_permission(*INVENTORY_READ_PERMISSIONS)),
):
    items = db.query(Inventory).order_by(Inventory.id).all()
    return [_inventory_dict(db, item) for item in items]


@router.get("/inventory/{inventory_id}")
def get_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_any_permission(*INVENTORY_READ_PERMISSIONS)),
):
    item = db.get(Inventory, inventory_id)
    if item is None:
        raise _not_found("tồn kho")
    return _inventory_dict(db, item)


@router.post("/inventory", status_code=status.HTTP_201_CREATED)
def create_inventory(
    data: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchase_track")),
):
    if db.get(Product, data.productId) is None:
        raise _not_found("sản phẩm")
    item = Inventory(
        product_id=data.productId,
        quantity=data.quantity,
        min_quantity=data.minimum,
    )
    db.add(item)
    product = db.get(Product, data.productId)
    _record_activity(
        db, current_user, "Thêm", "add", "Tồn kho", product.code if product else "",
        f"Tạo bản ghi tồn kho, số lượng: {data.quantity}",
    )
    _commit(db, "Sản phẩm đã có bản ghi tồn kho")
    db.refresh(item)
    return _inventory_dict(db, item)


@router.put("/inventory/{inventory_id}")
def update_inventory(
    inventory_id: int,
    data: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchase_track")),
):
    item = db.get(Inventory, inventory_id)
    if item is None:
        raise _not_found("tồn kho")
    if data.quantity is not None:
        item.quantity = data.quantity
    if data.minimum is not None:
        item.min_quantity = data.minimum
    product = db.get(Product, item.product_id)
    _record_activity(
        db, current_user, "Cập nhật", "update", "Tồn kho", product.code if product else "",
        f"Cập nhật tồn kho: số lượng {item.quantity}, tối thiểu {item.min_quantity}",
    )
    db.commit()
    db.refresh(item)
    return _inventory_dict(db, item)


@router.delete("/inventory/{inventory_id}")
def delete_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchase_track")),
):
    item = db.get(Inventory, inventory_id)
    if item is None:
        raise _not_found("tồn kho")
    product = db.get(Product, item.product_id)
    _record_activity(
        db, current_user, "Xóa", "delete", "Tồn kho", product.code if product else "",
        "Xóa bản ghi tồn kho",
    )
    db.delete(item)
    db.commit()
    return {"message": "Đã xóa bản ghi tồn kho", "id": inventory_id}


def _replace_invoice_items(db: Session, invoice: Invoice, items) -> None:
    old_details = db.query(InvoiceDetail).filter(InvoiceDetail.invoice_id == invoice.id).all()
    for detail in old_details:
        inventory = db.query(Inventory).filter(Inventory.product_id == detail.product_id).first()
        if inventory:
            inventory.quantity += detail.quantity
        db.delete(detail)

    total = Decimal("0")
    for item in items:
        product = db.get(Product, item.productId)
        if product is None or not product.is_active:
            raise HTTPException(status_code=400, detail="Sản phẩm không tồn tại hoặc đã ngừng bán")
        inventory = db.query(Inventory).filter(Inventory.product_id == product.id).first()
        if inventory is None or inventory.quantity < item.quantity:
            raise HTTPException(status_code=409, detail=f"Không đủ tồn kho cho {product.name}")
        price = Decimal(str(item.unitPrice)) if item.unitPrice is not None else product.selling_price
        discount = Decimal(str(item.discount))
        amount = price * item.quantity - discount
        inventory.quantity -= item.quantity
        db.add(
            InvoiceDetail(
                invoice_id=invoice.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=price,
                discount=discount,
                amount=amount,
            )
        )
        total += amount
    invoice.total_amount = total
    invoice.final_amount = max(Decimal("0"), total - invoice.discount)


INVOICE_READ_PERMISSIONS = (
    "invoice_search",
    "revenue_statistics",
    "top_products",
    "report_export",
    "sales_data_qa",
    "history_view",
)


@router.get("/invoices")
def list_invoices(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_any_permission(*INVOICE_READ_PERMISSIONS)),
):
    invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).all()
    return [_invoice_dict(db, item, include_items=False) for item in invoices]


@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_any_permission(*INVOICE_READ_PERMISSIONS)),
):
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise _not_found("hóa đơn")
    return _invoice_dict(db, invoice)


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoice_create")),
):
    if data.customerId and db.get(Customer, data.customerId) is None:
        raise _not_found("khách hàng")
    invoice = Invoice(
        invoice_code=data.invoiceCode or f"HD{datetime.now():%Y%m%d}-{uuid4().hex[:6].upper()}",
        customer_id=data.customerId,
        user_id=current_user.id,
        total_amount=0,
        discount=Decimal(str(data.discount)),
        final_amount=0,
        payment_method=data.paymentMethod,
    )
    db.add(invoice)
    db.flush()
    _replace_invoice_items(db, invoice, data.items)
    _record_activity(
        db, current_user, "Tạo", "create", "Hóa đơn", invoice.invoice_code,
        f"Tạo hóa đơn gồm {len(data.items)} mặt hàng, tổng tiền {invoice.final_amount}",
    )
    _record_activity(
        db, current_user, "Xuất", "update", "Tồn kho", invoice.invoice_code,
        f"Giảm tồn kho theo hóa đơn {invoice.invoice_code}",
    )
    _commit(db, "Mã hóa đơn đã tồn tại")
    db.refresh(invoice)
    return _invoice_dict(db, invoice)


@router.put("/invoices/{invoice_id}")
def update_invoice(
    invoice_id: int,
    data: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoice_create")),
):
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise _not_found("hóa đơn")
    if "customerId" in data.model_fields_set:
        if data.customerId and db.get(Customer, data.customerId) is None:
            raise _not_found("khách hàng")
        invoice.customer_id = data.customerId
    if data.paymentMethod is not None:
        invoice.payment_method = data.paymentMethod
    if data.discount is not None:
        invoice.discount = Decimal(str(data.discount))
    if data.items is not None:
        _replace_invoice_items(db, invoice, data.items)
    else:
        invoice.final_amount = max(Decimal("0"), invoice.total_amount - invoice.discount)
    _record_activity(
        db, current_user, "Cập nhật", "update", "Hóa đơn", invoice.invoice_code,
        f"Cập nhật hóa đơn, tổng tiền {invoice.final_amount}",
    )
    if data.items is not None:
        _record_activity(
            db, current_user, "Điều chỉnh", "update", "Tồn kho", invoice.invoice_code,
            f"Điều chỉnh tồn kho theo hóa đơn {invoice.invoice_code}",
        )
    _commit(db)
    db.refresh(invoice)
    return _invoice_dict(db, invoice)


@router.delete("/invoices/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoice_create")),
):
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise _not_found("hóa đơn")
    details = db.query(InvoiceDetail).filter(InvoiceDetail.invoice_id == invoice.id).all()
    for detail in details:
        inventory = db.query(Inventory).filter(Inventory.product_id == detail.product_id).first()
        if inventory:
            inventory.quantity += detail.quantity
        db.delete(detail)
    _record_activity(
        db, current_user, "Xóa", "delete", "Hóa đơn", invoice.invoice_code,
        f"Xóa hóa đơn và hoàn lại tồn kho: {invoice.invoice_code}",
    )
    _record_activity(
        db, current_user, "Hoàn", "update", "Tồn kho", invoice.invoice_code,
        f"Hoàn tồn kho do xóa hóa đơn {invoice.invoice_code}",
    )
    db.flush()
    db.delete(invoice)
    db.commit()
    return {"message": "Đã xóa hóa đơn và hoàn tồn kho", "id": invoice_id}


def _replace_purchase_items(db: Session, receipt: PurchaseReceipt, items) -> None:
    old_details = (
        db.query(PurchaseReceiptDetail)
        .filter(PurchaseReceiptDetail.receipt_id == receipt.id)
        .all()
    )
    for detail in old_details:
        inventory = db.query(Inventory).filter(Inventory.product_id == detail.product_id).first()
        if inventory is None or inventory.quantity < detail.quantity:
            raise HTTPException(status_code=409, detail="Không thể hoàn tác tồn kho phiếu nhập")
        inventory.quantity -= detail.quantity
        db.delete(detail)

    total = Decimal("0")
    for item in items:
        product = db.get(Product, item.productId)
        if product is None:
            raise _not_found("sản phẩm")
        inventory = db.query(Inventory).filter(Inventory.product_id == product.id).first()
        if inventory is None:
            inventory = Inventory(product_id=product.id, quantity=0, min_quantity=10)
            db.add(inventory)
            db.flush()
        price = Decimal(str(item.unitPrice)) if item.unitPrice is not None else product.purchase_price
        amount = price * item.quantity
        inventory.quantity += item.quantity
        db.add(
            PurchaseReceiptDetail(
                receipt_id=receipt.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=price,
                amount=amount,
            )
        )
        total += amount
    receipt.total_amount = total


PURCHASE_READ_PERMISSIONS = ("purchase_track", "report_export", "history_view")


@router.get("/purchases")
def list_purchases(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_any_permission(*PURCHASE_READ_PERMISSIONS)),
):
    receipts = db.query(PurchaseReceipt).order_by(PurchaseReceipt.created_at.desc()).all()
    return [_purchase_dict(db, item, include_items=False) for item in receipts]


@router.get("/purchases/{receipt_id}")
def get_purchase(
    receipt_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_any_permission(*PURCHASE_READ_PERMISSIONS)),
):
    receipt = db.get(PurchaseReceipt, receipt_id)
    if receipt is None:
        raise _not_found("phiếu nhập")
    return _purchase_dict(db, receipt)


@router.post("/purchases", status_code=status.HTTP_201_CREATED)
def create_purchase(
    data: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchase_track")),
):
    receipt = PurchaseReceipt(
        receipt_code=data.receiptCode or f"PN{datetime.now():%Y%m%d}-{uuid4().hex[:6].upper()}",
        user_id=current_user.id,
        supplier_name=data.supplierName.strip(),
        total_amount=0,
    )
    db.add(receipt)
    db.flush()
    _replace_purchase_items(db, receipt, data.items)
    _record_activity(
        db, current_user, "Nhập", "import", "Phiếu nhập", receipt.receipt_code,
        f"Tạo phiếu nhập từ {receipt.supplier_name}, tổng tiền {receipt.total_amount}",
    )
    _record_activity(
        db, current_user, "Nhập", "update", "Tồn kho", receipt.receipt_code,
        f"Tăng tồn kho theo phiếu nhập {receipt.receipt_code}",
    )
    _commit(db, "Mã phiếu nhập đã tồn tại")
    db.refresh(receipt)
    return _purchase_dict(db, receipt)


@router.put("/purchases/{receipt_id}")
def update_purchase(
    receipt_id: int,
    data: PurchaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchase_track")),
):
    receipt = db.get(PurchaseReceipt, receipt_id)
    if receipt is None:
        raise _not_found("phiếu nhập")
    if data.supplierName is not None:
        receipt.supplier_name = data.supplierName.strip()
    if data.items is not None:
        _replace_purchase_items(db, receipt, data.items)
    _record_activity(
        db, current_user, "Cập nhật", "update", "Phiếu nhập", receipt.receipt_code,
        f"Cập nhật phiếu nhập từ {receipt.supplier_name}, tổng tiền {receipt.total_amount}",
    )
    if data.items is not None:
        _record_activity(
            db, current_user, "Điều chỉnh", "update", "Tồn kho", receipt.receipt_code,
            f"Điều chỉnh tồn kho theo phiếu nhập {receipt.receipt_code}",
        )
    _commit(db)
    db.refresh(receipt)
    return _purchase_dict(db, receipt)


@router.delete("/purchases/{receipt_id}")
def delete_purchase(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchase_track")),
):
    receipt = db.get(PurchaseReceipt, receipt_id)
    if receipt is None:
        raise _not_found("phiếu nhập")
    details = (
        db.query(PurchaseReceiptDetail)
        .filter(PurchaseReceiptDetail.receipt_id == receipt.id)
        .all()
    )
    for detail in details:
        inventory = db.query(Inventory).filter(Inventory.product_id == detail.product_id).first()
        if inventory is None or inventory.quantity < detail.quantity:
            raise HTTPException(status_code=409, detail="Không đủ tồn kho để xóa phiếu nhập")
        inventory.quantity -= detail.quantity
        db.delete(detail)
    _record_activity(
        db, current_user, "Xóa", "delete", "Phiếu nhập", receipt.receipt_code,
        f"Xóa phiếu nhập từ {receipt.supplier_name}: {receipt.receipt_code}",
    )
    _record_activity(
        db, current_user, "Hoàn", "update", "Tồn kho", receipt.receipt_code,
        f"Giảm tồn kho do xóa phiếu nhập {receipt.receipt_code}",
    )
    db.flush()
    db.delete(receipt)
    db.commit()
    return {"message": "Đã xóa phiếu nhập và cập nhật tồn kho", "id": receipt_id}
