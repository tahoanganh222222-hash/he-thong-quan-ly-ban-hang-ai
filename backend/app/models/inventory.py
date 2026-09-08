from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Inventory(Base):
    __tablename__ = "Inventory"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("Products.id"),
        unique=True,
        nullable=False
    )

    quantity: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )

    min_quantity: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )