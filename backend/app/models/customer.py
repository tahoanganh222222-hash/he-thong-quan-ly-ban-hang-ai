from sqlalchemy import String, Unicode
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Customer(Base):
    __tablename__ = "Customers"

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
        Unicode(100),
        nullable=False
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    email: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    address: Mapped[str | None] = mapped_column(
        Unicode(255),
        nullable=True
    )

    customer_group: Mapped[str | None] = mapped_column(
        Unicode(50),
        nullable=True
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False
    )
