from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Unicode, UnicodeText
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ActivityLog(Base):
    __tablename__ = "ActivityLogs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("Users.id"), nullable=False)
    action: Mapped[str] = mapped_column(Unicode(30), nullable=False)
    action_type: Mapped[str] = mapped_column(String(30), nullable=False)
    object_type: Mapped[str] = mapped_column(Unicode(50), nullable=False)
    object_code: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    detail: Mapped[str] = mapped_column(UnicodeText, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        nullable=False,
    )
