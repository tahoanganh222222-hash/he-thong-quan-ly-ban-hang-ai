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