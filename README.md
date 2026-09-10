# Hệ thống quản lý bán hàng có tích hợp AI

Ứng dụng quản lý bán hàng dành cho cửa hàng bán lẻ, gồm quản lý sản phẩm,
danh mục, khách hàng, hóa đơn, nhập hàng, tồn kho, lịch sử hoạt động, thống kê,
báo cáo, người dùng, phân quyền và ba chức năng AI sử dụng Google Gemini.

## Công nghệ

- Backend: Python, FastAPI, SQLAlchemy và pyodbc.
- Frontend: HTML, CSS và JavaScript thuần.
- Database: Microsoft SQL Server.
- AI: Google Gemini API, được gọi từ backend.

Frontend không giữ Gemini API key và không gọi trực tiếp Gemini. Các chức năng
AI lấy dữ liệu bán hàng từ SQL Server thông qua backend và tuân theo quyền của
tài khoản đang đăng nhập.

Mỗi phản hồi Gemini thành công được lưu tại **Lịch sử → Nhật ký AI**, gồm người
dùng, tính năng, câu hỏi, phản hồi, số token và thời gian yêu cầu. Tab
**Lịch sử hoạt động** ghi cả các phiên đăng nhập, đăng xuất và thao tác nghiệp vụ.
Quyền xem từng loại nhật ký có thể cấu hình trong màn hình **Phân quyền**.

## Cấu trúc dự án

```text
sales-management/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   └── services/
│   └── requirements.txt
├── frontend/
│   ├── css/
│   ├── js/
│   └── index.html
├── docs/
├── prompts/
├── tests/
├── .env
├── .env.example
└── README.md
```

Luồng xử lý chính:

```text
Frontend (cổng 5500)
        ↓ REST API
FastAPI Backend (cổng 8000)
        ↓
SQLAlchemy + pyodbc
        ↓
Microsoft SQL Server
```

Các yêu cầu AI đi từ frontend tới FastAPI; backend kết hợp dữ liệu SQL Server
với Google Gemini rồi mới trả kết quả về giao diện.

## Yêu cầu trước khi cài đặt

- Python 3.11 trở lên.
- Microsoft SQL Server đang chạy.
- TCP/IP của SQL Server đã bật và lắng nghe tại cổng `1433`.
- ODBC Driver 17 for SQL Server. Nếu máy đang dùng phiên bản khác, sửa
  `DB_DRIVER` trong `.env` cho đúng tên driver đã cài.
- Google Gemini API key nếu muốn sử dụng ba chức năng AI.

Ứng dụng hiện dùng Windows Authentication để kết nối SQL Server
(`Trusted_Connection=yes`), vì vậy tài khoản Windows chạy backend phải có quyền
truy cập database.

## Chuẩn bị SQL Server

Mở SSMS và tạo database nếu database này chưa tồn tại:

```sql
CREATE DATABASE SalesManagement;
```

Backend sẽ tự tạo các bảng và thêm dữ liệu ban đầu còn thiếu trong lần khởi
động đầu tiên. Dữ liệu đã có trong database sẽ được giữ lại.

## Cấu hình `.env`

Tại thư mục gốc của dự án, sao chép `.env.example` thành `.env` nếu chưa có:

```powershell
Copy-Item .\.env.example .\.env
```

Không chạy lệnh trên nếu `.env` đã chứa Gemini API key hoặc cấu hình riêng của
bạn. Cấu hình local điển hình:

```env
APP_NAME=Hệ thống quản lý bán hàng có tích hợp AI
APP_VERSION=1.0.0
APP_DEBUG=True

BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_ORIGIN=http://127.0.0.1:5500

DB_SERVER=localhost
DB_PORT=1433
DB_NAME=SalesManagement
DB_DRIVER=ODBC Driver 17 for SQL Server
DB_TRUST_SERVER_CERTIFICATE=True
DB_ENCRYPT=False

SECRET_KEY=thay-bang-mot-chuoi-bi-mat-dai
ACCESS_TOKEN_EXPIRE_MINUTES=120

GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.6-flash
GEMINI_TIMEOUT_SECONDS=30
```

Không đưa `.env` hoặc Gemini API key vào Git. Sau khi sửa `.env`, nhấn
`Ctrl+C` tại Terminal backend và chạy lại backend để nạp cấu hình mới.

## Cài thư viện lần đầu

Mở Terminal PowerShell tại `D:\HTML\sales-management`:

```powershell
cd D:\HTML\sales-management
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r .\backend\requirements.txt
```

Nếu Terminal đã hiện `(.venv)` hoặc `(venv)` trước `PS`, môi trường ảo đã được
kích hoạt và có thể bỏ qua lệnh kích hoạt. Dự án nên dùng `.venv` ở thư mục gốc
để tránh nhầm giữa nhiều môi trường Python.

## Mở ứng dụng mỗi lần sử dụng

Cần giữ **hai Terminal chạy cùng lúc**.

### Terminal 1 — Backend FastAPI

```powershell
cd D:\HTML\sales-management
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
cd .\backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Lệnh đúng là `uvicorn`, không phải `vicorn`. Nên dùng `python -m uvicorn` để
chắc chắn Uvicorn được chạy từ đúng môi trường ảo.

Khi Terminal hiện `Application startup complete`, backend đã sẵn sàng:

- API: <http://127.0.0.1:8000>
- Swagger: <http://127.0.0.1:8000/docs>
- Kiểm tra hệ thống và database: <http://127.0.0.1:8000/health>

### Terminal 2 — Frontend

Mở một Terminal mới và chạy:

```powershell
cd D:\HTML\sales-management
python -m http.server 5500 --directory .\frontend
```

Sau đó mở:

- Giao diện: <http://127.0.0.1:5500>

Có thể dùng Live Server của VS Code thay cho lệnh trên, nhưng Live Server phải
chạy đúng cổng `5500`. Không mở trực tiếp `frontend/index.html` bằng đường dẫn
`file:///...` vì frontend cần gọi REST API.

## Kiểm tra kết nối database

Khi môi trường ảo đã được kích hoạt:

```powershell
cd D:\HTML\sales-management\backend
python -c "from app.core.database import test_database_connection; print(test_database_connection())"
```

Kết quả đúng là `True`.

## Tài khoản ban đầu

Các tài khoản chỉ được tạo khi username tương ứng chưa có trong database:

| Tên đăng nhập | Vai trò | Mật khẩu ban đầu |
| --- | --- | --- |
| `admin` | Quản trị viên | `123456` |
| `owner01` | Chủ cửa hàng | `123456` |
| `staff01` | Nhân viên | `123456` |
| `user01` | Khách hàng | `123456` |

Nên đổi mật khẩu sau khi đăng nhập nếu sử dụng ngoài môi trường học tập/local.

## Xử lý lỗi thường gặp

### `127.0.0.1:5500` từ chối kết nối

Terminal frontend đã dừng hoặc chưa được mở. Chạy lại:

```powershell
cd D:\HTML\sales-management
python -m http.server 5500 --directory .\frontend
```

### Frontend hiện thông báo không tải được dữ liệu

Kiểm tra Terminal backend còn chạy và mở <http://127.0.0.1:8000/health>.
Nếu backend đã dừng, chạy lại lệnh `python -m uvicorn` ở Terminal 1.

### Không kết nối được SQL Server

Kiểm tra lần lượt:

1. Dịch vụ `SQL Server (MSSQLSERVER)` đang chạy.
2. TCP/IP đã được bật trong SQL Server Configuration Manager.
3. `TCP Port` tại `IPAll` là `1433` và `TCP Dynamic Ports` để trống.
4. SQL Server đã được khởi động lại sau khi đổi TCP/IP.
5. `DB_SERVER`, `DB_PORT`, `DB_NAME` và `DB_DRIVER` trong `.env` đúng với máy.

Kiểm tra cổng bằng PowerShell:

```powershell
Test-NetConnection 127.0.0.1 -Port 1433
```

Kết quả cần có `TcpTestSucceeded : True`.

### Cổng 8000 hoặc 5500 đang bị chiếm

Xem PID của tiến trình đang dùng cổng:

```powershell
netstat -ano | findstr :8000
netstat -ano | findstr :5500
```

Chỉ dừng PID khi bạn xác định đó là tiến trình backend/frontend cũ của dự án:

```powershell
Stop-Process -Id <PID> -Force
```

Nhấn `Ctrl+C` trong từng Terminal để tắt backend hoặc frontend đúng cách.
