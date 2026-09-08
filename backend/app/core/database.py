from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


connection_string = (
    f"DRIVER={{{settings.DB_DRIVER}}};"
    f"SERVER={settings.DB_SERVER},{settings.DB_PORT};"
    f"DATABASE={settings.DB_NAME};"
    "Trusted_Connection=yes;"
    f"TrustServerCertificate="
    f"{'yes' if settings.DB_TRUST_SERVER_CERTIFICATE else 'no'};"
)

DATABASE_URL = (
    "mssql+pyodbc:///?odbc_connect="
    + quote_plus(connection_string)
)


engine = create_engine(
    DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_recycle=1800,
)


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def test_database_connection():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return True

    except Exception as e:
        print(f"Database connection error: {e}")
        return False