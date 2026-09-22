from sqlalchemy import Unicode, UnicodeText
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Category(Base):
    __tablename__ = "Categories"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    name: Mapped[str] = mapped_column(
        Unicode(100),
        unique=True,
        nullable=False
    )

    description: Mapped[str | None] = mapped_column(
        Unicode(255),
        nullable=True
    )

    image_data: Mapped[str | None] = mapped_column(
        UnicodeText,
        nullable=True
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False
    )
