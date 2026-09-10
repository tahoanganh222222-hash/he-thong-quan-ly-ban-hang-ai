from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    APP_NAME: str = "Sales Management System"
    APP_DEBUG: bool = True

    DB_SERVER: str = "localhost"
    DB_PORT: int = 1433
    DB_NAME: str = "SalesManagement"
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    DB_TRUST_SERVER_CERTIFICATE: bool = True
    DB_ENCRYPT: bool = False

    # JWT
    SECRET_KEY: str = "CHANGE_THIS_SECRET_KEY"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # AI - sử dụng ở các phần sau
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_TIMEOUT_SECONDS: int = 30

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
