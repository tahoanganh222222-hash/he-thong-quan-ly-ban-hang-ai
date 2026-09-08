# Hệ thống quản lý bán hàng có tích hợp AI

Hệ thống quản lý bán hàng cho cửa hàng bán lẻ hàng tiêu dùng
tổng hợp quy mô vừa có tích hợp AI.

## Công nghệ

### Backend

- Python
- FastAPI
- SQLAlchemy
- pyodbc

### Frontend

- HTML
- CSS
- JavaScript

### Database

- Microsoft SQL Server
- SQL Server Management Studio (SSMS)

### AI

- Google Gemini API

AI sẽ được tích hợp ở các module AI sau.

---

# Cấu trúc project

sales-management/

├── backend/

│   ├── app/

│   │   ├── core/

│   │   ├── models/

│   │   ├── schemas/

│   │   ├── routers/

│   │   └── services/

│   └── requirements.txt

│

├── frontend/

│   ├── index.html

│   ├── css/

│   └── js/

│

├── prompts/

├── docs/

├── tests/

├── .env

├── .env.example

└── README.md

---

# Kiến trúc

Frontend
    ↓
HTTP / REST API
    ↓
FastAPI Backend
    ↓
SQLAlchemy + pyodbc
    ↓
Microsoft SQL Server

Đối với AI:

Frontend
    ↓
FastAPI Backend
    ↓
AIService
    ↓
SQL Server + Google Gemini API

Frontend không gọi trực tiếp Gemini API.

---

# Chạy Backend

Mở terminal tại thư mục backend:

cd backend

Tạo virtual environment:

python -m venv venv

Windows:

venv\Scripts\activate

Cài thư viện:

pip install -r requirements.txt

Chạy:

uvicorn app.main:app --reload

Backend mặc định:

http://127.0.0.1:8000

Swagger:

http://127.0.0.1:8000/docs

---

# Frontend

Có thể mở frontend bằng Live Server trong VS Code.

Mở:

frontend/index.html

Frontend gọi Backend tại:

http://127.0.0.1:8000