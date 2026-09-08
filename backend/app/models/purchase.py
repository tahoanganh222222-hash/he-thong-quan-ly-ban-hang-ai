from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PurchaseReceipt(Base):
    __tablename__ = "PurchaseReceipts"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    receipt_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("Users.id"),
        nullable=False
    )

    supplier_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        nullable=False
    )


class PurchaseReceiptDetail(Base):
    __tablename__ = "PurchaseReceiptDetails"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    receipt_id: Mapped[int] = mapped_column(
        ForeignKey("PurchaseReceipts.id"),
        nullable=False
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("Products.id"),
        nullable=False
    )

    quantity: Mapped[int] = mapped_column(
        nullable=False
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )