from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import PERMISSION_KEYS
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password
)
from app.dependencies.auth import get_current_user, require_permission
from app.models.role_permission import RolePermission
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    UserCreate,
    UserUpdate,
    UserResponse
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


def _management_user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "fullName": user.full_name,
        "phone": user.phone or "",
        "email": user.email or "",
        "role": user.role,
        "isActive": user.is_active,
    }


def _commit_user(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Tên tài khoản đã tồn tại") from exc


def _ensure_manageable(target: User, current_user: User) -> None:
    if target.role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên được sửa tài khoản admin")


@router.post(
    "/login",
    response_model=LoginResponse
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Đăng nhập hệ thống.
    """

    user = (
        db.query(User)
        .filter(
            User.username == login_data.username
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị khóa"
        )

    if not verify_password(
        login_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng"
        )

    if user.role != "admin":
        login_permission = (
            db.query(RolePermission)
            .filter(
                RolePermission.role == user.role,
                RolePermission.permission_key == "login",
            )
            .first()
        )
        if login_permission is None or not login_permission.allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền đăng nhập hệ thống",
            )

    access_token = create_access_token(
        user_id=user.id,
        username=user.username,
        role=user.role
    )

    return LoginResponse(
        message="Đăng nhập thành công",
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active
        )
    )


@router.get(
    "/me",
    response_model=UserResponse
)
def get_me(
    current_user: User = Depends(get_current_user)
):
    """
    Lấy thông tin tài khoản đang đăng nhập.
    """

    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active
    )


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("user_manage")),
):
    return [_management_user_dict(user) for user in db.query(User).order_by(User.id).all()]


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user_manage")),
):
    if data.role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên được tạo tài khoản admin")
    user = User(
        username=data.username.strip(),
        password_hash=hash_password(data.password),
        full_name=data.fullName.strip(),
        phone=data.phone.strip() if data.phone else None,
        email=data.email.strip() if data.email else None,
        role=data.role,
        is_active=data.isActive,
    )
    db.add(user)
    _commit_user(db)
    db.refresh(user)
    return _management_user_dict(user)


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user_manage")),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    _ensure_manageable(user, current_user)
    changes = data.model_dump(exclude_unset=True)
    if user.id == current_user.id and changes.get("isActive") is False:
        raise HTTPException(status_code=400, detail="Không thể tự khóa tài khoản đang đăng nhập")
    if (
        user.id == current_user.id
        and "role" in changes
        and changes["role"] != current_user.role
    ):
        raise HTTPException(status_code=400, detail="Không thể tự thay đổi vai trò đang đăng nhập")
    if changes.get("role") == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên được cấp quyền admin")
    field_map = {"fullName": "full_name", "isActive": "is_active"}
    for key, value in changes.items():
        if key == "password":
            user.password_hash = hash_password(value)
            continue
        if isinstance(value, str):
            value = value.strip() or None
        setattr(user, field_map.get(key, key), value)
    _commit_user(db)
    db.refresh(user)
    return _management_user_dict(user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user_manage")),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    _ensure_manageable(user, current_user)
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể tự xóa tài khoản đang đăng nhập")
    try:
        db.delete(user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Tài khoản đã phát sinh chứng từ nên chỉ có thể khóa",
        ) from exc
    return {"message": "Đã xóa tài khoản", "id": user_id}


@router.get("/permissions")
def list_permissions(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    result = {}
    role_names = {
        "admin": "ADMIN",
        "owner": "OWNER",
        "staff": "SALES",
        "customer": "CUSTOMER",
    }
    for role, frontend_role in role_names.items():
        rows = db.query(RolePermission).filter(RolePermission.role == role).all()
        result[frontend_role] = {key: False for key in PERMISSION_KEYS}
        for row in rows:
            result[frontend_role][row.permission_key] = row.allowed
    result["ADMIN"] = {key: True for key in PERMISSION_KEYS}
    return result


@router.put("/permissions/{role}")
def update_permissions(
    role: str,
    permissions: dict[str, bool],
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("permission")),
):
    backend_roles = {
        "ADMIN": "admin",
        "OWNER": "owner",
        "SALES": "staff",
        "CUSTOMER": "customer",
    }
    role_key = role.upper()
    if role_key not in backend_roles:
        raise HTTPException(status_code=400, detail="Vai trò không hợp lệ")
    if role_key == "ADMIN":
        raise HTTPException(status_code=400, detail="Quản trị viên luôn có toàn quyền")
    unknown_keys = set(permissions) - PERMISSION_KEYS
    if unknown_keys:
        raise HTTPException(status_code=400, detail="Quyền không hợp lệ")
    backend_role = backend_roles[role_key]
    rows = {
        row.permission_key: row
        for row in db.query(RolePermission)
        .filter(RolePermission.role == backend_role)
        .all()
    }
    for permission_key in PERMISSION_KEYS:
        row = rows.get(permission_key)
        if row is None:
            row = RolePermission(role=backend_role, permission_key=permission_key)
            db.add(row)
        row.allowed = permissions.get(permission_key, False)
    db.commit()
    return {permission_key: permissions.get(permission_key, False) for permission_key in PERMISSION_KEYS}
