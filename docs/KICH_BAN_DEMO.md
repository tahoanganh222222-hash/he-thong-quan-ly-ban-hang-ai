# Kịch bản demo hệ thống quản lý bán hàng tích hợp AI

Tài liệu được biên soạn với sự hỗ trợ của AI dựa trên giao diện và code hiện có.
Các kết quả dưới đây là **kết quả mong đợi để đối chiếu khi trình diễn**, không phải
biên bản xác nhận toàn bộ chức năng đã kiểm thử đạt.

Thời lượng gợi ý: 8–12 phút cho luồng chính; các mục tùy chọn dùng khi còn thời gian
hoặc giảng viên yêu cầu. [Hướng dẫn cài đặt và chạy ứng dụng](../README.md).

## 1. Chuẩn bị trước buổi demo

- Chạy SQL Server, backend và frontend theo README; kiểm tra `/health` phản hồi
  thành công, rồi mở <http://127.0.0.1:5500>.
- Dùng tài khoản quản trị viên để trình diễn đủ các màn hình. Có thể dùng tài khoản
  nhân viên hoặc khách hàng ở phần minh họa phân quyền. Kiểm tra quyền thực tế
  trước buổi diễn vì admin có thể đã thay đổi cấu hình mặc định.
- Nếu thiếu dữ liệu, làm theo mục **Bổ sung dữ liệu mẫu để thử giao diện** trong
  README. Script nạp mẫu không tự làm mới ngày giao dịch khi chạy lại; kiểm tra
  ngày hóa đơn và chọn khoảng ngày phù hợp nếu dữ liệu mẫu đã cũ.
- Kiểm tra Gemini trước buổi diễn bằng một câu hỏi ngắn. Giữ API key trong `.env`,
  không mở file này khi quay màn hình hoặc trình chiếu. Model có thể được cấu hình
  qua `GEMINI_MODEL`; mặc định hiện tại là `gemini-3.6-flash`.
- Nên dùng database dành cho trình diễn: lập hóa đơn, nhập hàng và các thao tác
  lưu thực sự thay đổi dữ liệu. Ghi lại mã chứng từ tạo trong buổi demo để tra cứu.

Chuẩn bị một sản phẩm đang kinh doanh, còn ít nhất 2 đơn vị. Ví dụ có thể chọn
`SP018 – Trà xanh Không Độ 455ml` nếu đã nạp bộ dữ liệu bổ sung; nếu không, chọn
một sản phẩm đủ hàng khác. Dùng giá và tồn kho đang hiển thị, không giả định chúng
vẫn giống dữ liệu mẫu.

| Thông tin ghi trước khi bán | Giá trị cần ghi |
| --- | --- |
| Mã, tên sản phẩm | Sản phẩm sẽ dùng trong buổi demo |
| Giá bán một đơn vị | P đồng |
| Tồn kho trước khi bán | Q, với Q ≥ 2 |
| Số lượng sẽ bán | 2 |
| Tổng tiền không giảm giá | 2 × P đồng |
| Tồn kho mong đợi sau bán | Q − 2 |
| Khách hàng | Một khách hàng đang hoạt động, hoặc Khách lẻ |

Nếu đúng giá đang hiển thị là 10.000 đồng thì bán 2 đơn vị, không giảm giá,
tổng tiền mong đợi là 20.000 đồng. Đây là ví dụ tính toán, không phải giá cố định.

## 2. Luồng demo chính

### Bước 1 — Đăng nhập và giới thiệu tổng quan (khoảng 1 phút)

**Thao tác:** Đăng nhập bằng tài khoản quản trị viên, mở Dashboard. Ghi nhận
doanh thu và số hóa đơn hôm nay để đối chiếu sau khi bán.

**Mong đợi:** Đăng nhập thành công, hiển thị tài khoản hiện tại và các chỉ số tổng quan.

**Lời giới thiệu:** “Hệ thống quản lý sản phẩm, khách hàng, hóa đơn và tồn kho trên
SQL Server. Dashboard tổng hợp tình hình kinh doanh từ dữ liệu của hệ thống.”

### Bước 2 — Tìm sản phẩm và kiểm tra thông tin (khoảng 1 phút)
**Thao tác:** Mở **Sản phẩm**, tìm theo mã hoặc tên, thử lọc danh mục hoặc trạng thái.
Mở chi tiết sản phẩm đã chuẩn bị, ghi lại giá P và tồn kho Q.
**Mong đợi:** Kết quả tìm kiếm phù hợp; giá và số lượng tồn hiển thị rõ để lập hóa đơn.
**Lời giới thiệu:** “Nhân viên có thể tra cứu hàng hóa trước khi bán, hạn chế chọn nhầm
sản phẩm và biết số lượng còn có thể bán.”



### Bước 3 — Lập hóa đơn bán hàng (khoảng 2 phút)

**Thao tác:**

1. Mở **Hóa đơn → Lập hóa đơn**.
2. Chọn khách hàng đang hoạt động, hoặc để Khách lẻ.
3. Chọn sản phẩm đã chuẩn bị, số lượng **2**, bấm **Thêm**.
4. Để giảm giá bằng 0, đối chiếu tổng thanh toán với **2 × P**.
5. Chọn **Tiền mặt** hoặc **Chuyển khoản**; ghi lại mã hóa đơn đang hiển thị.
6. Bấm **Lập hóa đơn**, kiểm tra nội dung hộp xác nhận rồi xác nhận lưu.

**Mong đợi:** Hiện thông báo thành công; hóa đơn được lưu với đúng khách hàng,
sản phẩm, số lượng, giá và phương thức thanh toán.

**Lời giới thiệu:** “Khi xác nhận lập hóa đơn, hệ thống ghi nhận giao dịch và trừ tồn
kho tương ứng. Nhân viên không phải tự tính lại bằng tay.”

### Bước 4 — Đối chiếu hóa đơn, tồn kho và lịch sử (khoảng 1–2 phút)

**Thao tác:** Mở **Hóa đơn → Danh sách hóa đơn**, tìm mã vừa ghi và xem chi tiết.
Tiếp theo mở **Tồn kho**, tìm sản phẩm đó; mở **Lịch sử → Lịch sử hoạt động** để
xem thao tác vừa tạo.

**Mong đợi:** Hóa đơn có tổng tiền **2 × P**; tồn kho là **Q − 2**; lịch sử ghi nhận
thao tác tạo hóa đơn và cập nhật tồn kho. Nếu màn hình đang giữ dữ liệu cũ,
mở lại mục đó hoặc tải lại trang trước khi đối chiếu.

**Lời giới thiệu:** “Cùng một giao dịch được đối chiếu giữa chứng từ, tồn kho và nhật
ký hoạt động. Điều này hỗ trợ kiểm tra sai lệch và truy vết thao tác.”

### Bước 5 — Minh họa chặn bán vượt tồn kho (khoảng 30 giây)

**Thao tác:** Quay lại **Hóa đơn → Lập hóa đơn**, chọn cùng sản phẩm, nhập số lượng
lớn hơn tồn kho hiện tại rồi bấm **Thêm**. Sau khi xem thông báo, hủy bản nháp.

**Mong đợi:** Ứng dụng báo số lượng vượt tồn kho; không thêm dòng hàng đó vào hóa đơn.
Thao tác thử này không tạo chứng từ và không làm giảm tồn kho.

**Lời giới thiệu:** “Hệ thống kiểm tra tồn kho trước khi bán để hạn chế việc nhận bán
vượt quá số hàng hiện có.”

### Bước 6 — Xem doanh thu và xuất báo cáo (khoảng 1 phút)

**Thao tác:** Mở Dashboard hoặc **Thống kê doanh thu**, chọn phạm vi chứa hôm nay.
So với số ghi ở bước 1; nếu không có giao dịch khác, doanh thu tăng **2 × P** và số
hóa đơn hôm nay tăng **1**. Mở **Báo cáo**, chọn khoảng ngày chứa hóa đơn vừa tạo,
áp dụng bộ lọc và chọn xuất Excel hoặc PDF. Mở file tải về để kiểm tra.

**Mong đợi:** Giao dịch vừa tạo được tính vào khoảng đã chọn; file xuất mở được,
nội dung khớp loại báo cáo và bộ lọc. Chú ý ngày bắt đầu–kết thúc khi so sánh số liệu.

**Lời giới thiệu:** “Báo cáo lấy dữ liệu giao dịch đã lưu. Người quản lý có thể chọn
khoảng thời gian và xuất tài liệu phục vụ theo dõi kinh doanh.”

### Bước 7 — Trình diễn ba chức năng AI (khoảng 2–3 phút)

Chạy từng yêu cầu lần lượt; mỗi chức năng chỉ cần một câu hỏi để tiết kiệm lượt dùng.

| Màn hình | Nội dung gợi ý | Cách đối chiếu phản hồi |
| --- | --- | --- |
| **AI tư vấn sản phẩm** | “Tôi cần một chiếc quạt còn hàng, ngân sách dưới 600.000 đồng.” | Đối chiếu mã, tên, giá và tồn kho với danh sách sản phẩm. Nếu không có hàng phù hợp, AI cần nói rõ. |
| **AI báo cáo doanh thu** | Chọn 7 ngày gần nhất; nhập “Tổng doanh thu và số hóa đơn trong kỳ là bao nhiêu?” | So sánh với thống kê trên cùng khoảng ngày, không so với toàn bộ lịch sử. |
| **AI hỏi đáp dữ liệu** | “Sản phẩm nào bán chạy nhất theo số lượng?” | So sánh tên và số lượng với bảng sản phẩm bán chạy trên cùng phạm vi dữ liệu. |

**Lời giới thiệu:** “AI thứ nhất hỗ trợ nhóm trong quá trình phát triển: viết tài liệu,
rà soát code và hỗ trợ kiểm thử. AI thứ hai là Gemini được tích hợp trong sản phẩm,
đọc dữ liệu do backend cung cấp để tư vấn và phân tích. Nhóm đối chiếu câu trả lời
với dữ liệu gốc trước khi sử dụng.”

Nếu cần minh chứng, mở **Lịch sử → Nhật ký AI** để xem yêu cầu thành công vừa thực
hiện, nội dung phản hồi và số token. Nhật ký này ghi nhận lần gọi, không tự chứng
minh nội dung AI luôn chính xác.

### Bước 8 — Sửa hoặc hủy chứng từ (tùy chọn, 1–2 phút)

Chỉ dùng chứng từ vừa tạo riêng cho buổi trình diễn. Trong **Hóa đơn → Danh
sách hóa đơn**, bấm **Xem → Sửa hóa đơn**, đổi số lượng từ 2 xuống 1 và lưu:
tồn kho tăng lại 1 đơn vị, tổng tiền và báo cáo được cập nhật. Chọn **Hủy hóa
đơn**, nhập lý do và xác nhận: đơn vị còn lại được hoàn về kho, trạng thái
chuyển thành **Đã hủy**, chứng từ vẫn xem được và không còn tính vào doanh thu.

Với phiếu nhập, vào **Nhập hàng → Lịch sử nhập hàng**, bấm mã phiếu để sửa hoặc
hủy. Hủy phiếu nhập sẽ trừ lại hàng đã nhập; nếu tồn không đủ thì hệ thống từ
chối và giữ nguyên dữ liệu. Không thể sửa hoặc hủy chứng từ đã hủy lần nữa.

Mở **Tồn kho → nút bút chì** để minh họa: **Số lượng hiện có chỉ xem**, chỉ có
**Mức tồn tối thiểu** được thay đổi. Không dùng màn hình này để tăng/giảm hàng.

## 3. Các phần tùy chọn khi còn thời gian

| Nội dung | Trình tự thao tác | Kết quả cần quan sát |
| --- | --- | --- |
| Thêm, sửa, xóa sản phẩm | Tạo sản phẩm thử có mã riêng chưa tồn tại; sửa tên hoặc giá, lưu và mở lại; xóa sản phẩm chưa có giao dịch. | Thông tin được lưu; sản phẩm đã liên kết giao dịch có thể bị chặn xóa để giữ dữ liệu lịch sử. Không dùng sản phẩm đang bán để minh họa xóa. |
| Nhập hàng | Vào **Nhập hàng → Nhà cung cấp**, chọn đối tác đang hoạt động hoặc thêm đối tác thử; sang tab **Nhập hàng**, chọn đối tác, sản phẩm, số lượng và giá nhập, lập phiếu. | Có phiếu trong **Lịch sử nhập hàng**, tồn kho tăng đúng số lượng. Ghi tồn trước thao tác để đối chiếu. |
| Khóa nhà cung cấp | Chọn đối tác thử chưa cần dùng, khóa rồi kiểm tra danh sách chọn của phiếu mới; mở khóa lại nếu cần. | Đối tác bị khóa không được dùng cho phiếu nhập mới; chứng từ cũ vẫn giữ tên đã ghi. |
| Phân quyền | Dùng cửa sổ riêng tư đăng nhập nhân viên hoặc khách hàng, đối chiếu menu với quyền hiện tại; giữ phiên quản trị ở cửa sổ chính. | Tài khoản chỉ truy cập được phần được cấp quyền. Menu thay đổi chỉ là minh họa giao diện; kiểm tra API là phần đánh giá riêng. |
| Hồ sơ cá nhân | Mở **Tài khoản của tôi**, giới thiệu các tab hồ sơ và bảo mật. | Hiển thị đúng người dùng đang đăng nhập; không cần đổi mật khẩu trong buổi demo. |

## 4. Khi AI hoặc kết nối có sự cố

- Nếu hiện **Đang hỏi Gemini**, chờ lần gọi hiện tại kết thúc; không bấm tạo nhiều
  yêu cầu liên tục.
- Nếu Gemini báo quá tải, giới hạn lượt gọi hoặc lỗi kết nối, nói rõ phản hồi AI
  chưa nhận được. Có thể mở một bản ghi thành công trong nhật ký để minh họa và
  giới thiệu đây là **kết quả đã lưu trước đó**.
- Phần **Nhận xét tự động** và các chỉ số trên trang doanh thu được ứng dụng tính
  từ dữ liệu; phần **Phân tích từ Gemini/Gemini trả lời yêu cầu** mới là phản hồi
  từ dịch vụ AI. Không trình bày nhận xét nội bộ như một lần gọi Gemini thành công.
- Nếu frontend không mở hoặc không tải dữ liệu, kiểm tra hai dịch vụ và `/health`
  theo mục xử lý lỗi trong README. Không cần nạp lại dữ liệu mẫu để xử lý lỗi mạng.

## 5. Kết thúc demo

Ghi lại mã hóa đơn/phiếu nhập và kết quả quan sát, giữ các chứng từ làm minh chứng
nếu sử dụng database trình diễn. Nếu trình diễn hủy, giải thích rõ tác động tới
tồn kho và doanh thu, đồng thời mở lại chứng từ có trạng thái **Đã hủy** để đối
chiếu lý do và thời gian. Hệ thống giữ chứng từ thay vì xóa khỏi database.

Kết luận gợi ý: “Hệ thống hỗ trợ luồng bán hàng từ tra cứu đến lập hóa đơn, cập nhật
tồn kho, ghi lịch sử và thống kê. Gemini bổ sung khả năng tư vấn và phân tích;
các câu trả lời được kiểm tra lại bằng dữ liệu trong hệ thống.”
