from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import SessionLocal, engine, test_database_connection
from app.models import Base
from app.routers.auth import router as auth_router
from app.routers.ai import router as ai_router
from app.routers.sales import router as sales_router
from app.services.migrations import migrate_unicode_columns
from app.services.seed import seed_initial_data


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_unicode_columns(engine)
    with SessionLocal() as db:
        seed_initial_data(db)
    yield


app = FastAPI(
    title="Sales Management System",
    description="Hệ thống quản lý bán hàng có tích hợp AI",
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Authentication
app.include_router(auth_router)
app.include_router(sales_router)
app.include_router(ai_router)


@app.get("/")
def root():
    return {
        "message": "Sales Management API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "backend": True,
        "database": test_database_connection(),
    }
