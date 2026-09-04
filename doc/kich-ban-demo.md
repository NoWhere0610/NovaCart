# Kịch bản Demo NovaCart

> Tài liệu nội bộ nhóm — dùng để tổng duyệt và trình bày buổi bảo vệ đồ án tốt nghiệp.
> Toàn bộ URL, nhãn nút, thông báo lỗi trong tài liệu này được lấy đúng từ mã nguồn hiện tại (không phải suy đoán) — nếu code đổi, phải cập nhật lại file này.
>
> **Cập nhật gần nhất: 04/09/2026.** Đợt này bổ sung khá nhiều nghiệp vụ mới (quên mật khẩu, hồ sơ tài khoản, luồng hoàn tiền 3 bước, xác nhận thu tiền COD, giới hạn mã giảm giá theo người, xử lý giao thất bại). Những phần MỚI được đánh dấu **[MỚI]** để ai đã đọc bản cũ biết chỗ nào cần đọc lại.

## 0. Danh sách phân công

| # | Thành viên | MSSV | Vai trò | Phần trình bày |
|---|---|---|---|---|
| 1 | Trần Quang Huy | TH04281 | Trưởng nhóm / Backend | Mở đầu, kiến trúc hệ thống, xác thực, quên mật khẩu |
| 2 | Trần Anh Cường | TH04276 | Backend | Thanh toán (VNPay/VietQR), phí vận chuyển, voucher, thống kê |
| 3 | Trần Minh Tân | TH02474 | Frontend | Trải nghiệm mua sắm (trang chủ → giỏ hàng) |
| 4 | Nguyễn Đức Thành | TH02301 | Frontend / UI-UX | Giao diện quản trị, luồng hoàn tiền, bán hàng tại quầy (POS), responsive |
| 5 | Nguyễn Thanh Long | TH02579 | Database / AI-RAG | Cơ sở dữ liệu, chatbot AI (RAG) |
| 6 | Trịnh Thanh Tùng | TH04097 | QA / Tester | Kế hoạch kiểm thử, minh chứng chất lượng |

**Tổng thời lượng đề xuất:** ~17 phút trình bày + phần hỏi đáp. Có thể co giãn theo hướng dẫn ở mục 6.

---

## 1. Chuẩn bị trước buổi demo (làm trước ít nhất 1 ngày, kiểm lại lần cuối trước giờ bảo vệ 30-60 phút)

### 1.1. Môi trường chạy

- [ ] Chạy `start.bat` ở thư mục gốc — mở ra **3 cửa sổ**: Chatbot (cổng **3200**), Backend (**8080**), Frontend (**5173**).
- [ ] **[MỚI]** `start.bat` giờ **bỏ qua dịch vụ đang chạy** thay vì đâm vào cổng đã bận. Nếu thấy dòng `[bo qua] ... cong 8080 da co tien trinh dang chay` mà dịch vụ đó thật ra bị kẹt, chạy `restart.bat` — file này diệt theo PID đang giữ cổng rồi bật lại từ đầu.
- [ ] Mở `http://localhost:5173` kiểm tra trang chủ load được ảnh, không lỗi console.
- [ ] Kiểm tra kết nối MSSQL (`menswear_shop`) không bị lỗi ở log backend lúc khởi động.
- [ ] Nếu demo trên máy khác/laptop dự phòng: chạy thử toàn bộ kịch bản 1 lượt trên đúng máy đó, đừng tin "máy tôi chạy được là đủ".

### 1.2. Tài khoản test cần có sẵn

| Tài khoản | Dùng để | Cách có |
|---|---|---|
| `admin` / `admin@123` | Toàn bộ phần Admin/POS/Thống kê/Phân quyền | Đã seed sẵn, xem `menswear_db_mssql.sql` |
| 1 tài khoản khách hàng thường | Phần mua sắm của Tân, checkout của Cường, chatbot của Long | Đăng ký mới ngay đầu demo (Huy), hoặc tạo sẵn trước để đỡ tốn thời gian nếu lo lỗi |
| 1 tài khoản **STAFF** bị giới hạn quyền | Phần QA của Tùng (demo chặn 403) | **Chưa có UI tự tạo — phải làm tay, xem mục 1.3** |

### 1.3. Tạo tài khoản STAFF để demo phân quyền (bắt buộc chuẩn bị trước, không làm được live)

Hiện tại trang "Quản lý người dùng" chỉ khoá/mở khoá tài khoản, **không có nút gán vai trò**. Muốn có 1 tài khoản STAFF để Tùng demo case bị chặn quyền, làm theo các bước sau ít nhất 1 ngày trước:

1. Đăng ký 1 tài khoản mới bình thường qua `/register` (vd username `nhanvien1`).
2. Mở SQL Server Management Studio (hoặc `sqlcmd`), chạy:
   ```sql
   -- Tìm user_id vừa đăng ký
   SELECT user_id, username FROM dbo.users WHERE username = N'nhanvien1';

   -- Gán role STAFF (role_id = 3) cho user đó -- thay 999 bằng user_id thật ở trên
   INSERT INTO dbo.user_roles (user_id, role_id) VALUES (999, 3);
   ```
3. Đăng nhập thử bằng `nhanvien1` — vào được `/admin` (do `allowStaff` ở route), nhưng phải thấy đúng hành vi:
   - Menu sidebar **không** có "Người dùng" và "Phân quyền nhân viên" (chỉ ADMIN thấy).
   - Vào trang **Sản phẩm** chỉ xem được, không có nút "+ Thêm sản phẩm" / "Sửa" nếu quyền `PRODUCT_WRITE` đang tắt (mặc định STAFF chỉ có `PRODUCT_VIEW`).
4. Đăng nhập lại bằng `admin`, vào `/admin/permissions`, xem đúng ma trận đang seed mặc định cho STAFF: **bật sẵn** POS_USE, ORDER_VIEW, ORDER_UPDATE_STATUS, PRODUCT_VIEW, CATEGORY_BRAND_VIEW, VOUCHER_VIEW — **tắt sẵn** các quyền còn lại (PRODUCT_WRITE, PRODUCT_DELETE, CATEGORY_BRAND_WRITE/DELETE, VOUCHER_WRITE/DELETE, STATISTICS_VIEW).

### 1.4. **[MỚI]** Cấu hình gửi email — bắt buộc nếu muốn demo "Quên mật khẩu"

Chức năng quên mật khẩu gửi email thật qua Gmail SMTP. **Chưa cấu hình thì bấm vào sẽ ra lỗi rõ ràng** *"Hệ thống chưa cấu hình gửi email nên chưa dùng được chức năng này"* — không phải lỗi ngầm, nhưng cũng không demo được.

- [ ] File `backend/config/application.properties` (đã chặn trong `.gitignore`, **không** nằm trên GitHub) phải có:
  ```
  spring.mail.username=<gmail của nhóm>
  spring.mail.password=<app password 16 ký tự>
  ```
  App password lấy tại `myaccount.google.com/apppasswords` (phải bật Xác minh 2 bước trước).
- [ ] Máy demo là máy khác thì **phải chép file này sang** — clone từ GitHub sẽ không có.
- [ ] Test thử 1 lượt trước buổi bảo vệ: `/forgot-password` → nhập email của một tài khoản có thật → kiểm hộp thư (cả mục Spam).
- [ ] Email của tài khoản `admin` đã trỏ về Gmail thật của nhóm (không còn `admin@menswear.com` — tên miền đó không tồn tại, không nhận được mail nào).

### 1.5. Dữ liệu cần chuẩn bị sẵn trong DB (qua trang Admin, không cần SQL tay)

- [ ] Ít nhất 1 **voucher còn hạn, còn lượt** (vd `GIAM10`, giảm 10%, còn hiệu lực) để demo áp mã thành công.
- [ ] **[MỚI]** Không cần chuẩn bị voucher "hết lượt" nữa — nay mỗi khách chỉ dùng được **mỗi mã một lần**, nên Tùng demo bằng cách áp lại đúng mã vừa dùng ở đơn trước (dễ hơn hẳn, không phải setup gì).
- [ ] 1-2 sản phẩm có **tồn kho <= 5** ở ít nhất 1 biến thể, để mục "Cảnh báo tồn kho thấp" trong Thống kê có dữ liệu hiển thị (không thì bảng trống, mất đi 1 điểm nhấn).
- [ ] Tài khoản khách hàng test đã **lưu sẵn 1 địa chỉ giao hàng** qua bản đồ VietMap (có toạ độ thật) — để phần tính phí ship theo khoảng cách của Cường có số liệu thật thay vì rơi về công thức fallback cố định.
- [ ] Ít nhất 3-5 đơn hàng lịch sử với trạng thái khác nhau (đã có sẵn từ quá trình phát triển thì không cần tạo thêm) để trang Thống kê không trống trơn khi demo.
- [ ] **[MỚI]** Chuẩn bị **1 đơn COD đã ở trạng thái "Cần đánh giá (đã giao)"** cho phần demo hoàn tiền của Thành — nếu tạo live sẽ mất 4 lần bấm chuyển trạng thái, rất tốn thời gian.

### 1.6. VNPay sandbox

- [ ] Test thử 1 lượt thanh toán VNPay đầy đủ **trước buổi bảo vệ tối thiểu 30 phút** — sandbox VNPay đôi khi có bảo trì/đổi thẻ test, không được tin là "hôm trước còn chạy".
- [ ] Tra thẻ test ngân hàng giả lập **mới nhất** tại `sandbox.vnpayment.vn` (thẻ test có thể đổi theo thời gian, không hard-code số thẻ vào tài liệu này).
- [ ] Ghi nhớ: `vnp_ReturnUrl` trỏ về `http://localhost:8080/api/vnpay/return` (backend verify chữ ký) rồi mới redirect sang `http://localhost:5173/vnpay-result` cho khách xem — nếu demo trên máy/mạng khác localhost, phải đổi lại 2 property này trong `application.properties`, không thì callback không bao giờ tới được.
- [ ] **[MỚI]** Hệ thống có **cả IPN** (`/api/vnpay/ipn`) — đây mới là đường xác nhận chính thức của VNPay, gọi server-to-server nên không phụ thuộc khách có đóng trình duyệt hay không. **IPN không chạy được trên localhost** (VNPay không gọi tới được máy trong mạng nội bộ). Khi demo tại chỗ, đường ReturnUrl vẫn đủ để đơn chuyển sang đã thanh toán. Nếu hội đồng hỏi, trả lời đúng như vậy — đừng nói là IPN đang chạy.

### 1.7. ⚠️ CẢNH BÁO AN TOÀN — đọc kỹ trước khi demo thanh toán chuyển khoản

Mã QR VietQR khi chọn "Chuyển khoản ngân hàng" trỏ tới **tài khoản ngân hàng thật** (BIN 970436, đã cấu hình thật trong `application.properties`), **không phải tài khoản giả lập**.

**Không ai trong nhóm hoặc hội đồng được quét mã và chuyển khoản thật để "test cho vui".** Nếu muốn demo luồng chuyển khoản trọn vẹn:
- Đặt hàng xong, hiện mã QR thật (chỉ hiện, không quét/chuyển).
- Chuyển sang tài khoản `admin` → trang **Quản lý đơn hàng** → bấm **"Xác nhận đã nhận CK"** để giả lập đã nhận được tiền, không cần ai chuyển khoản thật.

### 1.8. Trình duyệt & thiết bị

- [ ] Mở sẵn **2 cửa sổ trình duyệt khác nhau** (hoặc 1 cửa sổ thường + 1 cửa sổ ẩn danh): 1 đăng nhập sẵn tài khoản khách hàng, 1 đăng nhập sẵn `admin` — tránh phải đăng xuất/đăng nhập lại giữa các phần, rất mất thời gian và dễ quên mật khẩu giữa chừng. **Phần hoàn tiền của Thành bắt buộc phải có 2 cửa sổ này** vì nó đi qua cả hai vai.
- [ ] Tắt hết extension trình duyệt có thể che UI (ad-block, password manager popup).
- [ ] Nếu Thành demo responsive: chuẩn bị sẵn tablet/điện thoại thật hoặc ít nhất bật DevTools responsive mode và test trước với đúng kích thước sẽ dùng lúc demo.
- [ ] Zoom trình duyệt về mức hội đồng ở cuối phòng vẫn đọc được chữ (thường 100-110%, kiểm tra thực tế phòng bảo vệ nếu được).

---

## 2. Sơ đồ thời lượng tổng thể

| Thời điểm | Người trình bày | Nội dung | Thời lượng |
|---|---|---|---|
| 0:00 – 2:00 | Huy | Mở đầu, kiến trúc, đăng ký/đăng nhập, **quên mật khẩu** | 2 phút |
| 2:00 – 4:30 | Tân | Trải nghiệm mua sắm | 2.5 phút |
| 4:30 – 7:30 | Cường | Checkout, voucher, phí ship, thanh toán VNPay/VietQR | 3 phút |
| 7:30 – 10:00 | Thành | Admin: Sản phẩm, Đơn hàng, Phân quyền, POS | 2.5 phút |
| 10:00 – 12:00 | Thành | **Luồng trả hàng & hoàn tiền (mới)** | 2 phút |
| 12:00 – 13:30 | Cường | Trang Thống kê | 1.5 phút |
| 13:30 – 15:00 | Long | Chatbot AI (RAG) | 1.5 phút |
| 15:00 – 16:30 | Tùng | Minh chứng QA — các case hệ thống tự chặn đúng | 1.5 phút |
| 16:30 – 17:30 | Huy | Tổng kết, mở hỏi đáp | 1 phút |

---

## 3. Kịch bản chi tiết từng phần

### Phần 0 — Trần Quang Huy: Mở đầu, kiến trúc hệ thống, xác thực (2 phút)

**Mục tiêu:** hội đồng nắm được bức tranh tổng thể trong 90 giây đầu, để các phần sau không cần giải thích lại.

**Lời dẫn mẫu:**

> "Kính thưa hội đồng, nhóm em xin trình bày đồ án NovaCart — hệ thống bán quần áo nam trực tuyến kết hợp bán tại quầy. Về kiến trúc, hệ thống gồm 3 lớp: frontend React + TypeScript + Vite, backend Java Spring Boot cung cấp REST API, và cơ sở dữ liệu SQL Server. Xác thực dùng JWT không trạng thái (stateless), phân quyền theo 3 vai trò: ADMIN có toàn quyền, STAFF theo ma trận quyền admin tự cấu hình, CUSTOMER là khách mua hàng. Em sẽ đăng ký nhanh 1 tài khoản để cả nhóm demo theo đúng hành trình 1 khách hàng thật."

**Các bước thao tác:**

1. Mở `http://localhost:5173/register`.
2. Điền form đăng ký: username, email, mật khẩu, họ tên, số điện thoại (đúng định dạng `03/05/07/08/09` + 10 số — nếu gõ sai định dạng, hệ thống báo lỗi ngay tại chỗ, có thể tận dụng để minh hoạ luôn validate phía client).
3. Bấm **Đăng ký** → tự động đăng nhập, chuyển về trang chủ.
4. **[MỚI]** Vào `/account` — chỉ nhanh 3 khối: **Thông tin cá nhân** (họ tên + số điện thoại, cả hai bắt buộc), **Đổi mật khẩu** (thu gọn, bấm mới mở), **Sổ địa chỉ**. Nói 1 câu: *"Email và tên đăng nhập để chỉ đọc — email là kênh nhận link đặt lại mật khẩu, cho đổi tự do mà không xác minh thì gõ nhầm một ký tự là mất đường lấy lại tài khoản."*
5. **[MỚI]** Demo **quên mật khẩu**: bấm **Đăng xuất** (chỉ luôn dòng thông báo *"Bạn đã đăng xuất."* hiện ra giữa-trên) → vào `/login` → bấm **"Quên mật khẩu?"** ngay cạnh ô mật khẩu → nhập email → mở hộp thư cho hội đồng xem mail thật → bấm link → đặt mật khẩu mới → đăng nhập lại.
6. Nói 1 câu chuyển: "Tài khoản này bây giờ Tân sẽ dùng để đi mua hàng thật."

**Điểm nhấn kỹ thuật đáng nói khi demo quên mật khẩu** (chọn 1-2 câu, đừng nói hết):

- Trang này **luôn trả về đúng một câu như nhau** dù email có tài khoản hay không — nếu phân biệt, đây thành công cụ dò xem email nào đã đăng ký.
- Trong cơ sở dữ liệu **chỉ lưu bản băm SHA-256** của mã, không lưu mã gốc. Ai đọc được cơ sở dữ liệu cũng không dựng lại được link đặt lại mật khẩu.
- Link sống 30 phút, dùng **một lần**. Đặt lại xong thì mọi link cũ còn treo đều bị tiêu.

**Câu hỏi phản biện dự kiến:**
- *"Vì sao chọn JWT thay vì session?"* → Không cần lưu state phía server, dễ scale ngang, phù hợp kiến trúc REST tách bạch frontend/backend.
- *"Token có cơ chế refresh không?"* → Chưa có refresh token, access token sống 24 giờ (đủ cho phạm vi đồ án); hướng phát triển thêm là refresh token ngắn hạn hơn.
- *"Mật khẩu lưu thế nào?"* → Hash BCrypt một chiều, không bao giờ lưu plaintext.
- **[MỚI]** *"Token hết hạn thì sao?"* → Frontend đọc trường `exp` ngay lúc khôi phục phiên và **hẹn giờ tự đăng xuất đúng thời điểm token hết hạn**, không đợi tới khi tình cờ có lời gọi API bị từ chối mới biết. Backend vẫn là nơi quyết định thật.
- **[MỚI]** *"Đổi mật khẩu xong thì phiên đang mở của kẻ chiếm tài khoản có bị đá không?"* → **Chưa** — JWT không trạng thái, không có danh sách thu hồi, nên token đã cấp vẫn sống tới hết 24 giờ. Nhóm biết giới hạn này và ghi rõ trong mã; muốn xử lý triệt để phải thêm số phiên bản token vào bảng users. **Trả lời thật, đừng nói là đã chặn.**

---

### Phần 1 — Trần Minh Tân: Trải nghiệm mua sắm (2.5 phút)

**Mục tiêu:** cho thấy giao diện khách hàng mượt, đầy đủ vòng đời từ xem sản phẩm tới giỏ hàng.

**Các bước thao tác:**

1. Từ trang chủ (`/`): chỉ nhanh khối Hero (ảnh luân phiên), lướt xuống danh sách sản phẩm nổi bật.
2. Bấm vào 1 sản phẩm → trang chi tiết `/products/:id`: chỉ ra ảnh, giá (giá gốc + giá khuyến mãi nếu có, hiện giá gạch ngang), chọn size/màu (biến thể), phần đánh giá + **phân bố rating** (biểu đồ 5 mức sao).
3. Bấm icon **trái tim** (thêm vào yêu thích) trên 1 sản phẩm ở danh sách — minh hoạ nhanh Wishlist mà không cần vào hẳn trang `/wishlist`.
4. Ở trang chi tiết, chọn size/màu, bấm **Thêm vào giỏ**.
5. Vào `/cart`: chỉ ra danh sách sản phẩm, checkbox chọn từng dòng (tính năng **mua một phần giỏ hàng** — không phải lúc nào cũng phải mua hết giỏ), sửa số lượng, xoá 1 dòng.
6. Bấm **Mua hàng** (chỉ với các dòng đã tick chọn) → chuyển sang Checkout, bàn giao cho Cường.

**Lời dẫn mẫu (đoạn chuyển giao):**
> "Giỏ hàng của NovaCart cho phép khách chọn mua từng phần thay vì bắt buộc thanh toán cả giỏ cùng lúc — ví dụ khách để dành vài món chưa muốn mua ngay. Phần thanh toán tiếp theo, mời Cường."

**Câu hỏi phản biện dự kiến:**
- *"Giỏ hàng của khách chưa đăng nhập lưu ở đâu?"* → Hệ thống hiện yêu cầu đăng nhập mới thao tác được giỏ hàng (route `/cart` nằm trong nhóm bắt buộc đăng nhập), không có giỏ hàng ẩn danh phía client.
- *"Nếu sản phẩm hết hàng giữa lúc đang xem thì sao?"* → Số lượng thêm vào giỏ được so khớp lại với tồn kho thực tế ngay tại API thêm/sửa giỏ hàng, không tin dữ liệu cũ trên giao diện.

---

### Phần 2 — Trần Anh Cường: Checkout, voucher, phí vận chuyển, thanh toán (3 phút)

**Mục tiêu:** đây là phần nghiệp vụ dày nhất — thể hiện rõ tư duy backend: tính lại mọi số tiền phía server, tích hợp 2 cổng thanh toán thật.

**Các bước thao tác:**

1. Ở trang **Xác nhận đặt hàng** (`/checkout`): chỉ mục **Địa chỉ giao hàng** (chọn địa chỉ đã lưu sẵn qua VietMap).
2. **[MỚI]** Nếu tài khoản chưa có số điện thoại, ở đây hiện **lời nhắc màu vàng** đề nghị bổ sung, **điền sẵn số của địa chỉ đang chọn**, bấm một nút là lưu. Nói rõ: *"Đây là nhắc chứ không chặn — đơn hàng không bao giờ thiếu số người nhận vì số đó lấy từ sổ địa chỉ. Cái đang trống là số liên hệ của tài khoản. Dựng rào chắn ngang bước thanh toán vì một thông tin mà đơn hàng không cần là chỗ dễ mất khách nhất."*
3. Chỉ mục **Phương thức thanh toán** — 3 lựa chọn: *Thanh toán khi nhận hàng*, *Chuyển khoản ngân hàng*, *Thanh toán VNPay*.
4. Nhập mã giảm giá còn hiệu lực (vd `GIAM10`) vào ô **Mã giảm giá** → chờ ~0.5s (có debounce) → hệ thống tự hiện **"Áp dụng thành công, giảm {số tiền}"** ngay trong lúc gõ, chưa cần bấm Đặt hàng — nhấn mạnh: đây chỉ là *xem trước*, số tiền thật được tính và trừ lượt dùng ngay trong transaction lúc bấm Đặt hàng, không tách rời 2 bước.
5. Chỉ ra dòng **Phí vận chuyển**: "Đang tính..." rồi ra số tiền thật — giải thích ngắn: hệ thống gọi VietMap Matrix API tính khoảng cách đường bộ thật từ showroom tới địa chỉ giao hàng, công thức 20.000đ cho 5km đầu, +3.000đ mỗi km tiếp theo, miễn phí ship nếu đơn từ 1.000.000đ trở lên.
6. Chọn **Thanh toán VNPay** → bấm **Đặt hàng** → được chuyển sang cổng thanh toán sandbox VNPay thật → điền thẻ test → thanh toán → tự động quay về `/vnpay-result` với trạng thái đã thanh toán.
7. (Nếu còn thời gian) Đặt thêm 1 đơn khác chọn **Chuyển khoản ngân hàng** → chỉ ra mã QR VietQR thật hiện lên trang chi tiết đơn hàng — **KHÔNG quét/chuyển khoản** (xem cảnh báo mục 1.7). Nói: "Vì đây là chuyển khoản thủ công không qua cổng tự động, hệ thống cần nhân viên xác nhận tay sau khi kiểm tra ứng dụng ngân hàng — phần này Thành sẽ cho xem ở khu quản trị."

**Lời dẫn mẫu (mở đầu):**
> "Điểm khác biệt em muốn nhấn mạnh: mọi số tiền hiển thị ở đây — tạm tính, phí ship, giảm giá, tổng — đều được **tính lại hoàn toàn phía server** dựa trên giá và tồn kho thật tại thời điểm đặt hàng, không tin bất kỳ số nào frontend gửi lên. Kể cả khách có sửa giá trong DevTools, backend vẫn tự tính lại đúng."

**Câu hỏi phản biện dự kiến:**
- *"Phí ship tính sai/API bản đồ lỗi thì sao?"* → Có cơ chế fallback: nếu VietMap timeout hoặc địa chỉ chưa có toạ độ, tự động rơi về công thức cố định theo nội/ngoại thành Hà Nội, không để lỗi gọi API ngoài chặn cả việc đặt hàng.
- *"VNPay xác thực đơn hàng như thế nào, có bị giả mạo được không?"* → Toàn bộ callback từ VNPay đều được verify chữ ký HMAC-SHA512 bằng secret key riêng, đối chiếu đúng số tiền `vnp_Amount` khớp với tổng đơn hàng trong DB trước khi đánh dấu đã thanh toán — không tin mù tham số trả về.
- *"1 đơn hàng có thể bị thanh toán 2 lần không (double-click)?"* → Callback VNPay có kiểm tra idempotent: nếu đơn đã ở trạng thái đã thanh toán thì các lần gọi lại sau chỉ trả về thành công, không xử lý lại.
- **[MỚI]** *"Mã giảm giá dùng đồng thời ở 2 đơn có bị double-spend không?"* → Hai lớp: khoá pessimistic lock trên dòng voucher lúc tăng lượt dùng, **và** ràng buộc UNIQUE `(voucher_id, user_id)` trong cơ sở dữ liệu. Lớp thứ hai mới là lớp thực sự chặn — hai lần đặt hàng song song của cùng một khách đều có thể đọc thấy "chưa dùng" trước khi ai kịp ghi.
- **[MỚI]** *"Một khách có thể dùng đi dùng lại cùng một mã không?"* → Không. Mỗi khách chỉ dùng **mỗi mã một lần**. Trước đây voucher chỉ có một con số đếm tổng nên mã đặt giới hạn 100 lượt có thể bị **một người** dùng hết cả 100.
- **[MỚI]** *"Khách bấm huỷ giao dịch ở cổng VNPay thì màn hình báo gì?"* → Báo **thất bại**, đơn giữ nguyên chưa thanh toán để khách trả lại được. (Đây từng là lỗi: hệ thống báo "Thanh toán thành công" cho giao dịch khách vừa huỷ — xem phần QA của Tùng.)

---

### Phần 3 — Nguyễn Đức Thành: Giao diện quản trị & Bán hàng tại quầy (2.5 phút)

**Mục tiêu:** cho thấy công cụ vận hành đầy đủ cho chủ shop lẫn nhân viên bán hàng, và UI có tư duy responsive.

**Các bước thao tác — Quản lý sản phẩm (`/admin/products`):**

1. Bấm **+ Thêm sản phẩm** → chỉ nhanh form: tên, danh mục, thương hiệu, giá gốc/giá khuyến mãi, chất liệu (chọn từ danh sách gợi ý có sẵn), mô tả, **upload ảnh trực tiếp từ máy**, thêm nhiều dòng phân loại size/màu/SKU/tồn kho.
2. Bấm **Lưu sản phẩm** → sản phẩm xuất hiện ngay trong bảng.
3. Ở bảng danh sách, bấm mũi tên mở rộng 1 dòng sản phẩm → chỉ **nút +/- điều chỉnh nhanh tồn kho** ngay trong bảng, không cần mở lại form sửa cả sản phẩm.

**Các bước thao tác — Quản lý đơn hàng (`/admin/orders`):**

4. Mở danh sách đơn. **[MỚI]** Chỉ ra **cột "Thanh toán"** — hiện phương thức (COD / Chuyển khoản / VNPay) và tình trạng (Chưa thanh toán / Đã thanh toán / Đã đảo khoản). Nói: *"Cột này mới thêm sau khi soát lại nghiệp vụ — trước đây bảng không hiện phương thức thanh toán ở đâu cả, nên người duyệt hoàn tiền không có tín hiệu nào để nghi ngờ một đơn chưa từng thu tiền."*
5. Chỉ đơn VNPay Cường vừa đặt đã ở trạng thái **"Chờ vận chuyển"**, đơn COD/chuyển khoản đang **"Chờ thanh toán"**.
6. Nếu có đơn chuyển khoản chưa thanh toán: bấm **"Xác nhận đã nhận CK"** → chuyển đơn thành đã thanh toán (đây chính là bước thay thế cho việc chuyển khoản thật, xem mục 1.7).
7. Bấm **"→ Xác nhận (chờ vận chuyển)"** trên 1 đơn COD → giải thích: bước này mới thực sự trừ kho, có kiểm tra lại tồn kho ngay lúc xác nhận (đề phòng giữa lúc đặt và lúc xác nhận, hàng đã bán hết cho đơn khác).
8. **[MỚI]** Bấm tiếp **"→ Giao cho vận chuyển"** rồi chỉ ra đơn ở trạng thái **"Chờ nhận hàng"** có **hai** lựa chọn: *"→ Đã giao hàng"* và **"Huỷ đơn (giao thất bại)"**. Nói: *"Nút huỷ ở đây dành cho ca giao thất bại — khách từ chối nhận, hàng quay về shop. Thiếu nó thì nhân viên muốn đóng đơn buộc phải bấm 'Đã giao hàng', tức là ghi nhận sai sự thật — mà với đơn COD, 'đã giao' lại là căn cứ để hệ thống tin khách đã trả tiền."*
9. **[MỚI]** Trên 1 đơn COD đã giao, chỉ nút **"Xác nhận đã thu tiền COD"**. Nói: *"Trước đây chỉ đơn chuyển khoản mới có bước xác nhận, còn đơn COD giữ trạng thái 'chưa thanh toán' vĩnh viễn dù khách đã đưa tiền cho shipper — nên mọi chỗ cần biết khách đã trả tiền chưa đều phải suy đoán. Nay không còn chỗ nào phải đoán."*

**Các bước thao tác — Phân quyền nhân viên (`/admin/permissions`, chỉ ADMIN thấy):**

10. Chỉ ma trận quyền theo nhóm (Sản phẩm, Danh mục & Thương hiệu, Đơn hàng, Mã giảm giá, Thống kê, Bán hàng tại quầy).
11. Bật thử quyền **PRODUCT_WRITE** cho STAFF → bấm **Lưu thay đổi** → nói: "Thay đổi có hiệu lực ngay lập tức, nhân viên đang đăng nhập không cần đăng xuất vào lại."

**Các bước thao tác — Bán hàng tại quầy (`/admin/pos`):**

12. Bấm **+ Hoá đơn mới**.
13. Ở cột giữa, gõ tên sản phẩm vào ô tìm, bấm **Tìm** → bấm chọn 1 phân loại size/màu để thêm vào hoá đơn (số trong ngoặc là tồn kho còn lại, hết hàng thì nút tự mờ đi không bấm được).
14. Sửa số lượng trực tiếp trên dòng sản phẩm trong hoá đơn.
15. Chọn phương thức **Tiền mặt**, bấm **Thanh toán** → hoá đơn chuyển trạng thái **"Đã thanh toán"**.
16. Bấm **In hoá đơn** → mở tab in riêng (`/admin/pos/invoices/:id/print`), không có sidebar quản trị — thiết kế để in nhiệt/in khổ nhỏ tại quầy.

**Lời dẫn mẫu (mở đầu):**
> "Khác với nhiều đồ án chỉ có 1 kênh bán online, NovaCart có thêm hẳn 1 module bán tại quầy độc lập — vì luồng nghiệp vụ khác hẳn: đơn tại quầy trừ kho ngay lúc thêm sản phẩm vào hoá đơn, không đợi bước xác nhận như đơn online."

**Câu hỏi phản biện dự kiến:**
- *"Vì sao tách riêng đơn online và đơn POS, không dùng chung 1 luồng?"* → Thời điểm trừ kho khác nhau (online trừ lúc admin xác nhận, POS trừ ngay lúc thêm hàng vì khách đang đứng tại quầy chờ lấy hàng) — dùng chung sẽ gây trừ kho sai thời điểm hoặc trừ 2 lần.
- *"STAFF có thể tự cấp quyền cho chính mình không?"* → Không, trang Phân quyền nhân viên bị khoá cứng chỉ ADMIN truy cập được ở tầng bảo mật backend, không qua được dù có sửa URL trực tiếp.
- *"Ảnh sản phẩm upload lưu ở đâu?"* → Lưu file tĩnh phía server (thư mục `uploads/`), trả về URL để frontend hiển thị.

---

### **[MỚI]** Phần 3b — Nguyễn Đức Thành: Luồng trả hàng & hoàn tiền (2 phút)

**Mục tiêu:** đây là nghiệp vụ mới và đầy đủ nhất đợt này — đi qua **cả hai vai** (khách và admin) và **ba bước cách nhau về thời gian**. Cần 2 cửa sổ trình duyệt (mục 1.8) và 1 đơn COD đã giao chuẩn bị sẵn (mục 1.5).

**Bước 1 — phía khách (cửa sổ khách hàng):**

1. Vào `/orders` → mở đơn COD đã giao → bấm **"Yêu cầu trả hàng/hoàn tiền"**.
2. Nhập lý do → chỉ ra phần **"Tài khoản nhận tiền hoàn"** hiện ra bên dưới: chọn **ngân hàng** (ô gõ tìm trong danh sách 40 ngân hàng Việt Nam), **số tài khoản**, **chủ tài khoản**.
3. Thử bấm gửi khi bỏ trống → hệ thống báo lỗi cụ thể từng ô (*"Vui lòng chọn ngân hàng nhận tiền hoàn"*), không gộp thành một câu chung chung.
4. Dán số tài khoản **kèm dấu cách theo nhóm** (`1234 5678 9012` — đúng như ngân hàng hiển thị) → hệ thống **tự dọn**, không bắt khách tự xoá.
5. Gửi → đơn chuyển sang **"Đang xử lý trả hàng"**, hiện dòng *"Đang chờ hoàn tiền về Vietcombank — 123456789012"*.

**Bước 2 — phía admin (cửa sổ admin):**

6. Vào `/admin/orders` → đơn đó hiện **ô vàng "Chờ chuyển tiền hoàn"** ngay tại dòng đơn, kèm đủ 3 thông tin để nhân viên gõ vào app ngân hàng (số tài khoản dùng font đều để dò đỡ nhầm hàng).
7. Bấm **"Duyệt trả hàng"** → đơn sang **"Đã trả hàng/hoàn tiền"**, kho được hoàn.
8. **Nhấn mạnh:** đơn **vẫn** nằm trong ô vàng "Chờ chuyển tiền hoàn". Nói: *"Duyệt trả hàng không có nghĩa là đã chuyển tiền. Đây chính là lỗi nhóm em tìm ra khi soát lại: hệ thống cũ đánh dấu 'đã hoàn tiền' ngay lúc duyệt, trong khi tiền còn nguyên trong tài khoản shop và không ai tra được đã chuyển hay chưa."*

**Bước 3 — admin xác nhận đã chuyển:**

9. Bấm **"Xác nhận đã hoàn tiền"** → hộp thoại xác nhận (*"Chỉ bấm sau khi đã thực sự chuyển khoản thành công. Thao tác này không hoàn tác được."*) → đồng ý.
10. Quay lại cửa sổ khách → tải lại trang đơn → hiện *"Đã hoàn tiền ngày …"*.

**Nếu còn thời gian, chỉ thêm 1 trong 2 ca dưới (chọn 1):**

- **Huỷ đơn đã thanh toán:** khách huỷ một đơn VNPay đã trả tiền → hệ thống mở form khai tài khoản nhận, không cho huỷ thẳng. Nói: *"Trước đây huỷ đơn đã trả 900 nghìn thì hệ thống ghi 'đã hoàn tiền' mà không hỏi số tài khoản, không đưa vào hàng chờ nào — tiền nằm im ở shop và không ai còn biết là đang nợ khách."*
- **Admin huỷ đơn đã thanh toán:** ô vàng hiện dòng đỏ *"Chưa có tài khoản nhận — liên hệ khách để lấy thông tin"* kèm nút **"Nhập tài khoản nhận"** để admin điền hộ sau khi gọi điện.

**Câu hỏi phản biện dự kiến:**
- *"Vì sao không tự động hoàn tiền qua VNPay?"* → Chưa tích hợp API hoàn tiền của cổng thanh toán; mọi khoản hoàn hiện chuyển khoản tay. **Trả lời thật.**
- *"Đơn COD khách chưa trả tiền thì có đòi hoàn được không?"* → Không. Chỉ đơn đã xác nhận thu được tiền mới sinh khoản phải hoàn — đúng ca "giao thất bại" ở bước 8 phần trước.
- *"Sao phải tách 'đã duyệt trả hàng' với 'đã hoàn tiền'?"* → Hai việc cách nhau thật: duyệt xong còn phải nhận hàng về, kiểm hàng, rồi mới ra ngân hàng chuyển. Gộp làm một là hệ thống nói dối khách.

---

### Phần 3c — Trần Anh Cường: Trang Thống kê (1.5 phút)

**Mục tiêu:** cho thấy dữ liệu tổng hợp real-time đúng ngay từ các thao tác vừa demo ở trên.

**Các bước thao tác:**

1. Vẫn ở tài khoản `admin`, chuyển sang `/admin/statistics`.
2. Bấm nút chọn nhanh **"Hôm nay"** hoặc **"30 ngày"** → chỉ 5 ô số liệu tổng quan: Doanh thu gộp, Hoàn trả, Doanh thu thuần, Số đơn thành công, Giá trị đơn trung bình — kèm mũi tên xanh/đỏ so với kỳ trước.
3. Thử lọc theo **Danh mục** hoặc **Thương hiệu** → số liệu tự cập nhật lại, giải thích ngắn: doanh thu khi lọc theo danh mục chỉ tính đúng phần của các sản phẩm thuộc danh mục đó trong đơn, không cộng nhầm cả đơn nếu khách mua lẫn nhiều loại hàng khác nhau.
4. Chỉ biểu đồ **Doanh thu theo ngày** (cột cam) và **Hoàn trả** (cột đỏ, vẽ âm xuống dưới trục).
5. Chỉ biểu đồ tròn **Phương thức thanh toán** và biểu đồ ngang **Doanh thu theo danh mục**.
6. Chỉ bảng **Cảnh báo tồn kho thấp** — nói rõ đây luôn là tồn kho hiện tại, không phụ thuộc khoảng ngày đang xem.
7. Bấm **Xuất CSV** → mở file vừa tải để chứng minh dữ liệu xuất ra khớp với những gì vừa xem.

**Lời dẫn mẫu:**
> "Số liệu ở đây không chỉ đơn thuần cộng tổng đơn hàng — nhóm đã xử lý riêng nhiều trường hợp đặc biệt: đơn hoàn trả vẫn được tính đúng ngày thực sự hoàn (không phải ngày tạo đơn), đơn chuyển khoản tại quầy chưa được xác nhận thanh toán sẽ không bị tính nhầm vào doanh thu."

**Câu hỏi phản biện dự kiến:**
- *"Doanh thu 'gộp' và 'thuần' khác nhau thế nào?"* → Gộp = mọi giao dịch từng bán thành công (kể cả đơn sau đó bị hoàn); Thuần = gộp trừ đi phần đã hoàn, luôn là số tiền thực sự còn giữ được, không bao giờ âm.
- *"Vì sao tách đơn online và POS riêng trong thống kê?"* → Để chủ shop so sánh hiệu quả từng kênh bán, đồng thời vẫn cộng gộp được tổng thể khi cần.
- **[MỚI]** *"Đơn COD chưa thu được tiền có bị tính vào doanh thu không?"* → Không. Trước đây phải mở ngoại lệ "COD thì luôn tính" vì hệ thống không biết đơn COD đã thu tiền hay chưa; nay có bước xác nhận riêng nên bỏ được ngoại lệ đó, và đơn COD giao hỏng không còn bị tính nhầm.

---

### Phần 4 — Nguyễn Thanh Long: Chatbot AI (RAG) & cơ sở dữ liệu (1.5 phút)

**Mục tiêu:** minh hoạ trợ lý AI trả lời dựa trên dữ liệu thật, không bịa thông tin.

**Chuẩn bị riêng:** phải dùng cửa sổ đã **đăng nhập khách hàng** — widget chat ẩn hoàn toàn nếu chưa đăng nhập.

**Các bước thao tác:**

1. Ở bất kỳ trang khách hàng nào, bấm biểu tượng chat nổi góc màn hình.
2. Chỉ tin nhắn chào mừng tự động: *"Chào bạn! Mình là trợ lý tư vấn của NovaCart. Bạn đang tìm món đồ như thế nào — dịp mặc, ngân sách, size ra sao để mình gợi ý cho đúng nhé?"*
3. Gõ 1 câu hỏi thực tế liên quan đúng sản phẩm đang có trong DB, ví dụ: *"Shop có áo sơ mi không?"* → chatbot trả lời kèm **số lượng thật** và **đường dẫn tới từng sản phẩm** (vd *"hiện có 11 mẫu áo sơ mi… (/products/2), (/products/408)…"*).
4. Hỏi tiếp 1 câu follow-up (giữ cùng phiên chat, có `sessionId`) để cho thấy chatbot nhớ ngữ cảnh, vd: *"Còn màu gì?"*.
5. Giải thích luồng kỹ thuật (nói, không cần thao tác): Java backend đóng vai trò cầu nối — không lộ API key ra frontend, gắn `userId` thật lấy từ JWT rồi mới gọi sang kit Node.js RAG riêng; kit đồng bộ dữ liệu sản phẩm định kỳ, tạo embedding, truy hồi (retrieve) đúng sản phẩm liên quan rồi mới đưa cho LLM sinh câu trả lời — nên không bịa sản phẩm không tồn tại.

**Câu hỏi phản biện dự kiến:**
- *"Nếu khách hỏi sản phẩm không có trong shop thì sao?"* → Chatbot chỉ trả lời dựa trên dữ liệu truy hồi được (RAG), không có dữ liệu liên quan thì sẽ báo không tìm thấy thay vì bịa ra sản phẩm.
- *"Dữ liệu sản phẩm đồng bộ sang chatbot bao lâu 1 lần?"* → Có cơ chế đồng bộ theo lịch (scheduler) + endpoint nội bộ có xác thực riêng bằng secret, không phải API công khai.
- *"Vì sao tách chatbot thành service Node.js riêng thay vì viết thẳng trong Java?"* → Hệ sinh thái thư viện RAG/embedding ở Node.js phong phú và nhanh triển khai hơn cho phạm vi đồ án; Java chỉ đóng vai trò gateway bảo mật.

---

### Phần 5 — Trịnh Thanh Tùng: Minh chứng chất lượng — QA (1.5 phút)

**Mục tiêu:** không lặp lại thao tác chức năng — chứng minh nhóm có tư duy kiểm thử thật, hệ thống tự bảo vệ đúng trước các tình huống sai.

**Các bước thao tác (chọn 2-3 case tuỳ thời gian còn lại):**

1. Ở giỏ hàng hoặc form sửa số lượng, thử nhập số lượng **vượt tồn kho thực tế** → hệ thống báo lỗi rõ ràng dạng "Sản phẩm chỉ còn {n} sản phẩm trong kho", không cho thêm.
2. **[MỚI]** Ở checkout, áp lại **đúng mã giảm giá khách vừa dùng ở đơn trước** → hệ thống báo *"Bạn đã sử dụng mã giảm giá này rồi, mỗi khách chỉ được dùng một lần"* — và báo ngay ở bước **xem trước**, không đợi tới lúc bấm Đặt hàng.
3. Đăng nhập bằng tài khoản **STAFF** đã chuẩn bị (mục 1.3), thử gõ thẳng URL 1 trang chỉ-ADMIN (vd `/admin/permissions`) → bị điều hướng ra ngoài ngay (chặn ở cả giao diện lẫn API backend, gọi thẳng API cũng nhận về lỗi 403).
4. (Nếu có tài khoản STAFF chưa được cấp `PRODUCT_WRITE`) thử vào trang Sản phẩm, chỉ ra không có nút "+ Thêm sản phẩm"/"Sửa" — minh hoạ phân quyền động, không chỉ ẩn trên giao diện mà API cũng từ chối nếu cố gọi thẳng.

**[MỚI] Số liệu kiểm thử thật — chuẩn bị sẵn slide, đọc đúng con số, đừng làm tròn lên:**

| Loại | Số lượng | Phạm vi phủ |
|---|---|---|
| Test đơn vị backend (JUnit + Mockito, không cần cơ sở dữ liệu) | **160** | Logic quyết định: chuyển trạng thái, trừ/hoàn kho, tính tiền, phân quyền |
| Test frontend (Vitest) | **54** | Hàm thuần: đọc hạn token, kiểm số điện thoại/số tài khoản, hàng đợi thông báo |
| Công cụ bắn thẳng vào API đang chạy (`backend/tools/`) | **8** | Luồng đầy đủ qua HTTP thật: hoàn tiền, huỷ đơn, voucher, IPN VNPay, đua tranh tồn kho, hồ sơ, gửi mail |

**Nói rõ giới hạn — đây là điểm cộng, không phải điểm trừ:**
> "160 test đơn vị chứng minh **logic quyết định** đúng, nhưng **không** chứng minh được khoá bi quan có thật sự khoá được dòng dữ liệu hay không — đó là hành vi của SQL Server. Nhóm em kiểm riêng bằng công cụ bắn 10 request song song cùng mua sản phẩm cuối cùng: **5 thành công, 5 bị từ chối, tồn kho về đúng 0**, và đọc được câu SQL thật Hibernate sinh ra có `with (updlock, holdlock, rowlock)`."

**[MỚI] Vài lỗi tiêu biểu nhóm tự tìm ra và đã sửa — chọn 1-2 cái kể, đây là phần gây ấn tượng nhất:**

- **Hệ thống báo "đã hoàn tiền" khi tiền chưa hề chuyển đi.** Duyệt trả hàng là tự đánh dấu đã hoàn, trong khi tiền còn nguyên trong tài khoản shop. Nay tách thành hai trạng thái riêng, có bước admin xác nhận đã chuyển khoản.
- **Khách huỷ đơn đã thanh toán 900 nghìn thì tiền biến mất khỏi mọi danh sách.** Đơn ghi "đã hoàn tiền" nhưng không hỏi số tài khoản, không vào hàng chờ nào — đo được bằng thực nghiệm: 0 đơn trong danh sách chờ chuyển tiền.
- **Trang kết quả báo "Thanh toán thành công" cho giao dịch khách vừa bấm huỷ ở cổng VNPay.** Một giá trị enum bị dùng cho hai câu hỏi khác nhau: "mình đã xử lý xong thông báo chưa" và "khách đã trả tiền chưa".
- **Cột dữ liệu mới bị mất dấu tiếng Việt.** "Vietcombank (Ngoại thương)" lưu xuống thành "Vietcombank (Ngo?i thuong)" — ghi thành công, không lỗi, không cảnh báo, chỉ có dữ liệu là sai. Do Hibernate tạo cột `varchar` thay vì `nvarchar` trên SQL Server.

**Lời dẫn mẫu:**
> "Phần của em không lặp lại các chức năng đã trình bày, mà cho hội đồng thấy hệ thống phản ứng đúng khi có input sai hoặc thao tác trái phép. Điểm em muốn nhấn mạnh: những lỗi vừa kể **không phải lỗi làm hệ thống hỏng** — nó vẫn chạy, vẫn báo thành công, chỉ là nói sai sự thật. Đó chính là loại lỗi mà kiểm thử bằng mắt không bao giờ bắt được."

**Câu hỏi phản biện dự kiến:**
- *"Nhóm kiểm thử thủ công hay có viết test tự động?"* → Cả hai: bộ test tự động ở bảng trên, cộng kịch bản kiểm thử tay trong `doc/kich-ban-kiem-thu.md`.
- *"Có kiểm thử hiệu năng/tải không?"* → Chưa có kiểm thử tải tổng thể. Có kiểm thử **đua tranh** (concurrency) ở đúng chỗ nguy hiểm nhất là trừ kho. **Trả lời trung thực, đừng phóng đại.**
- **[MỚI]** *"Làm sao nhóm tìm ra những lỗi đó?"* → Viết bộ tiêu chí soát rồi nhờ soát độc lập từng luồng nghiệp vụ, và bắt buộc mọi phát hiện phải kèm **kịch bản tái hiện cụ thể** — nghi ngờ suông không tính. Xem `doc/prompt-review-luong-nghiep-vu.md` và `doc/bao-cao-soat-luong-nghiep-vu.md`.

---

### Kết — Trần Quang Huy (1 phút)

**Lời dẫn mẫu:**
> "Tóm lại, NovaCart giải quyết trọn vẹn bài toán bán hàng đa kênh: online tự động tính phí ship theo khoảng cách thật, 2 cổng thanh toán điện tử, quản trị và bán tại quầy trong cùng 1 hệ thống, phân quyền linh hoạt cho nhân viên, luồng trả hàng — hoàn tiền theo dõi được tới từng đồng, trợ lý AI tư vấn dựa trên dữ liệu thật, và một quy trình kiểm thử xuyên suốt. Nhóm em xin phép dừng phần trình bày tại đây và sẵn sàng nhận câu hỏi từ hội đồng."

---

## 4. Bảng câu hỏi phản biện dự kiến (tổng hợp nhanh cho cả nhóm đọc trước)

| Chủ đề | Câu hỏi khả năng cao | Người trả lời chính |
|---|---|---|
| Kiến trúc | Vì sao tách chatbot thành service riêng? | Huy / Long |
| Bảo mật | Mật khẩu, JWT, RBAC hoạt động ra sao? | Huy |
| Bảo mật | **[MỚI]** Quên mật khẩu có bị lợi dụng để dò tài khoản không? | Huy |
| Thanh toán | VNPay verify chữ ký thế nào, có double-charge được không? | Cường |
| Vận chuyển | Phí ship tính sai khi API bản đồ lỗi thì sao? | Cường |
| Mã giảm giá | **[MỚI]** Một khách dùng lại cùng một mã được không? | Cường |
| Đơn hàng | Vì sao tách luồng online/POS riêng? | Thành |
| Đơn hàng | **[MỚI]** Đơn giao thất bại xử lý thế nào? | Thành |
| Hoàn tiền | **[MỚI]** Vì sao tách "duyệt trả hàng" với "đã hoàn tiền"? | Thành |
| Phân quyền | STAFF có tự cấp quyền được không? | Thành |
| Thống kê | Doanh thu gộp/thuần khác nhau ra sao? | Cường |
| AI | Chatbot có bịa thông tin sản phẩm không? | Long |
| QA | Quy trình kiểm thử thực tế nhóm áp dụng là gì? | Tùng |

---

## 5. Rủi ro thường gặp & cách xử lý nhanh tại chỗ

| Sự cố | Cách xử lý ngay |
|---|---|
| **[MỚI]** `start.bat` báo `[bo qua]` mà dịch vụ đó thật ra bị kẹt | Chạy `restart.bat` — diệt theo PID đang giữ cổng rồi bật lại từ đầu |
| **[MỚI]** Cửa sổ Chatbot Server báo lỗi ngay lúc khởi động | Thiếu `chatbot/.env`. Backend/frontend vẫn chạy bình thường, chỉ khung chat không trả lời — bỏ phần demo chatbot, đừng cố sửa live |
| **[MỚI]** Bấm "Quên mật khẩu" ra lỗi "chưa cấu hình gửi email" | Thiếu `backend/config/application.properties` (mục 1.4). Bỏ bước demo quên mật khẩu, các phần khác không ảnh hưởng |
| VNPay sandbox lỗi/không vào được | Chuyển ngay sang demo "Chuyển khoản ngân hàng" (chỉ hiện QR, không quét), nói ngắn gọn "đây là môi trường sandbox của bên thứ ba, đôi khi có bảo trì" |
| Mất mạng / VietMap API không phản hồi | Phí ship tự động fallback về công thức cố định — vẫn demo được, chỉ cần nói rõ đây là nhánh dự phòng đang chạy |
| Quên mật khẩu admin lúc demo | Đã đổi về `admin@123`, ghi sẵn trên giấy nháp phòng khi gõ nhầm |
| Chatbot phản hồi chậm/lỗi | Có sẵn 1-2 câu hỏi đã test chạy mượt trước đó, ưu tiên hỏi đúng câu đó thay vì ứng biến |

---

## 6. Cắt gọt khi thiếu thời gian (bỏ theo đúng thứ tự này)

1. Demo VietQR ở Phần 2 (bước 7)
2. Hai ca phụ ở cuối Phần 3b (huỷ đơn đã thanh toán)
3. Case thứ 4 ở Phần 5 (STAFF thiếu quyền `PRODUCT_WRITE`)
4. Bước quên mật khẩu ở Phần 0 (bước 5) — **giữ lại nếu còn được**, vì đây là chức năng hội đồng hay hỏi
5. Phần POS in hoá đơn (Phần 3, bước 16)

**Nếu thừa thời gian:** demo sửa/xoá sản phẩm, demo hoàn/huỷ hoá đơn POS, demo responsive trên điện thoại thật, chỉ thêm ca "admin huỷ đơn đã thanh toán rồi nhập tài khoản nhận hộ khách".

---

*Tài liệu được tạo dựa trên đối chiếu trực tiếp với mã nguồn dự án tại thời điểm soạn thảo (04/09/2026). Trước ngày bảo vệ chính thức, chạy thử lại toàn bộ kịch bản 1 lượt để phát hiện phần nào đã thay đổi so với tài liệu này.*
