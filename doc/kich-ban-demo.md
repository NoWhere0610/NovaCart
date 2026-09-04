# Kịch bản Demo NovaCart

> Tài liệu nội bộ nhóm — dùng để tổng duyệt và trình bày buổi bảo vệ đồ án tốt nghiệp.
> Toàn bộ URL, nhãn nút, thông báo lỗi trong tài liệu này được lấy đúng từ mã nguồn hiện tại (không phải suy đoán) — nếu code đổi, phải cập nhật lại file này.

## 0. Danh sách phân công

| # | Thành viên | MSSV | Vai trò | Phần trình bày |
|---|---|---|---|---|
| 1 | Trần Quang Huy | TH04281 | Trưởng nhóm / Backend | Mở đầu, kiến trúc hệ thống, xác thực |
| 2 | Trần Anh Cường | TH04276 | Backend | Thanh toán (VNPay/VietQR), phí vận chuyển, voucher, thống kê |
| 3 | Trần Minh Tân | TH02474 | Frontend | Trải nghiệm mua sắm (trang chủ → giỏ hàng) |
| 4 | Nguyễn Đức Thành | TH02301 | Frontend / UI-UX | Giao diện quản trị, bán hàng tại quầy (POS), responsive |
| 5 | Nguyễn Thanh Long | TH02579 | Database / AI-RAG | Cơ sở dữ liệu, chatbot AI (RAG) |
| 6 | Trịnh Thanh Tùng | TH04097 | QA / Tester | Kế hoạch kiểm thử, minh chứng chất lượng |

**Tổng thời lượng đề xuất:** ~14-15 phút trình bày + phần hỏi đáp. Có thể co giãn theo hướng dẫn ở mục 6.

---

## 1. Chuẩn bị trước buổi demo (làm trước ít nhất 1 ngày, kiểm lại lần cuối trước giờ bảo vệ 30-60 phút)

### 1.1. Môi trường chạy

- [ ] Chạy `start.bat` ở thư mục gốc — xác nhận cả 3 tiến trình lên: backend (cổng **8080**), frontend (cổng **5173**), chatbot RAG kit (cổng **3200**).
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

### 1.4. Dữ liệu cần chuẩn bị sẵn trong DB (qua trang Admin, không cần SQL tay)

- [ ] Ít nhất 1 **voucher còn hạn, còn lượt** (vd `GIAM10`, giảm 10%, còn hiệu lực) để demo áp mã thành công.
- [ ] 1 **voucher đã hết lượt sử dụng** (tạo `usageLimit=1` rồi tự áp dùng hết 1 lần) để Tùng demo case "mã đã hết lượt" bị từ chối.
- [ ] 1-2 sản phẩm có **tồn kho <= 5** ở ít nhất 1 biến thể, để mục "Cảnh báo tồn kho thấp" trong Thống kê có dữ liệu hiển thị (không thì bảng trống, mất đi 1 điểm nhấn).
- [ ] Tài khoản khách hàng test đã **lưu sẵn 1 địa chỉ giao hàng** qua bản đồ VietMap (có toạ độ thật) — để phần tính phí ship theo khoảng cách của Cường có số liệu thật thay vì rơi về công thức fallback cố định.
- [ ] Ít nhất 3-5 đơn hàng lịch sử với trạng thái khác nhau (đã có sẵn từ quá trình phát triển thì không cần tạo thêm) để trang Thống kê không trống trơn khi demo.

### 1.5. VNPay sandbox

- [ ] Test thử 1 lượt thanh toán VNPay đầy đủ **trước buổi bảo vệ tối thiểu 30 phút** — sandbox VNPay đôi khi có bảo trì/đổi thẻ test, không được tin là "hôm trước còn chạy".
- [ ] Tra thẻ test ngân hàng giả lập **mới nhất** tại `sandbox.vnpayment.vn` (thẻ test có thể đổi theo thời gian, không hard-code số thẻ vào tài liệu này).
- [ ] Ghi nhớ: `vnp_ReturnUrl` trỏ về `http://localhost:8080/api/vnpay/return` (backend verify chữ ký) rồi mới redirect sang `http://localhost:5173/vnpay-result` cho khách xem — nếu demo trên máy/mạng khác localhost, phải đổi lại 2 property này trong `application.properties`, không thì callback không bao giờ tới được.

### 1.6. ⚠️ CẢNH BÁO AN TOÀN — đọc kỹ trước khi demo thanh toán chuyển khoản

Mã QR VietQR khi chọn "Chuyển khoản ngân hàng" trỏ tới **tài khoản ngân hàng thật** (BIN 970436, đã cấu hình thật trong `application.properties`), **không phải tài khoản giả lập**.

**Không ai trong nhóm hoặc hội đồng được quét mã và chuyển khoản thật để "test cho vui".** Nếu muốn demo luồng chuyển khoản trọn vẹn:
- Đặt hàng xong, hiện mã QR thật (chỉ hiện, không quét/chuyển).
- Chuyển sang tài khoản `admin` → trang **Quản lý đơn hàng** → bấm **"Xác nhận đã nhận CK"** để giả lập đã nhận được tiền, không cần ai chuyển khoản thật.

### 1.7. Trình duyệt & thiết bị

- [ ] Mở sẵn **2 cửa sổ trình duyệt khác nhau** (hoặc 1 cửa sổ thường + 1 cửa sổ ẩn danh): 1 đăng nhập sẵn tài khoản khách hàng, 1 đăng nhập sẵn `admin` — tránh phải đăng xuất/đăng nhập lại giữa các phần, rất mất thời gian và dễ quên mật khẩu giữa chừng.
- [ ] Tắt hết extension trình duyệt có thể che UI (ad-block, password manager popup).
- [ ] Nếu Thành demo responsive: chuẩn bị sẵn tablet/điện thoại thật hoặc ít nhất bật DevTools responsive mode và test trước với đúng kích thước sẽ dùng lúc demo.
- [ ] Zoom trình duyệt về mức hội đồng ở cuối phòng vẫn đọc được chữ (thường 100-110%, kiểm tra thực tế phòng bảo vệ nếu được).

---

## 2. Sơ đồ thời lượng tổng thể

| Thời điểm | Người trình bày | Nội dung | Thời lượng |
|---|---|---|---|
| 0:00 – 1:30 | Huy | Mở đầu, kiến trúc, đăng ký/đăng nhập | 1.5 phút |
| 1:30 – 4:00 | Tân | Trải nghiệm mua sắm | 2.5 phút |
| 4:00 – 7:00 | Cường | Checkout, voucher, phí ship, thanh toán VNPay/VietQR | 3 phút |
| 7:00 – 9:30 | Thành | Admin: Sản phẩm, Đơn hàng, Phân quyền, POS | 2.5 phút |
| 9:30 – 11:00 | Cường | Trang Thống kê | 1.5 phút |
| 11:00 – 12:30 | Long | Chatbot AI (RAG) | 1.5 phút |
| 12:30 – 14:00 | Tùng | Minh chứng QA — các case hệ thống tự chặn đúng | 1.5 phút |
| 14:00 – 15:00 | Huy | Tổng kết, mở hỏi đáp | 1 phút |

---

## 3. Kịch bản chi tiết từng phần

### Phần 0 — Trần Quang Huy: Mở đầu, kiến trúc hệ thống, xác thực (1.5 phút)

**Mục tiêu:** hội đồng nắm được bức tranh tổng thể trong 90 giây đầu, để các phần sau không cần giải thích lại.

**Lời dẫn mẫu:**

> "Kính thưa hội đồng, nhóm em xin trình bày đồ án NovaCart — hệ thống bán quần áo nam trực tuyến kết hợp bán tại quầy. Về kiến trúc, hệ thống gồm 3 lớp: frontend React + TypeScript + Vite, backend Java Spring Boot cung cấp REST API, và cơ sở dữ liệu SQL Server. Xác thực dùng JWT không trạng thái (stateless), phân quyền theo 3 vai trò: ADMIN có toàn quyền, STAFF theo ma trận quyền admin tự cấu hình, CUSTOMER là khách mua hàng. Em sẽ đăng ký nhanh 1 tài khoản để cả nhóm demo theo đúng hành trình 1 khách hàng thật."

**Các bước thao tác:**

1. Mở `http://localhost:5173/register`.
2. Điền form đăng ký: username, email, mật khẩu, họ tên, số điện thoại (đúng định dạng `03/05/07/08/09` + 10 số — nếu gõ sai định dạng, hệ thống báo lỗi ngay tại chỗ, có thể tận dụng để minh hoạ luôn validate phía client).
3. Bấm **Đăng ký** → tự động đăng nhập, chuyển về trang chủ.
4. Nói 1 câu chuyển: "Tài khoản này bây giờ Tân sẽ dùng để đi mua hàng thật."

**Câu hỏi phản biện dự kiến:**
- *"Vì sao chọn JWT thay vì session?"* → Không cần lưu state phía server, dễ scale ngang, phù hợp kiến trúc REST tách bạch frontend/backend.
- *"Token có cơ chế refresh không?"* → Chưa có refresh token, access token sống 24 giờ (đủ cho phạm vi đồ án); hướng phát triển thêm là refresh token ngắn hạn hơn.
- *"Mật khẩu lưu thế nào?"* → Hash BCrypt một chiều, không bao giờ lưu plaintext.

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
2. Chỉ mục **Phương thức thanh toán** — 3 lựa chọn: *Thanh toán khi nhận hàng*, *Chuyển khoản ngân hàng*, *Thanh toán VNPay*.
3. Nhập mã giảm giá còn hiệu lực (vd `GIAM10`) vào ô **Mã giảm giá** → chờ ~0.5s (có debounce) → hệ thống tự hiện **"Áp dụng thành công, giảm {số tiền}"** ngay trong lúc gõ, chưa cần bấm Đặt hàng — nhấn mạnh: đây chỉ là *xem trước*, số tiền thật được tính và trừ lượt dùng ngay trong transaction lúc bấm Đặt hàng, không tách rời 2 bước.
4. Chỉ ra dòng **Phí vận chuyển**: "Đang tính..." rồi ra số tiền thật — giải thích ngắn: hệ thống gọi VietMap Matrix API tính khoảng cách đường bộ thật từ showroom tới địa chỉ giao hàng, công thức 20.000đ cho 5km đầu, +3.000đ mỗi km tiếp theo, miễn phí ship nếu đơn từ 1.000.000đ trở lên.
5. Chọn **Thanh toán VNPay** → bấm **Đặt hàng** → được chuyển sang cổng thanh toán sandbox VNPay thật → điền thẻ test → thanh toán → tự động quay về `/vnpay-result` với trạng thái đã thanh toán.
6. (Nếu còn thời gian) Đặt thêm 1 đơn khác chọn **Chuyển khoản ngân hàng** → chỉ ra mã QR VietQR thật hiện lên trang chi tiết đơn hàng — **KHÔNG quét/chuyển khoản** (xem cảnh báo mục 1.6). Nói: "Vì đây là chuyển khoản thủ công không qua cổng tự động, hệ thống cần nhân viên xác nhận tay sau khi kiểm tra ứng dụng ngân hàng — phần này Thành sẽ cho xem ở khu quản trị."

**Lời dẫn mẫu (mở đầu):**
> "Điểm khác biệt em muốn nhấn mạnh: mọi số tiền hiển thị ở đây — tạm tính, phí ship, giảm giá, tổng — đều được **tính lại hoàn toàn phía server** dựa trên giá và tồn kho thật tại thời điểm đặt hàng, không tin bất kỳ số nào frontend gửi lên. Kể cả khách có sửa giá trong DevTools, backend vẫn tự tính lại đúng."

**Câu hỏi phản biện dự kiến:**
- *"Phí ship tính sai/API bản đồ lỗi thì sao?"* → Có cơ chế fallback: nếu VietMap timeout hoặc địa chỉ chưa có toạ độ, tự động rơi về công thức cố định theo nội/ngoại thành Hà Nội, không để lỗi gọi API ngoài chặn cả việc đặt hàng.
- *"VNPay xác thực đơn hàng như thế nào, có bị giả mạo được không?"* → Toàn bộ callback từ VNPay đều được verify chữ ký HMAC-SHA512 bằng secret key riêng, đối chiếu đúng số tiền `vnp_Amount` khớp với tổng đơn hàng trong DB trước khi đánh dấu đã thanh toán — không tin mù tham số trả về.
- *"1 đơn hàng có thể bị thanh toán 2 lần không (double-click)?"* → Callback VNPay có kiểm tra idempotent: nếu đơn đã ở trạng thái đã thanh toán thì các lần gọi lại sau chỉ trả về thành công, không xử lý lại.
- *"Mã giảm giá dùng đồng thời ở 2 đơn có bị double-spend không?"* → Có khoá pessimistic lock ở bước tăng lượt dùng, đảm bảo 2 giao dịch đồng thời không cùng vượt qua giới hạn lượt.

---

### Phần 3 — Nguyễn Đức Thành: Giao diện quản trị & Bán hàng tại quầy (2.5 phút)

**Mục tiêu:** cho thấy công cụ vận hành đầy đủ cho chủ shop lẫn nhân viên bán hàng, và UI có tư duy responsive.

**Các bước thao tác — Quản lý sản phẩm (`/admin/products`):**

1. Bấm **+ Thêm sản phẩm** → chỉ nhanh form: tên, danh mục, thương hiệu, giá gốc/giá khuyến mãi, chất liệu (chọn từ danh sách gợi ý có sẵn), mô tả, **upload ảnh trực tiếp từ máy** (tính năng mới, không cần dán URL ảnh), thêm nhiều dòng phân loại size/màu/SKU/tồn kho.
2. Bấm **Lưu sản phẩm** → sản phẩm xuất hiện ngay trong bảng.
3. Ở bảng danh sách, bấm mũi tên mở rộng 1 dòng sản phẩm → chỉ **nút +/- điều chỉnh nhanh tồn kho** ngay trong bảng, không cần mở lại form sửa cả sản phẩm.

**Các bước thao tác — Quản lý đơn hàng (`/admin/orders`):**

4. Mở danh sách đơn — chỉ đơn VNPay Cường vừa đặt đã ở trạng thái **"Chờ vận chuyển"** (tự động vì đã thanh toán), đơn COD/chuyển khoản đang **"Chờ thanh toán"**.
5. Nếu có đơn chuyển khoản UNPAID: bấm **"Xác nhận đã nhận CK"** → chuyển đơn thành đã thanh toán (đây chính là bước thay thế cho việc chuyển khoản thật, xem mục 1.6).
6. Bấm **"→ Xác nhận (chờ vận chuyển)"** trên 1 đơn COD → giải thích: bước này mới thực sự trừ kho, có kiểm tra lại tồn kho ngay lúc xác nhận (đề phòng giữa lúc đặt và lúc xác nhận, hàng đã bán hết cho đơn khác).

**Các bước thao tác — Phân quyền nhân viên (`/admin/permissions`, chỉ ADMIN thấy):**

7. Chỉ ma trận quyền theo nhóm (Sản phẩm, Danh mục & Thương hiệu, Đơn hàng, Mã giảm giá, Thống kê, Bán hàng tại quầy).
8. Bật thử quyền **PRODUCT_WRITE** cho STAFF → bấm **Lưu thay đổi** → nói: "Thay đổi có hiệu lực ngay lập tức, nhân viên đang đăng nhập không cần đăng xuất vào lại."

**Các bước thao tác — Bán hàng tại quầy (`/admin/pos`):**

9. Bấm **+ Hoá đơn mới**.
10. Ở cột giữa, gõ tên sản phẩm vào ô tìm, bấm **Tìm** → bấm chọn 1 phân loại size/màu để thêm vào hoá đơn (số trong ngoặc là tồn kho còn lại, hết hàng thì nút tự mờ đi không bấm được).
11. Sửa số lượng trực tiếp trên dòng sản phẩm trong hoá đơn.
12. Nhập mã giảm giá vào ô riêng của POS, bấm **Áp dụng**.
13. Chọn phương thức **Tiền mặt**, bấm **Thanh toán** → hoá đơn chuyển trạng thái **"Đã thanh toán"**.
14. Bấm **In hoá đơn** → mở tab in riêng (`/admin/pos/invoices/:id/print`), không có sidebar quản trị — thiết kế để in nhiệt/in khổ nhỏ tại quầy.
15. (Nếu còn thời gian) Chỉ nhanh nút **Hoàn/huỷ hoá đơn** trên 1 hoá đơn đã thanh toán — giải thích: dùng khi khách trả hàng ngay tại quầy, tự động hoàn kho + hoàn lượt mã giảm giá nếu có.

**Lời dẫn mẫu (mở đầu):**
> "Khác với nhiều đồ án chỉ có 1 kênh bán online, NovaCart có thêm hẳn 1 module bán tại quầy độc lập — vì luồng nghiệp vụ khác hẳn: đơn tại quầy trừ kho ngay lúc thêm sản phẩm vào hoá đơn, không đợi bước xác nhận như đơn online."

**Câu hỏi phản biện dự kiến:**
- *"Vì sao tách riêng đơn online và đơn POS, không dùng chung 1 luồng?"* → Thời điểm trừ kho khác nhau (online trừ lúc admin xác nhận, POS trừ ngay lúc thêm hàng vì khách đang đứng tại quầy chờ lấy hàng) — dùng chung sẽ gây trừ kho sai thời điểm hoặc trừ 2 lần.
- *"STAFF có thể tự cấp quyền cho chính mình không?"* → Không, trang Phân quyền nhân viên bị khoá cứng chỉ ADMIN truy cập được ở tầng bảo mật backend, không qua được dù có sửa URL trực tiếp.
- *"Ảnh sản phẩm upload lưu ở đâu?"* → Lưu file tĩnh phía server (thư mục `uploads/`), trả về URL để frontend hiển thị.

---

### Phần 3b — Trần Anh Cường: Trang Thống kê (1.5 phút)

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

---

### Phần 4 — Nguyễn Thanh Long: Chatbot AI (RAG) & cơ sở dữ liệu (1.5 phút)

**Mục tiêu:** minh hoạ trợ lý AI trả lời dựa trên dữ liệu thật, không bịa thông tin.

**Chuẩn bị riêng:** phải dùng cửa sổ đã **đăng nhập khách hàng** — widget chat ẩn hoàn toàn nếu chưa đăng nhập.

**Các bước thao tác:**

1. Ở bất kỳ trang khách hàng nào, bấm biểu tượng chat nổi góc màn hình.
2. Chỉ tin nhắn chào mừng tự động: *"Chào bạn! Mình là trợ lý tư vấn của NovaCart. Bạn đang tìm món đồ như thế nào — dịp mặc, ngân sách, size ra sao để mình gợi ý cho đúng nhé?"*
3. Gõ 1 câu hỏi thực tế liên quan đúng sản phẩm đang có trong DB, ví dụ: *"Áo sơ mi nam giá dưới 500 nghìn còn hàng không?"* → chatbot trả lời dựa trên dữ liệu sản phẩm thật.
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
2. Ở checkout, nhập mã giảm giá **đã chuẩn bị sẵn hết lượt** (mục 1.4) → hệ thống báo "Mã giảm giá đã hết lượt sử dụng", không cho áp.
3. Đăng nhập bằng tài khoản **STAFF** đã chuẩn bị (mục 1.3), thử gõ thẳng URL 1 trang chỉ-ADMIN (vd `/admin/permissions`) → bị điều hướng ra ngoài ngay (chặn ở cả giao diện lẫn API backend, gọi thẳng API cũng nhận về lỗi 403).
4. (Nếu có tài khoản STAFF chưa được cấp `PRODUCT_WRITE`) thử vào trang Sản phẩm, chỉ ra không có nút "+ Thêm sản phẩm"/"Sửa" — minh hoạ phân quyền động, không chỉ ẩn trên giao diện mà API cũng từ chối nếu cố gọi thẳng.
5. Chiếu nhanh 1 bảng tóm tắt (chuẩn bị sẵn slide/ảnh chụp, không thao tác live): số lượng test case đã viết, tỷ lệ pass, vài lỗi tiêu biểu phát hiện trong quá trình phát triển và đã được sửa (ví dụ: race condition khi 2 người cùng thao tác 1 đơn hàng, dữ liệu thống kê tính sai khi có đơn hoàn trả) — nhấn mạnh đây là bằng chứng có **quy trình QA thật xuyên suốt dự án**, không phải code xong là coi như hoàn thành.

**Lời dẫn mẫu:**
> "Phần của em không lặp lại các chức năng đã trình bày, mà cho hội đồng thấy hệ thống phản ứng đúng khi có input sai hoặc thao tác trái phép — đây chính là phần việc QA đã kiểm thử xuyên suốt quá trình phát triển, không phải chỉ kiểm thử 1 lần lúc cuối."

**Câu hỏi phản biện dự kiến:**
- *"Nhóm kiểm thử thủ công hay có viết test tự động?"* → Trình bày đúng thực tế nhóm đã làm (thủ công theo test case, hay có unit/integration test tự động) — chuẩn bị câu trả lời thật trước, không nói chung chung.
- *"Có kiểm thử hiệu năng/tải không?"* → Trả lời trung thực về phạm vi đã làm, nếu chưa làm thì nêu đây là hướng phát triển tiếp theo.

---

### Kết — Trần Quang Huy (1 phút)

**Lời dẫn mẫu:**
> "Tóm lại, NovaCart giải quyết trọn vẹn bài toán bán hàng đa kênh: online tự động tính phí ship theo khoảng cách thật, 2 cổng thanh toán điện tử, quản trị và bán tại quầy trong cùng 1 hệ thống, phân quyền linh hoạt cho nhân viên, trợ lý AI tư vấn dựa trên dữ liệu thật, và một quy trình kiểm thử xuyên suốt. Nhóm em xin phép dừng phần trình bày tại đây và sẵn sàng nhận câu hỏi từ hội đồng."

---

## 4. Bảng câu hỏi phản biện dự kiến (tổng hợp nhanh cho cả nhóm đọc trước)

| Chủ đề | Câu hỏi khả năng cao | Người trả lời chính |
|---|---|---|
| Kiến trúc | Vì sao tách chatbot thành service riêng? | Huy / Long |
| Bảo mật | Mật khẩu, JWT, RBAC hoạt động ra sao? | Huy |
| Thanh toán | VNPay verify chữ ký thế nào, có double-charge được không? | Cường |
| Vận chuyển | Phí ship tính sai khi API bản đồ lỗi thì sao? | Cường |
| Đơn hàng | Vì sao tách luồng online/POS riêng? | Thành |
| Phân quyền | STAFF có tự cấp quyền được không? | Thành |
| Thống kê | Doanh thu gộp/thuần khác nhau ra sao? | Cường |
| AI | Chatbot có bịa thông tin sản phẩm không? | Long |
| QA | Quy trình kiểm thử thực tế nhóm áp dụng là gì? | Tùng |

---

## 5. Rủi ro thường gặp & cách xử lý nhanh tại chỗ

| Sự cố | Cách xử lý ngay |
|---|---|
| VNPay sandbox lỗi/không vào được | Chuyển ngay sang demo "Chuyển khoản ngân hàng" (chỉ hiện QR, không quét), nói ngắn gọn "đây là môi trường sandbox của bên thứ ba, đôi khi có bảo trì" |
| Mất mạng / VietMap API không phản hồi | Phí ship tự động fallback về công thức cố định — vẫn demo được, chỉ cần nói rõ đây là nhánh dự phòng đang chạy |
| Quên mật khẩu admin lúc demo | Đã đổi về `admin@123`, ghi sẵn trên giấy nháp phòng khi gõ nhầm |
| Chatbot phản hồi chậm/lỗi | Có sẵn 1-2 câu hỏi đã test chạy mượt trước đó, ưu tiên hỏi đúng câu đó thay vì ứng biến |
| Thiếu thời gian giữa chừng | Bỏ theo thứ tự ưu tiên: (1) demo VietQR ở Phần 2, (2) bước hoàn/huỷ hoá đơn ở Phần 3, (3) case thứ 4 (STAFF thiếu quyền) ở Phần 5 |
| Thừa thời gian | Thêm: demo sửa/xoá sản phẩm, demo yêu cầu trả hàng phía khách hàng, demo responsive trên điện thoại thật |

---

*Tài liệu được tạo dựa trên đối chiếu trực tiếp với mã nguồn dự án tại thời điểm soạn thảo. Trước ngày bảo vệ chính thức, chạy thử lại toàn bộ kịch bản 1 lượt để phát hiện phần nào đã thay đổi so với tài liệu này.*
