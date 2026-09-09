from pydantic_settings import BaseSettings, SettingsConfigDict


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

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
