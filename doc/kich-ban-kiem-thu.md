# NovaCart — Bộ ca kiểm thử

Tài liệu này là phần **kiểm thử thủ công có kịch bản**, đi kèm với phần **kiểm thử tự động** (xem
mục 1). Mỗi ca đều có bước kiểm chứng ở **tầng dữ liệu** bằng câu SQL, không chỉ nhìn màn hình — vì
phần lớn lỗi nghiêm trọng của dự án (sai doanh thu, ghi đè tồn kho) đều hiển thị bình thường trên
giao diện.

---

## 1. Chiến lược kiểm thử

Nhóm **không đặt mục tiêu theo độ phủ dòng lệnh**. Thay vào đó, vị trí đặt test được chọn dựa trên
**nhật ký lỗi đã thực sự xảy ra** trong quá trình phát triển — tức là những chỗ dự án đã tự chứng
minh là dễ sai.

### 1.1. Phân chia theo loại lỗi

| Loại logic | Cách kiểm | Lý do |
| --- | --- | --- |
| Phép tính tiền, máy trạng thái đơn, ma trận quyền, chống ghi đè tồn kho | Tự động (Mockito, không cơ sở dữ liệu) | Thuần logic, tất định, đã sai nhiều lần, chạy vài giây |
| Ngữ nghĩa cơ sở dữ liệu (UNIQUE/NULL, khoá ngoại, khoá bi quan, @Query JPQL) | Thủ công + đối chiếu SQL | Không có cách test tự động trung thực mà không dựng MSSQL thật |
| HTTP / JWT / VNPay / upload ảnh / giao diện | Thủ công có kịch bản | Chi phí dựng hạ tầng lớn hơn giá trị thu được |
| Chất lượng câu trả lời của chatbot | Thủ công | Không tất định, không có "kết quả mong đợi" để so |

### 1.2. Kiểm thử tự động hiện có

| Tầng | Lệnh | Số test | Cần gì để chạy |
| --- | --- | --- | --- |
| Backend | `cd backend && mvnw test` | 75 | Không cần gì |
| Frontend | `cd frontend && npm test` | 21 | Không cần gì |
| Chatbot (hàm thuần) | `cd chatbot && npm test` | 40 | Không cần gì |
| Chatbot (hồi quy chạy thật) | `cd chatbot && npm run test:rag` | 5 script | Postgres + khoá Gemini |
| Chatbot (bộ đo chất lượng lọc) | `cd chatbot && npm run do:loc` | 4 chỉ số | Postgres + khoá Gemini |
| Backend (khởi động với DB thật) | `mvnw test -Dgroups=integration` | 1 | MSSQL đang chạy |

**Lưu ý quan trọng về `mvnw test`:** test khởi động ứng dụng (`BackendApplicationTests`) được gắn
`@Tag("integration")` và **bị loại khỏi `mvnw test` mặc định**. Lý do: nó kết nối thật vào MSSQL, nên
trên máy chưa cài/chưa bật SQL Server thì toàn bộ lệnh `mvnw test` hỏng — kể cả các test thuần logic
chẳng cần cơ sở dữ liệu. Tách ra để mọi thành viên đều chạy được test.

### 1.3. Vì sao chọn Mockito thuần, không dùng H2 hay Testcontainers

- **H2 in-memory — loại.** H2 cho phép nhiều dòng `NULL` trong cột `UNIQUE`, trong khi SQL Server chỉ
  cho đúng một. Nghĩa là lỗi *"SKU để trống"* mà nhóm đã gặp sẽ **xanh trên test và đỏ trên thực tế**.
  Test như vậy tệ hơn không có test, vì nó dạy nhóm tin sai. Hành vi của `@Lock(PESSIMISTIC_WRITE)` và
  cách bind tham số boolean trong JPQL cũng phụ thuộc dialect.
- **Testcontainers chạy MSSQL thật — loại.** Đúng ngữ nghĩa, nhưng cần Docker và image vài GB trên
  máy của cả 6 thành viên. Đây là lựa chọn đúng cho sản phẩm thương mại, không phù hợp ở đây.
- **Chạy thẳng vào cơ sở dữ liệu phát triển — loại.** Test làm bẩn đúng dữ liệu sẽ dùng để trình bày,
  và kết quả phụ thuộc thứ tự chạy.

### 1.4. Test tự động KHÔNG bắt được gì — và ca thủ công nào bù vào

Đây là phần quan trọng nhất của quyết định trên, và nhóm ghi rõ thay vì giấu.

| Lớp lỗi | Test tự động | Ca thủ công bù vào |
| --- | --- | --- |
| Ràng buộc `UNIQUE` (SKU trống) | Không — là ràng buộc DB | SP-01 |
| Khoá ngoại khi xoá phân loại đã có đơn | Một phần (chặn trước bằng mã) | SP-05, SP-06 |
| Khoá bi quan có thật sự khoá row không | **Không** — là hành vi của SQL Server | ĐT-01, ĐT-02, thí nghiệm mục 9 |
| Cú pháp `@Query` JPQL, `@EntityGraph`, ranh giới `@Transactional` | Không | Toàn bộ nhóm TK + `mvnw test -Dgroups=integration` |
| Luật khoá route trong `SecurityConfig` | Một phần (kiểm luật còn tồn tại) | PQ-01 … PQ-09 |
| Chất lượng câu trả lời chatbot | Không | CB-01 … CB-08 |

---

## 2. Chuẩn bị trước khi chạy bộ ca kiểm thử

1. **Sao lưu cơ sở dữ liệu** trước khi bắt đầu: `BACKUP DATABASE menswear_shop TO DISK = '...\menswear_truoc_kiem_thu.bak'`.
   Nhiều ca dưới đây thay đổi tồn kho và tạo đơn thật.
2. Khởi động đủ 4 thành phần: MSSQL, backend (`:8080`), frontend (`:5173`), và — cho nhóm CB — Postgres
   của chatbot (`docker compose up -d` trong `chatbot/`) cùng kit (`node server.js`).
3. Đăng nhập sẵn 2 tài khoản: một **Quản trị viên**, một **Nhân viên** (dùng cho nhóm PQ).
4. Ghi lại `@v` (variant_id) và `@o` (order_id) đang kiểm ở mỗi ca để chạy các câu SQL bên dưới.

---

## 3. Các câu SQL đối chiếu dùng chung

Các ca kiểm thử chỉ tham chiếu tên `[Q-…]`, không lặp lại câu lệnh.

```sql
-- [Q-KHO] Tồn kho hiện tại của một phân loại
SELECT v.variant_id, p.product_name, v.size, v.color, v.sku, v.stock_quantity, p.status
FROM product_variants v JOIN products p ON p.product_id = v.product_id
WHERE v.variant_id = @v;

-- [Q-DON] Trạng thái đầy đủ của một đơn
SELECT order_id, order_code, order_type, status, payment_method, payment_status,
       subtotal_amount, discount_amount, shipping_fee, total_amount,
       created_at, returned_at, version
FROM orders WHERE order_id = @o;

-- [Q-DONGHANG] Các dòng hàng của một đơn
SELECT oi.order_item_id, oi.variant_id, oi.product_name, oi.size, oi.color,
       oi.unit_price, oi.quantity, oi.subtotal
FROM order_items oi WHERE oi.order_id = @o;

-- [Q-DOANHTHU] Doanh thu THUẦN trong kỳ -- phải khớp ô "Doanh thu" trên màn Thống kê.
-- Điều kiện thanh toán ở dòng cuối chính là quy tắc isRealizedRevenue trong AdminStatisticsService:
-- COD luôn tính (trả khi nhận hàng), chuyển khoản/VNPay chỉ tính khi đã xác nhận nhận tiền.
DECLARE @from date = '2026-09-01', @to date = '2026-09-30';
SELECT ISNULL(SUM(o.total_amount), 0) AS doanh_thu_thuan, COUNT(*) AS so_don
FROM orders o
WHERE o.status IN ('COMPLETED', 'RETURN_REQUESTED')
  AND o.created_at >= @from AND o.created_at < DATEADD(day, 1, @to)
  AND (o.payment_method = 'COD' OR o.payment_status <> 'UNPAID');

-- [Q-HOANTRA] Hoàn trả nhóm theo NGÀY HOÀN -- phải khớp cột đỏ trên biểu đồ.
-- COALESCE để đơn cũ chưa có returned_at (tạo trước khi thêm cột) không biến mất khỏi báo cáo.
SELECT CAST(COALESCE(o.returned_at, o.created_at) AS date) AS ngay_hoan,
       SUM(o.total_amount) AS tien_hoan
FROM orders o
WHERE o.status = 'RETURNED'
  AND COALESCE(o.returned_at, o.created_at) >= @from
  AND COALESCE(o.returned_at, o.created_at) < DATEADD(day, 1, @to)
  AND (o.payment_method = 'COD' OR o.payment_status <> 'UNPAID')
GROUP BY CAST(COALESCE(o.returned_at, o.created_at) AS date)
ORDER BY 1;

-- [Q-DANHMUC] Doanh thu theo danh mục -- cộng theo DÒNG HÀNG, không cộng cả đơn.
-- Đây chính là lỗi từng gặp: đơn gồm áo 100k + quần 900k, lọc "Áo" ra 1.000k thay vì 100k.
SELECT c.category_name, SUM(oi.subtotal) AS doanh_thu, SUM(oi.quantity) AS so_luong
FROM order_items oi
JOIN orders o           ON o.order_id   = oi.order_id
JOIN product_variants v ON v.variant_id = oi.variant_id
JOIN products p         ON p.product_id = v.product_id
JOIN categories c       ON c.category_id = p.category_id
WHERE o.status IN ('COMPLETED', 'RETURN_REQUESTED')
  AND (o.payment_method = 'COD' OR o.payment_status <> 'UNPAID')
  AND o.created_at >= @from AND o.created_at < DATEADD(day, 1, @to)
GROUP BY c.category_name ORDER BY 2 DESC;

-- [Q-SAPHET] Sắp hết hàng -- phải khớp mục cảnh báo trên màn Thống kê (chỉ sản phẩm đang bán)
SELECT TOP 10 v.variant_id, p.product_name, v.size, v.color, v.stock_quantity
FROM product_variants v JOIN products p ON p.product_id = v.product_id
WHERE p.status = 'ACTIVE' AND v.stock_quantity <= 5
ORDER BY v.stock_quantity ASC;

-- [Q-QUYEN] Ma trận quyền của Nhân viên
SELECT permission_code, granted FROM role_permission
WHERE role_name = 'STAFF' ORDER BY permission_code;
```

---

## 4. Đặt hàng trực tuyến (ĐH)

| Mã | Điều kiện đầu vào | Các bước | Kết quả mong đợi | Kiểm chứng dữ liệu |
| --- | --- | --- | --- | --- |
| ĐH-01 | Khách đã đăng nhập; `@v` tồn kho 10 | Thêm 2 vào giỏ → Thanh toán → chọn **COD** → Đặt hàng. Admin vào Quản lý đơn → **Xác nhận** | Đơn tạo ở `PENDING`; sau khi xác nhận → `CONFIRMED`, kho giảm đúng 2 | `[Q-DON]`: `status='CONFIRMED'`, `payment_method='COD'`, `payment_status='UNPAID'`. `[Q-KHO]`: `stock_quantity = 8` |
| ĐH-02 | Như ĐH-01, `@v` tồn kho 10 | Đặt hàng chọn **Chuyển khoản**. Admin bấm **Xác nhận** ngay khi chưa xác nhận đã nhận tiền | Bị chặn, báo phải xác nhận thanh toán trước. Kho **không đổi** | `[Q-DON]`: vẫn `PENDING`, `payment_status='UNPAID'`. `[Q-KHO]`: vẫn 10 |
| ĐH-03 | Tiếp ĐH-02 | Bấm **Xác nhận đã nhận CK** → rồi bấm **Xác nhận** đơn | Lần này qua; kho giảm đúng số lượng | `[Q-DON]`: `payment_status='PAID'`, `status='CONFIRMED'` |
| ĐH-04 | Khách đã đăng nhập | Đặt hàng chọn **VNPay** → sang cổng → thanh toán thành công → quay về | Đơn `PENDING` + `payment_status='PAID'`; trang trả về báo thành công | `[Q-DON]`: `payment_method='VNPAY'`, `payment_status='PAID'` |
| ĐH-05 | Như ĐH-04 | Sang cổng VNPay rồi bấm **Huỷ** (hoặc để hết hạn) | Đơn vẫn `PENDING`/`UNPAID`; khách thanh toán lại được | `[Q-DON]`: `payment_status='UNPAID'`, `status='PENDING'` |
| ĐH-06 | `@v` tồn kho 2 | Thêm 5 vào giỏ → Thanh toán | Chặn ngay ở bước thanh toán: *"chỉ còn 2…"*. **Không** tạo đơn | `SELECT COUNT(*) FROM orders WHERE user_id=@u AND created_at > <mốc>` = 0 |
| ĐH-07 | Sản phẩm P đang nằm trong giỏ của khách | Admin **Ẩn** P → khách bấm Thanh toán | Chặn, báo sản phẩm đã ngừng kinh doanh | `[Q-KHO]`: `p.status='INACTIVE'`; không sinh đơn mới |
| ĐH-08 | Đơn `@o` đang `CONFIRMED`, đã trừ kho 2 | Khách vào **Đơn của tôi** → **Huỷ đơn** | Đơn `CANCELLED`, kho hoàn lại đúng 2 | `[Q-DON]`: `CANCELLED`. `[Q-KHO]`: về đúng số trước khi xác nhận |
| ĐH-09 | Đơn `@o` đang `PENDING` (chưa trừ kho) | Khách **Huỷ đơn** | `CANCELLED`, kho **không đổi** (không cộng khống) | `[Q-KHO]`: bằng đúng số trước đó |
| ĐH-10 | Voucher giảm 50.000đ, `min_order_value` = 500.000đ | (a) đơn 300k áp mã · (b) đơn 600k áp mã · (c) áp mã đã hết hạn | (a) từ chối, nêu rõ giá trị tối thiểu · (b) `total = subtotal + ship − 50.000` · (c) từ chối | `[Q-DON]`: `discount_amount = 50000`, `total_amount` khớp phép tính |
| ĐH-11 | Tiếp ĐH-10(b), đơn đã dùng voucher | Admin **Huỷ** đơn đó | Lượt dùng voucher được trả lại cho khách | `SELECT used_count FROM vouchers WHERE code='...'` giảm 1 |
| ĐH-12 | Đơn `@o` đang `DELIVERED` | Khách bấm **Đã nhận hàng** | Đơn → `COMPLETED`, doanh thu ghi nhận theo `created_at` | `[Q-DON]`: `COMPLETED`; `[Q-DOANHTHU]` tăng đúng `total_amount` |

---

## 5. Bán hàng tại quầy (POS)

| Mã | Điều kiện đầu vào | Các bước | Kết quả mong đợi | Kiểm chứng dữ liệu |
| --- | --- | --- | --- | --- |
| POS-01 | `@v` tồn kho 10 | Tạo hoá đơn → thêm 3 → Thanh toán **Tiền mặt** | Hoá đơn `COMPLETED` + `PAID`. Kho trừ **ngay lúc thêm hàng**, không phải lúc thanh toán | `[Q-DON]`: `order_type='POS'`, `status='COMPLETED'`, `payment_status='PAID'`. `[Q-KHO]`: 7 |
| POS-02 | `@v` tồn kho 10 | Tạo hoá đơn → thêm 2 → Thanh toán **Chuyển khoản** | `COMPLETED` nhưng `UNPAID` — chưa ai xác nhận tiền về | `[Q-DON]`: `status='COMPLETED'`, `payment_status='UNPAID'` |
| POS-03 | Tiếp POS-02; ghi lại doanh thu đang hiển thị | Mở **Thống kê**, chọn kỳ chứa hôm nay | Hoá đơn POS-02 **không** được tính vào doanh thu | `[Q-DOANHTHU]` khớp số trên màn hình; đơn POS-02 không nằm trong tập của câu đó |
| POS-04 | Tiếp POS-03 | Bấm **Xác nhận đã nhận CK** → tải lại Thống kê | Doanh thu tăng đúng bằng `total_amount` của hoá đơn đó | `[Q-DON]`: `payment_status='PAID'`; `[Q-DOANHTHU]` tăng đúng số đó |
| POS-05 | Sản phẩm P đã bị ẩn | Tìm P ở POS rồi thêm vào hoá đơn | P vẫn hiện trong kết quả tra cứu nhưng có nhãn **"Ngừng kinh doanh"** và nút phân loại bị khoá; gọi thẳng API cũng bị chặn | Không sinh dòng `order_items` mới; `[Q-KHO]` không đổi |
| POS-06 | `@v` tồn kho 3 | Thêm 5 vào hoá đơn | Chặn: *"chỉ còn 3 trong kho"*. Kho không đổi | `[Q-KHO]`: vẫn 3 |
| POS-07 | Hoá đơn `PENDING` có 3 món (kho đã bị trừ) | Bấm **Huỷ hoá đơn** | `CANCELLED`, kho hoàn đủ **cả 3 dòng** | Từng dòng trong `[Q-DONGHANG]` → `[Q-KHO]` phải về đúng số ban đầu |
| POS-08 | Hoá đơn đã `COMPLETED` + `PAID` | Bấm **Huỷ hoá đơn đã hoàn tất** | → `RETURNED`, kho hoàn, `payment_status` → `REFUNDED`, `returned_at` được ghi | `[Q-DON]`: `status='RETURNED'`, `payment_status='REFUNDED'`, `returned_at IS NOT NULL` |
| POS-09 | Hoá đơn `COMPLETED` chuyển khoản **chưa** thu tiền | Bấm **Huỷ hoá đơn đã hoàn tất** | `RETURNED`, kho hoàn, nhưng `payment_status` **vẫn** `UNPAID` — chưa nhận tiền thì không có gì để hoàn | `[Q-DON]`: `payment_status='UNPAID'` |
| POS-10 | Hoá đơn rỗng | Bấm Thanh toán | Chặn: *"Hoá đơn chưa có sản phẩm nào"* | Không đổi trạng thái |
| POS-11 | Hoá đơn `COMPLETED` | Thử thêm sản phẩm vào hoá đơn đó | Bị chặn — hoá đơn đã chốt thì khoá lại | `[Q-DONGHANG]` không có dòng mới |

---

## 6. Trả hàng & hoàn tiền (TRA)

| Mã | Điều kiện đầu vào | Các bước | Kết quả mong đợi | Kiểm chứng dữ liệu |
| --- | --- | --- | --- | --- |
| TRA-01 | Đơn `@o` ở `DELIVERED` hoặc `COMPLETED` | Khách → **Yêu cầu trả hàng**, nhập lý do | `RETURN_REQUESTED`. Doanh thu **không tụt** (tiền vẫn đang ở shop) | `[Q-DON]`: `status='RETURN_REQUESTED'`, `return_reason` có nội dung. `[Q-DOANHTHU]` không đổi so với trước bước này |
| TRA-02 | Tiếp TRA-01, đơn đã `PAID` | Admin **Duyệt trả hàng** | `RETURNED`; kho hoàn; `payment_status` → `REFUNDED`; `returned_at` = thời điểm duyệt | `[Q-DON]`: đủ 3 trường trên. `[Q-KHO]`: hoàn đúng từng dòng |
| TRA-03 | Tiếp TRA-01 | Admin **Từ chối trả hàng** | Quay về `COMPLETED`; kho **không** hoàn; `returned_at` vẫn null | `[Q-DON]`: `status='COMPLETED'`, `returned_at IS NULL` |
| TRA-04 | Đơn tạo **tháng trước**, duyệt trả **hôm nay** | Xem Thống kê kỳ tháng trước, rồi kỳ tháng này | Tháng trước: có doanh thu, **không** có cột hoàn trả. Tháng này: có cột hoàn trả đỏ đúng ngày hôm nay | `[Q-HOANTRA]` với `@from`/`@to` = tháng này → đúng 1 dòng, ngày = hôm nay |
| TRA-05 | Đơn mua rồi trả **trong cùng một kỳ** | Xem Thống kê kỳ đó | Doanh thu gộp − Hoàn trả = Doanh thu thuần, và thuần **không âm** (một đơn mua-rồi-hoàn phải triệt tiêu về 0) | Đọc 3 ô trên màn hình rồi cộng trừ tay; đối chiếu `[Q-DOANHTHU]` |
| TRA-06 | Đơn đã `RETURNED` | Thử đổi trạng thái tiếp (bất kỳ) | Bị chặn — `RETURNED` là trạng thái cuối | Không bản ghi nào đổi; cột `version` không tăng |
| TRA-07 | Đơn `RETURNED` | Bấm **Xác nhận đã nhận CK** cho đơn đó | Bị chặn: *"Đơn hàng đã huỷ/trả hàng, không thể xác nhận thanh toán"* | `[Q-DON]`: `payment_status` không đổi |

---

## 7. Quản lý sản phẩm & tồn kho (SP)

| Mã | Điều kiện đầu vào | Các bước | Kết quả mong đợi | Kiểm chứng dữ liệu |
| --- | --- | --- | --- | --- |
| SP-01 | — | Thêm sản phẩm mới có **2 phân loại**, để trống ô SKU **cả hai** | Lưu thành công, không lỗi trùng | `SELECT variant_id, sku FROM product_variants WHERE product_id=@p` → 2 dòng, SKU **khác nhau**, không rỗng, không NULL |
| SP-02 | `@v` tồn kho 10 | Bấm **+** 3 lần liên tiếp thật nhanh, rồi **−** 1 lần | Kho = **12** (cộng dồn từng lần, không nhảy về số cũ) | `[Q-KHO]`: `stock_quantity = 12` |
| SP-03 | `@v` tồn kho 2 | Bấm **−** 5 lần | Đến lần vượt thì báo *"Tồn kho hiện chỉ còn N, không giảm thêm được"*. Không bao giờ âm | `[Q-KHO]`: `stock_quantity >= 0` |
| SP-04 | `@v` tồn kho 10 (= ĐT-01) | Cửa sổ A mở form sửa sản phẩm; cửa sổ B bán POS 3 cái; quay lại A bấm **Lưu** với ô kho vẫn ghi 10 | A bị chặn: *"Tồn kho… vừa thay đổi (hiện là 7), vui lòng tải lại trang"* | `[Q-KHO]`: **7** (không bị đè về 10) |
| SP-05 | Phân loại `@v` đã từng phát sinh đơn | Sửa sản phẩm → xoá phân loại đó → **Lưu** | Báo đúng bản chất: *"Không thể xoá phân loại "M / Đen" vì đã phát sinh đơn hàng…"* | Phân loại vẫn còn trong `product_variants` |
| SP-06 | Phân loại `@v` đang nằm trong giỏ của một khách | Xoá phân loại đó | Thông điệp **khác** SP-05, nêu rõ đang trong giỏ hàng | `SELECT * FROM cart_items WHERE variant_id=@v` có dòng |
| SP-07 | Dùng Postman/curl, **bỏ qua form** | `POST /api/admin/products` với: (a) `price = 0` · (b) `imageUrls = []` · (c) `variants = []` · (d) `description = ""` | Cả 4 lần đều **400** với thông điệp tiếng Việt rõ ràng | `SELECT COUNT(*) FROM products WHERE created_at > <mốc>` = 0 |
| SP-08 | Sản phẩm P đang `ACTIVE`, nằm trong wishlist của một khách | Admin **Ẩn** P | P biến mất khỏi: trang chủ, danh sách Shop, tìm kiếm, **wishlist**; trang chi tiết trả 404 | `[Q-KHO]`: `p.status='INACTIVE'`. Mở trực tiếp `/products/<id>` để xác nhận |
| SP-09 | Sản phẩm P tồn kho ≤ 5, đang `ACTIVE` | Xem Thống kê → mục **Sắp hết hàng**. Sau đó **Ẩn** P rồi tải lại | Trước: P có trong danh sách. Sau: P biến mất khỏi cảnh báo | `[Q-SAPHET]` |
| SP-10 | Sản phẩm đã có slug | Sửa **mô tả** (không đổi tên) rồi Lưu | Slug **giữ nguyên** — không phá link đã chia sẻ | `SELECT slug FROM products WHERE product_id=@p` không đổi |
| SP-11 | — | Đổi tên sản phẩm thành *"Áo sơ mi trắng"* rồi Lưu | Slug mới bỏ dấu đúng: `ao-so-mi-trang` (không phải `o-s-mi-trng`) | `SELECT slug FROM products WHERE product_id=@p` |
| SP-12 | Danh mục có **hơn 20** sản phẩm | Vào trang Sản phẩm, xem thanh dưới bảng | Hiện tổng số thật và điều hướng trang; tick **"Chỉ hiện sắp hết hàng"** lọc trên **toàn bộ** danh mục, không phải trang hiện tại | So số hiển thị với `SELECT COUNT(*) FROM products` |
| SP-13 | Upload ảnh sản phẩm | Chọn 1 ảnh → Lưu → mở app **từ máy khác qua IP LAN** | Ảnh vẫn hiển thị (đường dẫn lưu dạng tương đối, không đóng băng `localhost`) | `SELECT image_url FROM product_images WHERE product_id=@p` → bắt đầu bằng `/uploads/`, không phải `http://localhost:8080/...` |

---

## 8. Phân quyền Nhân viên (PQ)

Đăng nhập bằng tài khoản **STAFF**. Ma trận mặc định (`[Q-QUYEN]`): bật `POS_USE`, `ORDER_VIEW`,
`ORDER_UPDATE_STATUS`, `PRODUCT_VIEW`, `CATEGORY_BRAND_VIEW`, `VOUCHER_VIEW`; các quyền còn lại tắt.

| Mã | Bước | Kết quả mong đợi | Kiểm chứng |
| --- | --- | --- | --- |
| PQ-01 | STAFF gọi `/api/admin/inventory/**` | **403** — khoá cứng ở tầng route, không qua ma trận | Tab Network: 403, body *"Bạn không có quyền thực hiện thao tác này"* |
| PQ-02 | STAFF vào **Người dùng** (`/api/admin/users/**`) | 403; mục này cũng không hiện trong menu | như trên |
| PQ-03 | STAFF vào **Phân quyền nhân viên** (`/api/admin/permissions/**`) | 403 — nhân viên không tự cấp quyền cho mình được | như trên |
| PQ-04 | STAFF vào **Thống kê** (`STATISTICS_VIEW` mặc định tắt) | 403 | Network 403 |
| PQ-05 | STAFF vào **Sản phẩm**: xem danh sách; bấm Sửa → Lưu | Xem được (`PRODUCT_VIEW`); Lưu bị 403 (`PRODUCT_WRITE` tắt) | `[Q-QUYEN]`: `PRODUCT_WRITE` → `granted = 0` |
| PQ-06 | ADMIN bật `PRODUCT_WRITE` cho STAFF → STAFF đăng nhập lại → sửa sản phẩm | Lần này Lưu thành công | `[Q-QUYEN]`: `granted = 1` |
| PQ-07 | Tiếp PQ-06 — STAFF sửa sản phẩm **và đổi ô Tồn kho** | Ô tồn kho bị khoá trên giao diện; gọi thẳng API thì báo *"Bạn không có quyền sửa tồn kho"* — kho luôn chỉ Admin | `[Q-KHO]`: `stock_quantity` không đổi |
| PQ-08 | Tiếp PQ-06 — STAFF thêm **phân loại mới** cho sản phẩm | Phân loại được tạo nhưng tồn kho bắt đầu từ **0**, kể cả khi form khai số khác | `[Q-KHO]` của phân loại mới = 0 |
| PQ-09 | STAFF mở trang Sản phẩm, xem cột tồn kho | **Không** thấy nút **+/−**, có dòng *"Chỉ Quản trị viên mới điều chỉnh được tồn kho"* | Quan sát giao diện |
| PQ-10 | Gọi API admin **không kèm token** | **401** (không phải 403) — để frontend phân biệt hết phiên với thiếu quyền | Network: 401 |
| PQ-11 | Đăng nhập ADMIN, thử lại toàn bộ PQ-01…PQ-05 | Tất cả đều qua — Admin không đi qua bảng ma trận | — |

---

## 9. Đồng thời (ĐT)

Đây là phần **test tự động không chứng minh được**, vì khoá bi quan là hành vi của SQL Server chứ
không phải của mã Java — một unit test chỉ chứng minh mã *có gọi* hàm khoá, không chứng minh khoá có
tác dụng.

### 9.1. Thí nghiệm bắn request song song

Chuẩn bị: chọn một `@v`, đặt `stock_quantity = 5`; tạo trước 10 hoá đơn POS rỗng và ghi lại 10
`order_id`.

```
cd backend/tools
set TOKEN=<JWT của tài khoản admin>
node race-stock.js --variant <@v> --orders <10 orderId cách nhau bởi dấu phẩy>
```

**Kết quả đã đo được** (10 request song song, tồn kho đặt về 5):

| Lần chạy | Thành công | Bị từ chối | Tồn kho còn lại | Kết luận |
| --- | --- | --- | --- | --- |
| **Có khoá bi quan** (mã hiện tại) | 5 | 5 | 0 | Cân đối: bán 5 + còn 0 = 5 ✔ |
| **Tạm bỏ khoá** (đối chứng) | **10** | 0 | **4** | Bán 10 nhưng kho chỉ trừ 1 — 9 sản phẩm bán ra từ hư không ✖ |

Lần đối chứng cho thấy đúng cơ chế hỏng: cả 10 request cùng đọc `stock = 5`, cùng tính `5 − 1 = 4`,
cùng ghi 4. Không có transaction nào thấy được thay đổi của transaction khác.

```sql
SELECT stock_quantity FROM product_variants WHERE variant_id = @v;   -- phải = 0
SELECT SUM(oi.quantity) FROM order_items oi
WHERE oi.variant_id = @v AND oi.order_id IN (/* 10 orderId */);      -- phải = 5
```

Nếu không có khoá bi quan, con số này sẽ ra 7–10 và tồn kho âm. Chạy một lần có khoá, và (nếu muốn
đối chứng) một lần sau khi tạm bỏ khoá, để có cặp số so sánh.

### 9.2. Hai kịch bản hai cửa sổ

| Mã | Kịch bản | Kết quả mong đợi | Kiểm chứng |
| --- | --- | --- | --- |
| ĐT-01 | Cửa sổ A mở form sửa sản phẩm (kho đọc được = 10). Cửa sổ B bán POS 3 cái → kho = 7. Quay lại A, bấm Lưu với ô kho vẫn ghi 10 | A báo *"Tồn kho… vừa thay đổi (hiện là 7), vui lòng tải lại trang"* | `[Q-KHO]`: `stock_quantity` vẫn = 7 |
| ĐT-02 | 2 tab admin cùng mở đơn `@o` đang `PENDING`. Cả 2 bấm **Xác nhận** | Tab đầu thành công; tab sau nhận lỗi *"Dữ liệu vừa được thao tác bởi người khác…"* (409) | `[Q-DON]`: `version` tăng **đúng 1**; kho bị trừ **đúng 1 lần** |

Hai cơ chế đồng thời khác nhau, cố ý:

- **Tồn kho — khoá bi quan** (`findByIdForUpdate`): thao tác đọc–kiểm tra–rồi–trừ rất ngắn, xảy ra
  liên tục, xung đột phải được tuần tự hoá ngay ở tầng cơ sở dữ liệu.
- **Đơn hàng — khoá lạc quan** (`@Version`): xung đột hiếm hơn và người dùng xử lý được — hai admin
  cùng xác nhận một đơn thì người sau nhận thông báo rõ ràng, không bị âm thầm ghi đè.

---

## 10. Thống kê — đối chiếu số (TK)

| Mã | Bước | Kết quả mong đợi | Kiểm chứng |
| --- | --- | --- | --- |
| TK-01 | Chọn kỳ **Tháng này**, không lọc gì | Ô "Doanh thu" khớp **chính xác đến đồng** | `[Q-DOANHTHU]` |
| TK-02 | Bấm nút nhanh **Tháng này** vào đúng ngày 01 của tháng | Ô "Từ ngày" hiện ngày **01 tháng hiện tại**, không phải ngày cuối tháng trước | Đọc trực tiếp 2 ô ngày (đây là lỗi lệch múi giờ UTC đã sửa) |
| TK-03 | Chọn **danh mục cha** (ví dụ "Áo") | Ra tổng của mọi danh mục con-cháu, không phải 0đ | `[Q-DANHMUC]` cộng tay các danh mục con |
| TK-04 | Tạo 1 đơn gồm áo 100k + quần 900k (tổng 1.000k), lọc danh mục **"Áo"** | Doanh thu hiện **100.000đ**, không phải 1.000.000đ | `[Q-DANHMUC]` hàng "Áo" |
| TK-05 | Kỳ có 1 hoá đơn POS chuyển khoản `UNPAID` | Hoá đơn đó **không** góp vào doanh thu, nhưng vẫn có trong danh sách đơn | `[Q-DOANHTHU]` |
| TK-06 | Chọn **Năm nay** | Biểu đồ tự gộp theo tháng; tổng các cột = ô doanh thu gộp | Cộng tay giá trị các cột từ chú giải |
| TK-07 | Đổi bộ lọc rồi **F5** | Bộ lọc giữ nguyên (nằm trong URL) | Đọc thanh địa chỉ |
| TK-08 | Đổi bộ lọc nhưng **chưa** bấm Xem | Hiện dải cảnh báo *"bộ lọc đã đổi, bấm Xem để cập nhật"*; số trên màn hình vẫn là số của bộ lọc cũ | Quan sát giao diện |
| TK-09 | Chọn **Từ ngày** sau **Đến ngày** | Báo lỗi rõ ràng, không trả kỳ rỗng | Network: 400 |
| TK-10 | Bấm **Xuất CSV** | File có dòng chú thích kỳ + bộ lọc; tên file chứa khoảng ngày; số liệu khớp màn hình | Mở file bằng Excel |

---

## 11. Chatbot tư vấn (CB)

Điều kiện chung: Postgres của chatbot đang chạy, kit đang chạy, và **đã chạy `node lib/productSync.js`
ít nhất một lần**.

| Mã | Điều kiện đầu vào | Bước | Kết quả mong đợi | Kiểm chứng |
| --- | --- | --- | --- | --- |
| CB-01 | Sản phẩm X chỉ còn 2 phân loại: M/Đen và L/Trắng | Hỏi: *"Áo X còn size M màu trắng không?"* | Bot **không** khẳng định còn tổ hợp M/Trắng | `SELECT noi_dung FROM kb_chunk c JOIN kb_document d ON d.id=c.document_id WHERE d.ten_file='product:<mã>'` → phải thấy dòng *"Các phân loại còn hàng (size/màu): M/Đen, L/Trắng"* |
| CB-02 | — | Gửi: *"Mình tên Nam, sđt 0912 345 678, giao về 12 Nguyễn Trãi"* | Bot **không** xác nhận đơn; trả đúng câu hướng dẫn tự đặt trên web | Log server: **không** có lượt gọi Gemini nào cho tin nhắn này (guard chạy trước) |
| CB-03 | — | Gửi cùng số ở dạng liền `0912345678` và `+84912345678` | Kết quả giống CB-02 | như trên |
| CB-04 | — | Hỏi *"Shop có bao nhiêu mẫu áo sơ mi?"* | Bot nêu **đúng tổng số** trong kho, không phải số mục nó nhận được | `SELECT COUNT(*) FROM kb_chunk WHERE folder_id='products' AND danh_muc ILIKE '%áo sơ mi%'` |
| CB-05 | — | Hỏi *"Đổi trả trong bao nhiêu ngày?"* | Trả lời **7 ngày**, nguồn ghi *"Chính sách & hướng dẫn"* | `SELECT COUNT(*) FROM kb_chunk WHERE folder_id='chinh-sach'` > 0 |
| CB-06 | — | Hỏi câu ngoài kho tri thức (*"Shop có bán xe máy không?"*) | Bot nói chưa có thông tin; **không** hiện dòng "Nguồn:" | `SELECT TOP 5 * FROM kb_cau_hoi_chua_tra_loi ORDER BY id DESC` → có ghi câu vừa hỏi |
| CB-07 | — | **Dừng Postgres của chatbot**, gửi 1 tin nhắn | Khách thấy thông báo thân thiện tiếng Việt; **không** thấy `ECONNREFUSED` hay lỗi kiểu UUID | Chụp bong bóng chat + đối chiếu log server (lỗi thô chỉ nằm ở log) |
| CB-08 | — | Gửi hơn 10 tin trong 1 phút | Đến ngưỡng thì bị chặn: *"Bạn đang hỏi hơi nhanh…"*; không đốt thêm lượt Gemini | Network: 429 |
| CB-09 | — | Chạy `node lib/productSync.js` **2 lần liên tiếp**, không đổi gì ở giữa | Lần 2 báo *"0 thêm mới, 0 cập nhật, N không đổi"*, xong trong vài giây | So log 2 lần |
| CB-10 | — | Admin đổi giá sản phẩm X → chạy sync → hỏi bot giá X | Bot đọc **giá mới** | `SELECT checksum FROM kb_document WHERE ten_file='product:<mã>'` đổi so với trước |
| CB-11 | — | Chat vài câu → **F5** trang | Đoạn chat và ngữ cảnh **vẫn còn** | Quan sát; kiểm `sessionStorage` trong DevTools |
| CB-12 | — | Đăng xuất → đăng nhập tài khoản **khác** trên cùng tab → mở widget | Đoạn chat của người trước **đã bị xoá sạch** | Quan sát |

---

## 12. Bộ đo chất lượng lọc sản phẩm của chatbot

`cd chatbot && npm run do:loc` — sinh câu hỏi **bằng máy** từ chính cơ sở dữ liệu, chấm **bằng máy**,
không ai soạn đáp án.

### 12.1. Vì sao không đo top-1 / top-5 như tài liệu RAG thông thường

Cách đo xếp hạng hợp với kho tài liệu, nơi mỗi câu hỏi có **đúng một** đoạn trả lời. Kho của NovaCart
khác: hỏi *"áo sơ mi trắng dưới 300k"* có thể có 12 sản phẩm cùng đúng — không tồn tại "đáp án thứ
nhất".

Quan trọng hơn, nhóm đã **đo được** khoảng cách ngữ nghĩa giữa các đoạn:

| Cặp so sánh | Khoảng cách cosine |
| --- | --- |
| Giữa hai đoạn **sản phẩm** bất kỳ | 0,14 – 0,19 |
| Từ đoạn sản phẩm tới đoạn **chính sách** | 0,35 – 0,39 |
| Ngưỡng lọc `RAG_MAX_DISTANCE` đang đặt | 0,35 |

Các đoạn sản phẩm dùng chung một khuôn văn bản nên tất yếu rất giống nhau. Trong bán kính 0,14–0,19,
**thứ hạng vector là nhiễu** — chênh lệch giữa hạng 1 và hạng 20 nhỏ hơn sai số của chính mô hình
nhúng. Đo top-1 sẽ ra một con số ổn định trông đẹp nhưng không phản ứng với bất kỳ thay đổi nào trong
mã. Đây cũng chính là lý do hệ thống **không dựa vào độ giống vector để chọn sản phẩm** mà lọc cứng
bằng SQL trên metadata; vector chỉ còn dùng để sắp thứ tự trong tập đã lọc.

### 12.2. Bốn chỉ số và kết quả đo được

| Chỉ số | Đo gì | Kết quả |
| --- | --- | --- |
| **M1** | Bước trích điều kiện: nhận ra có lọc / danh mục / size / màu / giá khẩu ngữ | 100% / 100% / 100% / 100% / 100% |
| **M2** | Precision — có trả về sản phẩm **sai** điều kiện không | 100% |
| **M3** | Recall — có **bỏ sót** sản phẩm đúng điều kiện không | 86% |
| **M4** | Cặp size/màu **ma** (phải bằng 0 tuyệt đối) | 0 / 52 |
| — | Nhóm câu **âm tính** (điều kiện không sản phẩm nào thoả) trả rỗng đúng | 1 / 1 |

Chỉ **M4** là điều kiện đạt/trượt tuyệt đối, vì nó là lỗi *bot nói sai với khách hàng thật*. M1–M3 là
số liệu báo cáo, không có ngưỡng "đúng" phổ quát nào để phán.

### 12.3. Bốn chốt chặn để bộ đo không tự cho điểm

Nguyên tắc: **nếu đáp án đúng suy được từ chính chuỗi ký tự trong câu hỏi thì bộ đo đang đo `ILIKE`,
không đo hệ thống.** Cả bốn chốt đều thực thi bằng máy:

1. **Không hỏi bằng tên sản phẩm.** Câu hỏi dùng cách gọi của khách (*"áo phông"*, *"quần bò"*), và
   mọi câu còn chép ≥ 3 từ liên tiếp của tên/mã/danh mục đều bị loại tự động.
2. **Chỉ lấy bộ điều kiện có ≥ 3 sản phẩm thoả.** Bộ có nghiệm duy nhất thì câu hỏi tự nó là khoá
   định danh — precision/recall luôn 100% mà chẳng đo được gì.
3. **Giá luôn viết bằng khẩu ngữ** (*"3 xị"*, *"dưới nửa triệu"*), cấm số thô. Số thô là số học,
   không phải ngôn ngữ.
4. **Có nhóm câu âm tính.** Bộ đo không có nhóm này thì mặc định là bộ đo tự cho điểm.

**Hạn chế đã biết:** bộ lọc chống chép định danh dùng n-gram ≥ 3 từ, nên danh mục chỉ 2 tiếng (*"Áo
lót"*, *"Blazer"*) không được nó bảo vệ — với các danh mục đó phải tự chọn từ đồng nghĩa.

### 12.4. Hai vấn đề bộ đo đã phát hiện và cách khắc phục

Đây là lý do bộ đo đáng có: nó tìm ra hai lỗi mà việc chat thử bằng tay không lộ ra.

| Phát hiện | Trước | Sau khi sửa |
| --- | --- | --- |
| Bước trích điều kiện chép **nguyên văn lời khách** (*"áo bỏ trong quần"*) thay vì ánh xạ về tên danh mục của cửa hàng (*"Áo sơ mi"*), khiến câu SQL không khớp gì. Sửa: đưa danh sách danh mục **có thật** vào prompt và bắt model chọn từ danh sách đó | danh mục 15%, precision 32%, recall 32% | danh mục 100%, precision 100%, recall 86% |
| Bước trích **không tất định**: cùng câu hỏi *"size M màu Trắng"*, có lần model trả đủ 2 trường, có lần bỏ mất màu (đo được dao động 1/3 → 3/3 giữa các lần chạy). Mà bộ lọc theo cặp chỉ bật khi có đủ cả hai. Siết prompt không chữa được tận gốc vì bản chất là xác suất. Sửa: bổ khuyết **bằng mã** — size và màu đều là tập đóng biết trước nên dò được, chỉ điền khi model bỏ trống | 1/3 – 3/3 lần trích đủ | 3/3 ở mọi lần chạy |

---

## 13. Ghi nhận kết quả

Khi chạy, điền vào bảng sau và chụp màn hình cho các ca ĐẠT/TRƯỢT đáng chú ý.

| Mã ca | Người chạy | Ngày | Kết quả (Đạt / Trượt / Bỏ qua) | Ghi chú, số liệu thực tế |
| --- | --- | --- | --- | --- |
| ĐH-01 | | | | |
| … | | | | |

**Quy ước:** một ca chỉ được ghi **Đạt** khi đã kiểm chứng ở tầng dữ liệu bằng câu SQL tương ứng —
nhìn màn hình thấy đúng là **chưa đủ**, vì phần lớn lỗi nghiêm trọng của dự án đều hiển thị bình
thường trên giao diện.
