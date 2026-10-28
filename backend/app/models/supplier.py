from sqlalchemy import Unicode
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Supplier(Base):
    __tablename__ = "Suppliers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Unicode(150), unique=True)
    phone: Mapped[str | None] = mapped_column(Unicode(20), nullable=True)
    email: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Unicode(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
