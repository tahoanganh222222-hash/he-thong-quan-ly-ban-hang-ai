# Hệ thống quản lý bán hàng có tích hợp AI

Ứng dụng quản lý bán hàng dành cho cửa hàng bán lẻ, gồm quản lý sản phẩm,
danh mục, khách hàng, hóa đơn, nhập hàng, tồn kho, lịch sử hoạt động, thống kê,
báo cáo, người dùng, phân quyền và ba chức năng AI sử dụng Google Gemini.

## Kịch bản trình diễn

Xem [Kịch bản demo bán hàng](docs/KICH_BAN_DEMO.md) để trình diễn luồng lập hóa đơn,
đối chiếu tồn kho và doanh thu, xuất báo cáo và ba chức năng AI. Tài liệu có thao tác,
kết quả mong đợi và lời giới thiệu gợi ý cho buổi thuyết trình.

Xem thêm [Review bảo mật API key và phân quyền](docs/REVIEW_BAO_MAT_PHAN_QUYEN.md)
để biết phạm vi rà soát, kết quả kiểm thử, các điểm đã có bảo vệ và phát hiện cần xử lý.

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

API sản phẩm không trả trường giá nhập (`purchasePrice`) cho vai trò khách hàng;
giá bán và thông tin tồn kho vẫn được giữ như hiện tại. Đọc danh sách, chi tiết
và các dòng hàng của phiếu nhập cần quyền **Theo dõi nhập hàng** hoặc **Xuất báo cáo**.
Quyền **Xem lịch sử** chỉ cho phép xem nhật ký hoạt động, không cấp quyền đọc phiếu nhập.

Phiên đang mở tự đồng bộ quyền khoảng mỗi 2 giây và kiểm tra lại khi quay về tab.
Các tab cùng trình duyệt nhận thông báo đổi quyền ngay. Nếu bị thu hồi quyền của
trang đang xem, ứng dụng đóng cửa sổ chi tiết và đưa người dùng về Dashboard.
Tắt quyền **Đăng nhập / đăng xuất** kết thúc các phiên của vai trò đó; bật lại quyền
vẫn cần đăng nhập mới. Backend tự bổ sung cột `Users.session_version` khi khởi động
để token đã bị thu hồi không hoạt động lại.

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

### Bổ sung dữ liệu mẫu để thử giao diện

Để có thêm giao dịch gần đây, hàng sắp hết, hết hàng và ngừng kinh doanh, chạy
một lần tại thư mục gốc project:

```powershell
.\.venv\Scripts\python.exe .\backend\seed_demo.py
```

Toàn bộ bộ seed bổ sung gồm 18 sản phẩm, 6 khách hàng, 10 phiếu nhập và 28 hóa
đơn trong khoảng 4 tuần tính đến ngày chạy, kèm 76 bản ghi lịch sử hoạt động.
Các danh mục được tái sử dụng hoặc tạo khi chưa có: **Sữa và đồ uống**, **Hàng
tiêu dùng**, **Thực phẩm**. Bộ bổ sung dùng mã sản phẩm `SP018`–`SP035`, khách
hàng `KH013`–`KH018`, hóa đơn `HD-BS001`–`HD-BS028` và phiếu nhập
`PN-BS001`–`PN-BS010`. Tồn kho được tính từ phiếu nhập và hóa đơn tương ứng.

Nếu đã nạp bộ 6 sản phẩm trước đây, chạy lại cùng lệnh để bổ sung **12 sản phẩm
`SP024`–`SP035`, 4 khách hàng, 6 phiếu nhập, 18 hóa đơn và 48 bản ghi lịch sử**.
Ngày giao dịch mới tính theo ngày chạy; ngày và số liệu giao dịch cũ được giữ lại.

12 mặt hàng mới gồm Sting việt quất, Sting dâu, trà Tea Plus, sữa Milo, bánh Oreo,
bánh quế Oreo, xốt Cholimex, snack Oishi, cà phê G7, bột giặt Aba, kem đánh răng
Closeup và sữa tắm Lifebuoy. **Mỗi sản phẩm đều có ảnh chụp đúng mặt hàng**, lưu
sẵn tại `frontend/assets/catalog/products/` và nạp vào database dưới dạng data
URL, nên không phụ thuộc đường dẫn ảnh bên ngoài khi demo. Nguồn ảnh được ghi
trong `sources.json`. Giá và các giao dịch là dữ liệu giả lập phục vụ bài thi,
không phải báo giá của nơi cung cấp ảnh. Sữa tắm Lifebuoy còn 3 chai khi mới nạp
bộ dữ liệu để minh họa cảnh báo sắp hết hàng; bộ cũ vẫn có ví dụ hết hàng và
ngừng kinh doanh.

Chạy lại không tạo trùng hay đặt lại dữ liệu đã chỉnh sửa. Script không chạy
tự động khi mở backend, không tạo nhật ký AI giả và không thay đổi dữ liệu
ngoài bộ bổ sung. Nếu có lỗi, toàn bộ lần nạp được rollback. Cần có một tài khoản
quản trị viên đang hoạt động trước khi nạp.

Với database đã nạp phiên bản có nhãn DEMO, chỉ cập nhật tên, mã và ảnh bằng:

```powershell
.\.venv\Scripts\python.exe .\backend\seed_demo.py --refresh-catalog-only
```

Lệnh này giữ nguyên ID, số lượng tồn, giá, hóa đơn và chi tiết giao dịch. Nguồn
ảnh được ghi tại `frontend/assets/catalog/products/sources.json`.

## Quản lý tồn kho và sửa/hủy chứng từ

- **Tồn kho → Cài đặt cảnh báo:** số lượng hiện có chỉ để xem; chỉ được sửa mức
  tồn tối thiểu. API cũng từ chối việc ghi trực tiếp số lượng hoặc xóa bản ghi
  tồn kho. Sản phẩm mới bắt đầu từ 0; nhập hàng bằng phiếu nhập.
- **Hóa đơn → Danh sách hóa đơn → Xem:** chọn **Sửa hóa đơn** để chỉnh mặt hàng,
  số lượng, giá, giảm giá hoặc thông tin thanh toán. Hệ thống tự điều chỉnh tồn
  theo chênh lệch. Chọn **Hủy hóa đơn**, nhập lý do và xác nhận để hoàn hàng về
  kho; hóa đơn hủy được loại khỏi doanh thu, thống kê bán chạy và dữ liệu AI.
- **Nhập hàng → Lịch sử nhập hàng:** bấm mã phiếu để mở chi tiết, sửa hoặc hủy
  phiếu. Hủy phiếu nhập sẽ trừ lại hàng đã nhập; thao tác bị chặn nếu tồn không
  đủ. Khi sửa, hệ thống kiểm tra số lượng chênh lệch thay vì toàn bộ số lượng cũ.
- Chứng từ đã hủy giữ nguyên chi tiết, lý do, thời gian và người hủy để tra cứu;
  không được sửa hoặc hủy lần nữa. Các thao tác đều ghi lịch sử. Quyền sửa/hủy
  hóa đơn dùng quyền **Lập hóa đơn**, sửa/hủy phiếu nhập dùng quyền **Theo dõi
  nhập hàng**, và được kiểm tra lại tại backend.
- Backend tự thêm các cột trạng thái hủy cho SQL Server cũ khi khởi động; chứng
  từ hiện có mặc định giữ trạng thái hoàn tất. API xóa chứng từ cũ được chặn,
  thay bằng `POST /api/invoices/{id}/cancel` hoặc
  `POST /api/purchases/{id}/cancel` với body `{"reason":"Lý do hủy"}`.

## Danh sách nhà cung cấp

Mục **Nhập hàng → Nhà cung cấp** hỗ trợ thêm, sửa và khóa/mở khóa đối tác.
Tab Nhập hàng chọn từ danh sách nhà cung cấp đang hoạt động. Nhà cung cấp
bị khóa không thể dùng cho phiếu mới; các phiếu đã lập giữ nguyên tên đã ghi.
Backend tự tạo bảng `Suppliers` và khởi tạo danh sách từ tên trên các phiếu
nhập cũ khi danh sách còn trống. Dữ liệu được lưu trong SQL Server, không chỉ
trên trình duyệt. Các API danh sách, thêm và cập nhật nhà cung cấp sử dụng
quyền nhập hàng `purchase_track`, cùng với thao tác lập phiếu nhập hiện tại.

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

`SECRET_KEY` là khóa ký JWT riêng của từng máy, khác với Gemini API key. Thay
giá trị mẫu bằng chuỗi ngẫu nhiên dài và giữ ổn định trong `.env`. Có thể tạo
chuỗi bằng `python -c "import secrets; print(secrets.token_urlsafe(48))"` trên
máy cá nhân; không chia sẻ đầu ra. Đổi khóa và chạy lại backend sẽ làm các token
cũ hết hiệu lực; dữ liệu nghiệp vụ và mật khẩu tài khoản không bị thay đổi.

Đổi mật khẩu cá nhân hoặc đặt lại mật khẩu qua mục Người dùng sẽ thu hồi tất cả
phiên đã cấp của tài khoản đó. Người dùng cần đăng nhập lại bằng mật khẩu mới;
sửa thông tin hồ sơ không kèm mật khẩu không kết thúc phiên.

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

Để chạy nhanh, nhấp phải `run_backend.ps1` rồi chọn **Run with PowerShell**,
chờ dòng `Application startup complete`, sau đó chạy `run_frontend.ps1` theo cách
tương tự và mở <http://127.0.0.1:5500>. Giữ hai cửa sổ đang chạy mở trong lúc dùng.
Nếu bấm chạy thêm lần nữa, script sẽ báo dịch vụ đã chạy và không tạo bản thứ hai;
nhấn Enter để đóng cửa sổ mở thêm. Nếu cổng bị chương trình khác chiếm hoặc backend
chưa phản hồi, cửa sổ giữ lại thông báo lỗi để kiểm tra.

Trước khi khởi động backend mới, `run_backend.ps1` kiểm tra kết nối SQL Server
bằng `SELECT 1`. Nếu SQL Server chưa sẵn sàng, script thử lại tối đa 5 lần, cách
nhau 2 giây, mỗi lần kết nối có timeout 3 giây. Nếu vẫn lỗi, cửa sổ hiển thị
hướng dẫn kiểm tra database và không khởi động Uvicorn. Lỗi `10061` trong log
nghĩa là kết nối tới địa chỉ/cổng SQL Server bị từ chối tại thời điểm chạy;
kiểm tra dịch vụ SQL Server và cổng TCP trước khi chạy lại.

Có thể chỉ kiểm tra môi trường Python và kết nối database, không mở server và
không thêm dữ liệu:

```powershell
.\run_backend.ps1 -CheckOnly
```

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
