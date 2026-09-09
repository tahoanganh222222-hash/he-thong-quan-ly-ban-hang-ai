from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(
        min_length=1,
        max_length=50
    )

    password: str = Field(
        min_length=1,
        max_length=255
    )


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool


class LoginResponse(BaseModel):
    message: str
    access_token: str
    token_type: str
    user: UserResponse


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=72)
    fullName: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=100)
    role: str = Field(pattern="^(admin|owner|staff|customer)$")
    isActive: bool = True


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=1, max_length=50)
    password: Optional[str] = Field(default=None, min_length=1, max_length=72)
    fullName: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=100)
    role: Optional[str] = Field(default=None, pattern="^(admin|owner|staff|customer)$")
    isActive: Optional[bool] = None
