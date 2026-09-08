from fastapi import FastAPI

from app.routers.auth import router as auth_router


app = FastAPI(
    title="Sales Management System",
    description="Hệ thống quản lý bán hàng có tích hợp AI",
    version="1.0.0"
)


# Authentication
app.include_router(auth_router)


@app.get("/")
def root():
    return {
        "message": "Sales Management API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }