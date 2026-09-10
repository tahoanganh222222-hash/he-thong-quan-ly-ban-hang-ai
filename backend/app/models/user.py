from sqlalchemy import Boolean, String, Unicode, UnicodeText
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    __tablename__ = "Users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    full_name: Mapped[str] = mapped_column(
        Unicode(100),
        nullable=False
    )

    phone: Mapped[str | None] = mapped_column(
        Unicode(20),
        nullable=True
    )

    email: Mapped[str | None] = mapped_column(
        Unicode(100),
        nullable=True
    )

    avatar_data: Mapped[str | None] = mapped_column(
        UnicodeText,
        nullable=True
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
