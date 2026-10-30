"""Apply document changes atomically, holding SQL Server stock locks to commit."""
from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException

from app.models import Inventory, InvoiceDetail, Product, PurchaseReceiptDetail


def locked_document(db, model, document_id):
    document = (db.query(model)
                .with_hint(model, "WITH (UPDLOCK, HOLDLOCK)", dialect_name="mssql")
                .filter(model.id == document_id).populate_existing().first())
    if document is None:
        raise HTTPException(404, "Không tìm thấy chứng từ")
    return document


def require_active(document):
    if document.status == "cancelled":
        raise HTTPException(409, "Chứng từ đã hủy, không thể sửa hoặc hủy lại")


def locked_stock(db, product_ids):
    return {row.product_id: row for row in db.query(Inventory)
            .with_hint(Inventory, "WITH (UPDLOCK, HOLDLOCK)", dialect_name="mssql")
            .filter(Inventory.product_id.in_(sorted(product_ids)))
            .order_by(Inventory.product_id).populate_existing().all()}


def replace_items(db, document, items, *, sale):
    require_active(document)
    if not items:
        raise HTTPException(400, "Chứng từ phải có ít nhất một mặt hàng")
    product_ids = [item.productId for item in items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(400, "Mỗi sản phẩm chỉ được xuất hiện một lần trong chứng từ")
    model = InvoiceDetail if sale else PurchaseReceiptDetail
    field = model.invoice_id if sale else model.receipt_id
    old_rows = db.query(model).filter(field == document.id).all()
    old_quantity = defaultdict(int)
    for row in old_rows:
        old_quantity[row.product_id] += row.quantity
    stocks = locked_stock(db, set(product_ids) | set(old_quantity))
    products = {row.id: row for row in db.query(Product).filter(Product.id.in_(product_ids))}
    prepared = []
    total = Decimal("0")
    for item in items:
        product = products.get(item.productId)
        if product is None or (sale and not product.is_active):
            raise HTTPException(400, "Sản phẩm không tồn tại hoặc đã ngừng bán")
        price = (Decimal(str(item.unitPrice)) if item.unitPrice is not None else
                 (product.selling_price if sale else product.purchase_price))
        discount = Decimal(str(item.discount)) if sale else Decimal("0")
        amount = price * item.quantity - discount
        if amount < 0:
            raise HTTPException(400, "Giảm giá không được vượt quá thành tiền sản phẩm")
        values = dict(product_id=product.id, quantity=item.quantity, unit_price=price, amount=amount)
        if sale:
            values.update(invoice_id=document.id, discount=discount)
        else:
            values.update(receipt_id=document.id)
        prepared.append(values)
        total += amount
    new_quantity = {item.productId: item.quantity for item in items}
    balances = {}
    for product_id in sorted(set(product_ids) | set(old_quantity)):
        stock = stocks.get(product_id)
        change = new_quantity.get(product_id, 0) - old_quantity[product_id]
        quantity = (stock.quantity if stock else 0) + (-change if sale else change)
        if quantity < 0:
            raise HTTPException(409, "Không đủ tồn kho để thực hiện thay đổi chứng từ")
        if stock is None and sale:
            raise HTTPException(409, "Sản phẩm chưa có bản ghi tồn kho")
        balances[product_id] = quantity
    for product_id, quantity in balances.items():
        stock = stocks.get(product_id)
        if stock is None:
            stock = Inventory(product_id=product_id, quantity=0, min_quantity=10)
            db.add(stock)
        stock.quantity = quantity
    for row in old_rows:
        db.delete(row)
    db.flush()
    db.add_all(model(**values) for values in prepared)
    document.total_amount = total
    if sale:
        document.discount = min(max(Decimal("0"), document.discount), total)
        document.final_amount = total - document.discount


def cancel_document(db, document, user, reason, *, sale):
    require_active(document)
    model = InvoiceDetail if sale else PurchaseReceiptDetail
    field = model.invoice_id if sale else model.receipt_id
    quantity = defaultdict(int)
    for row in db.query(model).filter(field == document.id):
        quantity[row.product_id] += row.quantity
    stocks = locked_stock(db, quantity)
    for product_id, amount in quantity.items():
        stock = stocks.get(product_id)
        if stock is None or (not sale and stock.quantity < amount):
            raise HTTPException(409, "Không đủ tồn kho để hủy phiếu nhập" if not sale else
                                "Thiếu bản ghi tồn kho, không thể hoàn hàng")
    for product_id, amount in quantity.items():
        stocks[product_id].quantity += amount if sale else -amount
    document.status = "cancelled"
    document.cancelled_at = datetime.now()
    document.cancelled_by = user.id
    document.cancellation_reason = reason
