from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RolePermission(Base):
    __tablename__ = "RolePermissions"
    __table_args__ = (
        UniqueConstraint("role", "permission_key", name="UQ_RolePermissions_role_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    permission_key: Mapped[str] = mapped_column(String(50), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
