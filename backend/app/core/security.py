from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


ALGORITHM = "HS256"

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str) -> str:
    """
    Hash mật khẩu trước khi lưu vào database.
    """
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    password_hash: str
) -> bool:
    """
    Kiểm tra mật khẩu người dùng nhập
    với password hash trong database.
    """
    return pwd_context.verify(
        plain_password,
        password_hash
    )


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