from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UnicodeText
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AILog(Base):
    __tablename__ = "AILogs"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("Users.id"),
        nullable=True
    )

    ai_function: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    input_data: Mapped[str | None] = mapped_column(
        UnicodeText,
        nullable=True
    )

    output_data: Mapped[str | None] = mapped_column(
        UnicodeText,
        nullable=True
    )

    token_usage: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        nullable=False
    )
