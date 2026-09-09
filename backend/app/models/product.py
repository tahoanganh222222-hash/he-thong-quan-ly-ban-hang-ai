from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Unicode
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Product(Base):
    __tablename__ = "Products"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )

    name: Mapped[str] = mapped_column(
        Unicode(150),
        nullable=False
    )

    category_id: Mapped[int] = mapped_column(
        ForeignKey("Categories.id"),
        nullable=False
    )

    purchase_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    selling_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    unit: Mapped[str] = mapped_column(
        Unicode(30),
        nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
