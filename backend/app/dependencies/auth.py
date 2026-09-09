from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import ALGORITHM
from app.models.role_permission import RolePermission
from app.models.user import User


security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Lấy người dùng hiện tại từ JWT token.
    """

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token không hợp lệ"
            )

        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token không hợp lệ"
            )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn"
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Không tìm thấy tài khoản"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị khóa"
        )

    return user


def require_roles(
    *allowed_roles: str
) -> Callable:
    """
    Dependency dùng để giới hạn API theo role.

    Ví dụ:

    Depends(require_roles("Admin"))

    hoặc:

    Depends(require_roles("Admin", "Owner"))
    """

    def role_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập chức năng này"
            )

        return current_user

    return role_checker


def _has_permission(db: Session, user: User, permission_key: str) -> bool:
    if user.role == "admin":
        return True
    permission = (
        db.query(RolePermission)
        .filter(
            RolePermission.role == user.role,
            RolePermission.permission_key == permission_key,
        )
        .first()
    )
    return bool(permission and permission.allowed)


def require_permission(permission_key: str) -> Callable:
    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not _has_permission(db, current_user, permission_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền sử dụng chức năng này",
            )
        return current_user

    return permission_checker


def require_any_permission(*permission_keys: str) -> Callable:
    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not any(_has_permission(db, current_user, key) for key in permission_keys):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền sử dụng chức năng này",
            )
        return current_user

    return permission_checker
