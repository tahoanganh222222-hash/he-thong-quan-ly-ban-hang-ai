# BÁO CÁO RÀ SOÁT CODE VÀ BẢO MẬT

### Hệ thống quản lý bán hàng tích hợp AI

| Thông tin | Nội dung |
| --- | --- |
| Mục đích | Đánh giá và hoàn thiện bảo mật cho hệ thống quản lý bán hàng |
| Phạm vi sử dụng | Dự án web cá nhân, vận hành và kiểm tra trên môi trường local |
| Ngày rà soát và cập nhật | 30/10/2026 |
| Công cụ hỗ trợ | AI Codex; kiểm thử Python và JavaScript |
| Trọng tâm | API key, xác thực tài khoản, quản lý phiên và phân quyền dữ liệu |

> **Kết quả nổi bật:** Backend đã có kiểm tra quyền truy cập, mật khẩu được băm,
> API key được sử dụng tại máy chủ và dữ liệu giá nhập được ẩn với khách hàng.
> Hai cải tiến về khóa JWT cục bộ và thu hồi phiên khi đổi mật khẩu đã hoàn thành.
> Bộ kiểm thử hiện tại đạt **46/46 trường hợp**, trong phạm vi các tình huống đã kiểm tra.

## 1. Mục tiêu và cách thực hiện

Hoạt động review nhằm kiểm tra cách hệ thống bảo vệ thông tin cấu hình, nhận
diện người dùng và giới hạn quyền truy cập dữ liệu. AI hỗ trợ đọc code, xác định
các nhánh cần kiểm tra, thực hiện kiểm thử và tổng hợp kết quả để người phát triển
đối chiếu với yêu cầu của hệ thống.

Các phương pháp được sử dụng:

- **Rà soát mã nguồn:** đọc luồng gọi Gemini, xử lý đăng nhập, kiểm tra JWT và các
  dependency phân quyền tại API.
- **Kiểm thử cách ly:** chạy test với SQLite trong bộ nhớ và môi trường JavaScript
  giả lập để kiểm tra các tình huống được phép, bị từ chối và thu hồi phiên.
- **Kiểm tra cấu hình:** xác nhận `.env` được Git bỏ qua và kiểm tra trạng thái
  khóa JWT mà không đưa giá trị bí mật vào tài liệu.

Đánh giá ghi nhận trạng thái mã nguồn và cấu hình tại thời điểm rà soát, tập trung
vào **phát triển và sử dụng trên môi trường local**.

## 2. Kết quả rà soát các cơ chế bảo vệ

| Nội dung | Cách hệ thống thực hiện | Kết quả review |
| --- | --- | --- |
| Bảo vệ Gemini API key | Backend đọc key từ cấu hình môi trường và dùng header `x-goog-api-key` khi gọi Google. Frontend gọi API của ứng dụng. | Key không cần được truyền xuống giao diện để sử dụng AI. |
| Quản lý file bí mật | `.env` nằm trong `.gitignore`; file mẫu chỉ hướng dẫn cấu hình. | `.env` không được Git theo dõi; không thấy commit của đường dẫn này trong các ref đã kiểm tra. |
| Lưu mật khẩu | Sử dụng bcrypt để tạo và kiểm tra password hash. | Có cơ chế băm mật khẩu trước khi lưu vào database. |
| Xác thực yêu cầu | JWT có chữ ký và thời hạn; backend tra lại người dùng, trạng thái hoạt động và phiên trong database. | Có kiểm tra ở máy chủ, không chỉ dựa vào thông tin lưu trên trình duyệt. |
| Phân quyền chức năng | API dùng `require_permission` hoặc `require_any_permission`. | Các test được cấp quyền và bị từ chối trong bộ kiểm thử đều đạt. |
| Bảo vệ quyền quản trị | API sửa quyền cần quyền `permission`; tài khoản ngoài admin bị chặn tạo hoặc cấp vai trò admin. | Đã có điều kiện kiểm soát các thao tác đặc quyền trong code. |
| Phân tách dữ liệu khách hàng | Response sản phẩm loại `purchasePrice` khi vai trò là customer. | Các test danh sách, chi tiết và response ghi sản phẩm đã kiểm tra đều không trả giá nhập cho customer. |
| Phân quyền phiếu nhập | Quyền đọc phiếu nhập là `purchase_track` hoặc `report_export`. | Test xác nhận chỉ có quyền xem lịch sử không đủ để đọc phiếu nhập. |
| Tắt quyền hoặc khóa tài khoản | Backend kiểm tra lại quyền và trạng thái trên request; tắt login tăng `session_version`. | Các test thu hồi phiên, khóa tài khoản và bật lại login đều đạt. |
| Đồng bộ quyền trên giao diện | Frontend kiểm tra lại phiên và xử lý phản hồi 401/403. | Test đồng bộ quyền, phản hồi đến trễ và lỗi mạng đều đạt. |
| Hiển thị nội dung AI | Các phần hiển thị AI đã đọc dùng hàm escape HTML trước khi định dạng. | Có biện pháp hạn chế chèn HTML tại những vị trí được rà soát. |

**Kiểm tra cấu hình bí mật:** Phạm vi quét gồm ba giá trị key trong cấu hình cục
bộ và các file Git hiện tại dưới 5 MB. Trong phạm vi này, các key được kiểm tra
không xuất hiện trong file được Git theo dõi. Việc quét ảnh, file bị ignore và
toàn bộ phiên bản lịch sử có thể được bổ sung trong các đợt đánh giá mở rộng.

## 3. Các cải tiến đã hoàn thành sau review

### 3.1. Khóa JWT riêng cho môi trường sử dụng

**Nội dung hoàn thiện:** `SECRET_KEY` trong `.env` đã được thay bằng chuỗi ngẫu nhiên
sinh bằng `secrets.token_urlsafe(48)`. Khóa được giữ trên máy, không in ra báo cáo
và không đưa vào Git.

**Tác dụng:** Token đăng nhập được ký bằng khóa riêng. Khi backend nạp khóa mới,
token ký bằng khóa cũ không còn hợp lệ và người dùng đăng nhập lại. Việc thay
khóa không thay đổi mật khẩu tài khoản hoặc dữ liệu bán hàng.

**Phạm vi:** Đây là thay đổi cấu hình trên máy hiện tại. Khi cài sang máy khác,
cần đặt khóa riêng trong `.env` theo README; không dùng lại giá trị mẫu.

### 3.2. Thu hồi phiên khi đổi hoặc đặt lại mật khẩu

**Nội dung hoàn thiện:** Backend tăng `session_version` cùng giao dịch thay mật khẩu,
áp dụng cho cả người dùng tự đổi và admin đặt lại mật khẩu qua mục Người dùng.
Giao diện đưa người vừa đổi mật khẩu về màn hình đăng nhập với thông báo rõ ràng.

**Tác dụng:** Token thuộc phiên cũ bị từ chối ở request tiếp theo; người dùng cần
đăng nhập bằng mật khẩu mới. Các tài khoản khác vẫn hoạt động bình thường. Sửa
thông tin hồ sơ không kèm mật khẩu vẫn giữ phiên hiện tại.

## 4. Kết quả kiểm thử xác nhận

| Nhóm kiểm tra | Nội dung chính | Kết quả |
| --- | --- | --- |
| Backend Python | Phân quyền, dữ liệu sản phẩm, phiếu nhập, phiên đăng nhập, nhà cung cấp, dữ liệu mẫu và khoảng doanh thu | **37/37 đạt** |
| Frontend JavaScript | Đồng bộ quyền, xử lý token hết hiệu lực, phản hồi đến trễ và luồng đổi mật khẩu | **9/9 đạt** |
| Tổng bộ test tự động | Các ca kiểm thử hiện có trong project | **46/46 đạt** |
| Kiểm tra khóa JWT cục bộ | Đọc cấu hình hiệu lực, kiểm tra chuỗi dài và không còn là khóa mẫu | **Đã xác nhận**, không hiển thị khóa |

Các test bổ sung cho thay đổi mật khẩu xác nhận:

1. Token cũ bị từ chối sau khi người dùng đổi mật khẩu.
2. Mật khẩu cũ không đăng nhập được; mật khẩu mới đăng nhập được.
3. Admin đặt lại mật khẩu sẽ thu hồi phiên của tài khoản đích.
4. Phiên của tài khoản khác không bị ảnh hưởng.
5. Yêu cầu đổi mật khẩu bị từ chối không làm mất phiên đang hợp lệ.
6. Sửa hồ sơ không kèm mật khẩu không thu hồi phiên.
7. Giao diện xóa phiên và hướng dẫn đăng nhập lại sau khi đổi mật khẩu thành công;
   nếu API trả lỗi thì giữ phiên và hiển thị thông báo.

Các lần kiểm thử này sử dụng dữ liệu giả lập, không đổi mật khẩu tài khoản thật,
không thay dữ liệu SQL Server thật và không gọi Gemini để tiêu tốn quota.

Lệnh kiểm tra tương ứng, chạy trong môi trường đã cài đủ thư viện:

```powershell
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/test_session_sync.cjs tests/test_password_change.cjs
```

## 5. Vận hành local và định hướng phát triển

| Nội dung | Cách áp dụng cho môi trường local |
| --- | --- |
| Tài khoản và dữ liệu mẫu | Hỗ trợ kiểm tra các vai trò và tái hiện luồng nghiệp vụ. Thông tin đăng nhập thực tế được quản lý theo cấu hình sử dụng của từng tài khoản. |
| Debug và log | Hỗ trợ theo dõi hoạt động và xử lý lỗi khi phát triển; thông tin nhạy cảm được giữ trong phạm vi máy cá nhân khi trình diễn hoặc chia sẻ tài liệu. |
| Lượt gọi AI | Gửi các yêu cầu lần lượt để sử dụng quota hiệu quả; có thể bổ sung quản lý tần suất khi tăng số lượng người dùng. |
| Quản lý key | Lưu key trong cấu hình môi trường riêng, giữ ngoài Git và tài liệu chia sẻ. Theo dõi lượt sử dụng và thay key khi cần. |
| Phạm vi dữ liệu theo vai trò | Khách hàng vẫn nhận giá bán, tồn kho và mức tồn tối thiểu theo thiết kế hiện tại; giá nhập được ẩn. Quyền xuất báo cáo có thể đọc phiếu nhập; quyền xem nhật ký AI có thể đọc nhật ký toàn hệ thống. |

**Chính sách phiên hiện tại:** Đăng xuất chủ động xóa token trên trình duyệt và
ghi nhật ký. Token đã phát hành vẫn có thể được backend chấp nhận đến khi hết
hạn nếu chưa có sự kiện thu hồi như đổi/reset mật khẩu, tắt quyền login hoặc khóa
tài khoản. Hướng phát triển tiếp theo là bổ sung quản lý và thu hồi riêng từng phiên.

Nếu mở rộng hệ thống cho nhiều người sử dụng qua mạng, nên xem xét thêm giới hạn
đăng nhập/gọi AI, quản lý tài khoản khởi tạo, tắt debug, mã hóa kết nối và chính
sách bảo vệ token trên trình duyệt. Đây là hướng phát triển tiếp theo cho hệ thống.

## 6. Minh chứng mã nguồn

| Thành phần | File tham chiếu |
| --- | --- |
| Cấu hình và hướng dẫn sử dụng | [README](../README.md), [cấu hình backend](../backend/app/core/config.py), [.gitignore](../.gitignore) |
| Xử lý Gemini API key | [Dịch vụ Gemini](../backend/app/services/gemini.py) |
| Băm mật khẩu và tạo token | [Security](../backend/app/core/security.py) |
| Kiểm tra phiên và quyền | [Dependency xác thực](../backend/app/dependencies/auth.py) |
| Đổi mật khẩu và quản lý người dùng | [Router xác thực](../backend/app/routers/auth.py) |
| Phân quyền dữ liệu nghiệp vụ | [Router bán hàng](../backend/app/routers/sales.py), [router AI](../backend/app/routers/ai.py) |
| Luồng giao diện tài khoản | [Tài khoản](../frontend/js/account.js), [API frontend](../frontend/js/api.js) |
| Kiểm thử xác nhận | [Quyền và phiên](../tests/test_sales_permissions.py), [đồng bộ phiên](../tests/test_session_sync.cjs), [đổi mật khẩu trên giao diện](../tests/test_password_change.cjs) |

## 7. Đánh giá chung

Quá trình review có sự hỗ trợ của AI đã hệ thống hóa các cơ chế bảo vệ API key,
xác thực tài khoản và phân quyền dữ liệu. Hệ thống thực hiện kiểm tra quyền tại
backend, sử dụng bcrypt cho mật khẩu và quản lý phiên bằng JWT kết hợp thông tin
người dùng trong database.

Hai cải tiến đã hoàn thành gồm **khóa JWT riêng cho môi trường sử dụng** và
**thu hồi phiên khi đổi hoặc đặt lại mật khẩu**. Kết quả **46/46 trường hợp kiểm
thử đạt** cung cấp bằng chứng xác nhận các luồng đã kiểm tra, từ kiểm soát quyền
truy cập đến xử lý phiên trên giao diện.

**Phạm vi xác nhận:** Báo cáo tập trung vào rà soát mã nguồn, kiểm tra cấu hình
và các tình huống kiểm thử cách ly trên môi trường local. Kết quả được đối chiếu
với mã nguồn và yêu cầu hệ thống; số lượng test phản ánh các kịch bản đã thực hiện.
Kiểm thử tải, kiểm thử xâm nhập, đo bao phủ toàn bộ code và đánh giá hạ tầng mạng
là các hướng đánh giá mở rộng khi phát triển quy mô sử dụng.

Tài liệu kỹ thuật, dữ liệu mẫu và bộ kiểm thử tạo nền tảng để tiếp tục bảo trì,
tái hiện các luồng nghiệp vụ và phát triển thêm chức năng. AI đóng vai trò hỗ trợ
review và kiểm chứng, kết hợp với việc đọc code và đối chiếu của người phát triển.
