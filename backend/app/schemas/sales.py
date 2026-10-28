from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator
import re


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    isActive: bool = True
    imageData: Optional[str] = Field(default=None, max_length=2_800_000)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    isActive: Optional[bool] = None
    imageData: Optional[str] = Field(default=None, max_length=2_800_000)


class ProductCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    category: str = Field(min_length=1, max_length=100)
    purchasePrice: float = Field(ge=0)
    sellingPrice: float = Field(ge=0)
    unit: str = Field(min_length=1, max_length=30)
    isActive: bool = True
    stock: int = Field(default=0, ge=0)
    minimum: int = Field(default=10, ge=0)
    imageData: Optional[str] = Field(default=None, max_length=2_800_000)


class ProductUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    purchasePrice: Optional[float] = Field(default=None, ge=0)
    sellingPrice: Optional[float] = Field(default=None, ge=0)
    unit: Optional[str] = Field(default=None, min_length=1, max_length=30)
    isActive: Optional[bool] = None
    imageData: Optional[str] = Field(default=None, max_length=2_800_000)


class CustomerCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    customerGroup: Optional[str] = Field(default=None, max_length=50)
    isActive: bool = True


class CustomerUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    customerGroup: Optional[str] = Field(default=None, max_length=50)
    isActive: Optional[bool] = None


class InventoryCreate(BaseModel):
    productId: int
    quantity: int = Field(default=0, ge=0)
    minimum: int = Field(default=0, ge=0)


class InventoryUpdate(BaseModel):
    quantity: Optional[int] = Field(default=None, ge=0)
    minimum: Optional[int] = Field(default=None, ge=0)


class DocumentItem(BaseModel):
    productId: int
    quantity: int = Field(gt=0)
    unitPrice: Optional[float] = Field(default=None, ge=0)
    discount: float = Field(default=0, ge=0)


class InvoiceCreate(BaseModel):
    invoiceCode: Optional[str] = Field(default=None, max_length=50)
    customerId: Optional[int] = None
    userId: Optional[int] = None
    discount: float = Field(default=0, ge=0)
    paymentMethod: str = Field(default="cash", max_length=30)
    items: list[DocumentItem] = Field(min_length=1)


class InvoiceUpdate(BaseModel):
    customerId: Optional[int] = None
    discount: Optional[float] = Field(default=None, ge=0)
    paymentMethod: Optional[str] = Field(default=None, max_length=30)
    items: Optional[list[DocumentItem]] = None


class PurchaseCreate(BaseModel):
    receiptCode: Optional[str] = Field(default=None, max_length=50)
    supplierName: Optional[str] = Field(default=None, min_length=1, max_length=150)
    supplierId: Optional[int] = Field(default=None, gt=0)
    purchaseDate: Optional[date] = None
    userId: Optional[int] = None
    items: list[DocumentItem] = Field(min_length=1)


class PurchaseUpdate(BaseModel):
    supplierName: Optional[str] = Field(default=None, min_length=1, max_length=150)
    items: Optional[list[DocumentItem]] = None


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)

    @field_validator("name", "phone", "email", "address", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        if value and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Email không hợp lệ")
        return value or None


class SupplierUpdate(SupplierCreate):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    isActive: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def name_cannot_be_null(cls, value):
        if value is None:
            raise ValueError("Tên nhà cung cấp không được để trống")
        return value


class HistoryCreate(BaseModel):
    action: str = Field(min_length=1, max_length=30)
    actionType: str = Field(min_length=1, max_length=30)
    object: str = Field(min_length=1, max_length=50)
    code: str = Field(default="", max_length=50)
    detail: str = Field(default="", max_length=1000)
