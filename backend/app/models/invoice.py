from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Invoice(Base):
    __tablename__ = "Invoices"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    invoice_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )

    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("Customers.id"),
        nullable=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("Users.id"),
        nullable=False
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    discount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        default=0,
        nullable=False
    )

    final_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    payment_method: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        nullable=False
    )


class InvoiceDetail(Base):
    __tablename__ = "InvoiceDetails"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("Invoices.id"),
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

    discount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        default=0,
        nullable=False
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )