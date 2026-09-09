from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    """
    Hash mật khẩu trước khi lưu vào database.
    """
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ValueError("Mật khẩu không được dài quá 72 byte")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(
    plain_password: str,
    password_hash: str
) -> bool:
    """
    Kiểm tra mật khẩu người dùng nhập
    với password hash trong database.
    """
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > 72:
        return False
    try:
        return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))
    except (TypeError, ValueError):
        return False


def create_access_token(
    user_id: int,
    username: str,
    role: str
) -> str:
    """
    Tạo JWT access token.
    """

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expire
    }

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_access_token(token: str) -> dict:
    """
    Giải mã và kiểm tra JWT token.
    """

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload

    except JWTError:
        raise ValueError("Token không hợp lệ hoặc đã hết hạn")
