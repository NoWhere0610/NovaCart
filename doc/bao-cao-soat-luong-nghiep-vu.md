# Báo cáo soát mã độc lập — luồng nghiệp vụ tiền và hàng

**Hệ thống:** NovaCart (Spring Boot + SQL Server, React/TS)
**Ngày soát:** 2026-09-04
**Phạm vi:** giỏ hàng, đặt hàng, huỷ đơn, trả hàng/hoàn tiền, chuyển trạng thái + tồn kho, mã giảm giá,
phí vận chuyển, POS, VNPay, thống kê doanh thu. Soát bằng cách đọc mã, không chạy hệ thống.

**Kết luận ngắn:** tìm được **2 lỗi NGHIÊM TRỌNG** (đều dẫn tới mất tiền thật), **3 lỗi NẶNG**
(một khoản nợ khách không bao giờ tất toán được trong hệ thống, một màn hình báo sai kết quả thanh
toán, một luồng huỷ đơn đòi sai dữ liệu), và **4 lỗi NHẸ**. Phần lõi khó nhất — khoá bi quan khi trừ
kho, ràng buộc mã giảm giá theo người, `status_before_return`, tính idempotent của IPN — đọc kỹ thì
**đúng**; lỗi nằm ở các đường biên giữa hai luồng và giữa backend với giao diện.

---

## 1. [NGHIÊM TRỌNG] Khách COD chưa trả đồng nào vẫn đòi được hoàn tiền, và admin không có gì để phát hiện

**Mức độ:** NGHIÊM TRỌNG (mất tiền)

**Ở đâu:**
- [AdminOrderService.java:38](backend/src/main/java/com/datn/service/AdminOrderService.java#L38) — `SHIPPING` chỉ có duy nhất một lối ra là `DELIVERED`
- [AdminOrderService.java:174-176](backend/src/main/java/com/datn/service/AdminOrderService.java#L174-L176) — chuyển `DELIVERED` là ghi `deliveredAt`
- [OrderService.java:298-314](backend/src/main/java/com/datn/service/OrderService.java#L298-L314) — `khachDaTraTien()` nhánh COD
- [AdminOrdersPage.tsx:178-280](frontend/src/pages/AdminOrdersPage.tsx#L178-L280) — bảng đơn không hiển thị phương thức/tình trạng thanh toán ở bất kỳ cột nào

**Kịch bản tái hiện:**
1. Khách A đặt đơn COD 900.000₫. Admin bấm "Xác nhận" → kho bị trừ. Admin bấm "Giao cho vận chuyển"
   → đơn ở `SHIPPING`.
2. **Giao thất bại**: khách từ chối nhận, hoặc không có nhà. Hàng quay về shop. Khách **chưa trả một
   đồng nào**.
3. Admin mở trang Quản lý đơn hàng. Đơn đang `SHIPPING`, và bảng `ALLOWED_TRANSITIONS` chỉ cho đúng
   một nút: **"→ Đã giao hàng"**. Không có "Giao thất bại", không có đường về `CANCELLED`. Muốn đóng
   đơn thì buộc phải bấm nút đó.
4. Đơn thành `DELIVERED`, `deliveredAt = now()`.
5. Khách A vào chi tiết đơn, bấm "Yêu cầu trả hàng/hoàn tiền", khai số tài khoản.
   `khachDaTraTien()` với COD trả `true` chỉ vì `status == DELIVERED` → `refundStatus = PENDING`.
6. Admin bấm "Duyệt trả hàng" → `RETURNED`, kho được hoàn.
7. Đơn hiện trong ô vàng **"Chờ chuyển tiền hoàn"** kèm số tài khoản đầy đủ, nút **"Xác nhận đã hoàn
   tiền"** sáng lên.

**Chuyện gì xảy ra:** admin chuyển 900.000₫ cho một người chưa từng trả tiền cho shop. Trên màn hình
quản lý đơn hàng **không có cột nào** hiện `paymentMethod` hay `paymentStatus` — `paymentStatus` chỉ
được dùng ở đúng một chỗ là điều kiện hiện nút "Xác nhận đã nhận CK"
([AdminOrdersPage.tsx:235](frontend/src/pages/AdminOrdersPage.tsx#L235)). Người thao tác không có bất
kỳ tín hiệu nào để nghi ngờ.

**Đáng lẽ phải:** (a) có một chuyển trạng thái cho tình huống giao thất bại (`SHIPPING → CANCELLED`
hoặc một trạng thái riêng) để không phải nói dối là đã giao; và (b) khoản hoàn của đơn COD phải hiện
rõ trong giao diện admin là "đơn COD — hệ thống không xác minh được đã thu tiền hay chưa, kiểm biên
lai trước khi chuyển".

**Vì sao mắt thường khó thấy:** hai mảnh đúng riêng lẻ ghép lại thành sai. Sơ đồ trạng thái thiếu một
mũi tên (nhìn qua tưởng "đơn nào giao rồi cũng thành DELIVERED"), còn `khachDaTraTien()` suy luận
"COD + đã giao = đã thu tiền" — suy luận đó chỉ đúng nếu `DELIVERED` luôn có nghĩa là hàng đã tới tay
khách, mà mũi tên thiếu ở trên phá vỡ đúng giả định đó. Chú thích ở
[OrderService.java:295-296](backend/src/main/java/com/datn/service/OrderService.java#L295-L296) viết
"Với COD thì mốc đúng là ĐÃ GIAO: giao xong nghĩa là đã thu tiền" — khẳng định này **không đúng** với
sơ đồ trạng thái hiện tại.

**Hướng sửa gợi ý:** thêm nhánh `SHIPPING → CANCELLED` (giao thất bại: hoàn kho, không ghi
`deliveredAt`). Song song, ở panel "Chờ chuyển tiền hoàn" hiện thêm phương thức thanh toán và cảnh báo
riêng cho COD. Sửa triệt để hơn: thêm bước "xác nhận đã thu tiền mặt" cho COD (chính là điểm số 2
trong danh sách "đã biết là cố ý") — mọi lỗ hổng dạng này đều bắt nguồn từ chỗ đó.

> *Đây là phản biện một quyết định đã cân nhắc (điểm 2: "COD giữ UNPAID vĩnh viễn"). Quyết định đó tự
> nó không sai, nhưng nó khiến hệ thống **không thể phân biệt** khách đã trả tiền với khách chưa, và
> khoản hoàn tiền lại là chỗ mà sự phân biệt đó quyết định tiền có đi hay không.*

---

## 2. [NGHIÊM TRỌNG] Khách thanh toán VNPay cho đơn vừa bị huỷ: tiền về shop, không danh sách nào ghi nhận

**Mức độ:** NGHIÊM TRỌNG (mất tiền — chính xác là ca "khoản phải hoàn rơi mất khỏi mọi danh sách")

**Ở đâu:** [OrderService.java:518-526](backend/src/main/java/com/datn/service/OrderService.java#L518-L526)

**Kịch bản tái hiện:**
1. Khách đặt đơn VNPay 900.000₫ → `PENDING`, `paymentStatus = UNPAID`, `refundStatus = NONE`.
2. Khách bấm thanh toán, hệ thống sinh URL VNPay (`vnp_ExpireDate` = +15 phút, xem
   [VNPayService.java:143](backend/src/main/java/com/datn/service/VNPayService.java#L143)). Khách đang
   ở trang cổng thanh toán.
3. Trong 15 phút đó, ở tab khác (hoặc điện thoại), khách đổi ý và bấm **Huỷ đơn**.
   `cancelMyOrder`: đơn còn `PENDING`, `khachDaTraTien()` = `false` (VNPAY + `UNPAID`) → **không hỏi
   số tài khoản**. Đơn thành `CANCELLED`, `paymentStatus` vẫn `UNPAID`, `refundStatus` vẫn `NONE`.
   *(Biến thể tương đương: admin bấm "Huỷ đơn" ở trang quản trị trong cùng khoảng thời gian.)*
4. Khách quay lại tab cổng thanh toán và bấm "Thanh toán". **Tiền rời tài khoản khách, về tài khoản
   shop.**
5. IPN tới. `handleVnpayCallback`: chữ ký đúng, số tiền đúng, chưa `PAID`, nhưng
   `status == CANCELLED` → ghi một dòng `log.error` rồi `return ALREADY_CONFIRMED`. **Không sửa gì
   trên đơn.**

**Chuyện gì xảy ra:** 900.000₫ nằm trong tài khoản shop. Đơn trong cơ sở dữ liệu ghi
`CANCELLED / UNPAID / refundStatus = NONE`. Đơn này **không** hiện trong ô "Chờ chuyển tiền hoàn"
(điều kiện là `refundStatus === 'PENDING'`), **không** vào thống kê doanh thu (`CANCELLED` bị loại từ
`findForStatistics`), **không** có nút nào để admin thao tác. Dấu vết duy nhất là một dòng log trên
đĩa. Không ai đọc log ứng dụng mỗi ngày để đối soát ngân hàng.

Và tệ hơn: kể cả khi admin **đọc được** dòng log đó, họ vẫn không ghi nhận được khoản nợ vào hệ thống
— không có endpoint nào đặt `refundStatus = PENDING` cho một đơn đã `CANCELLED`, và `confirmRefund`
đòi `refundStatus == PENDING` ([AdminOrderService.java:235-237](backend/src/main/java/com/datn/service/AdminOrderService.java#L235-L237)).

**Đáng lẽ phải:** đây chính là lúc phải sinh khoản phải hoàn: ghi `paymentStatus = REFUNDED` (bút toán
đảo khoản, đúng nghĩa đã định) và `refundStatus = PENDING`, để đơn nổi lên hàng chờ chuyển tiền — y
hệt nhánh admin huỷ đơn đã thanh toán ở
[AdminOrderService.java:167-170](backend/src/main/java/com/datn/service/AdminOrderService.java#L167-L170).

**Vì sao mắt thường khó thấy:** chú thích ngay tại chỗ
([OrderService.java:518-520](backend/src/main/java/com/datn/service/OrderService.java#L518-L520)) đã
**nhận diện đúng** vấn đề ("Tiền thật đã về tài khoản shop nên phải ghi log ở mức ERROR để còn đối
soát và hoàn tiền thủ công") — nên khi đọc lướt thì có cảm giác ca này "đã được xử lý". Nhưng ghi log
không phải là xử lý; nó chỉ chuyển trách nhiệm sang một quy trình ngoài hệ thống mà hệ thống không có.
Test `donDaHuyThiKhongSetPaid`
([OrderServiceVnpayTest.java:150-159](backend/src/test/java/com/datn/service/OrderServiceVnpayTest.java#L150-L159))
khẳng định đúng phần "không set PAID đè lên" và dừng ở đó — không ai hỏi tiếp "thế còn số tiền đã về
thì sao".

**Hướng sửa gợi ý:** trong nhánh `CANCELLED/RETURNED` của `handleVnpayCallback`, khi
`vnp_ResponseCode == "00"`, đặt `paymentStatus = REFUNDED` + `refundStatus = PENDING` rồi mới trả `02`.
Số tài khoản sẽ trống — cùng tình trạng với đơn admin huỷ, và phải sửa kèm mục 3 dưới đây thì mới có
lối ra.

---

## 3. [NẶNG] Khoản hoàn không có số tài khoản = kẹt vĩnh viễn, không ai điền vào được

**Mức độ:** NẶNG (đường cụt nghiệp vụ — khoản nợ khách không bao giờ tất toán được trong hệ thống)

**Ở đâu:**
- [AdminOrderService.java:162-170](backend/src/main/java/com/datn/service/AdminOrderService.java#L162-L170) — admin huỷ đơn đã thanh toán → `refundStatus = PENDING`, thông tin nhận tiền để trống
- [AdminOrderService.java:246-252](backend/src/main/java/com/datn/service/AdminOrderService.java#L246-L252) — `confirmRefund` chặn khi thiếu số tài khoản

**Kịch bản tái hiện:**
1. Khách thanh toán VNPay 900.000₫ cho đơn X → `PENDING`, `PAID`.
2. Admin bấm **"Huỷ đơn"** (vd hết hàng). `updateStatus`: `daTraTien = true` →
   `paymentStatus = REFUNDED`, `refundStatus = PENDING`. `refundBankName/AccountNumber/AccountHolder`
   đều **null** (khách chưa bao giờ được hỏi).
3. Đơn hiện ô vàng "Chờ chuyển tiền hoàn — **Chưa có tài khoản nhận, liên hệ khách để lấy thông tin**"
   ([AdminOrdersPage.tsx:215-219](frontend/src/pages/AdminOrdersPage.tsx#L215-L219)).
4. Admin gọi điện, khách đọc số tài khoản. **Admin gõ vào đâu?**

**Chuyện gì xảy ra:** không có chỗ nào để gõ. Kiểm tra toàn dự án: `refundBankName` chỉ được **ghi** ở
đúng một hàm, `OrderService.ghiThongTinHoanTien`
([OrderService.java:325-342](backend/src/main/java/com/datn/service/OrderService.java#L325-L342)), gọi
từ `cancelMyOrder` và `requestReturn` — cả hai đều là **API của khách**. `AdminOrderController` chỉ có
`PUT /status`, `PATCH /confirm-payment`, `PATCH /confirm-refund`; không có endpoint sửa thông tin hoàn
tiền. Và khách cũng không tự khai lại được: đơn đang `CANCELLED` nên `cancelMyOrder` ném lỗi (chỉ nhận
`PENDING/CONFIRMED`) còn `requestReturn` cũng ném lỗi (chỉ nhận `DELIVERED/COMPLETED`).

Kết quả đo được: đơn nằm vĩnh viễn trong ô "Chờ chuyển tiền hoàn", `refundStatus` **không bao giờ**
lên được `COMPLETED`. Shop có thể chuyển tiền thật ngoài đời, nhưng hệ thống mãi mãi báo là còn nợ —
và sau vài đơn như vậy thì cả danh sách chờ mất hết ý nghĩa, người ta bắt đầu bỏ qua nó (đúng cái rủi
ro mà chú thích ở [AdminOrderService.java:181-183](backend/src/main/java/com/datn/service/AdminOrderService.java#L181-L183)
lo về chiều ngược lại).

**Đáng lẽ phải:** có một endpoint admin cập nhật thông tin nhận tiền hoàn cho đơn đang
`refundStatus = PENDING` (dùng lại đúng `ghiThongTinHoanTien` để hai đường không lệch quy tắc), kèm ô
nhập trên giao diện quản trị.

**Vì sao mắt thường khó thấy:** thông báo lỗi ở
[AdminOrderService.java:250-251](backend/src/main/java/com/datn/service/AdminOrderService.java#L250-L251)
— *"Liên hệ khách để lấy thông tin rồi **cập nhật** trước khi xác nhận"* — mô tả một thao tác không
tồn tại. Đọc câu đó thì đinh ninh là có màn hình cập nhật ở đâu đó. Chú thích ở
[AdminOrdersPage.tsx:214-216](frontend/src/pages/AdminOrdersPage.tsx#L214-L216) cũng nói "Vẫn phải
hiện ra, vì đây là tiền đang nợ khách" — đúng ý định, nhưng chỉ hiện ra mà không cho làm gì tiếp.

---

## 4. [NẶNG] VNPay báo "Thanh toán thành công" cho giao dịch THẤT BẠI

**Mức độ:** NẶNG (dữ liệu hiển thị sai, đơn kẹt vì cả hai phía đều hiểu nhầm)

**Ở đâu:**
- [OrderService.java:528-534](backend/src/main/java/com/datn/service/OrderService.java#L528-L534) — giao dịch thất bại trả về `VnpayIpnResult.SUCCESS`
- [VnpayIpnResult.java:264-268](backend/src/main/java/com/datn/dto/order/VnpayIpnResult.java#L264-L268) — `laThanhToanThanhCong()` coi `SUCCESS` là đã thanh toán
- [VNPayReturnController.java:42-46](backend/src/main/java/com/datn/controller/VNPayReturnController.java#L42-L46) — dùng giá trị đó để chọn `status=success|failed`

**Kịch bản tái hiện:**
1. Khách đặt đơn VNPay 350.000₫, bấm thanh toán, sang cổng VNPay.
2. Ở cổng, khách bấm **Huỷ giao dịch** (hoặc thẻ không đủ tiền). VNPay redirect về
   `/api/vnpay/return` với `vnp_ResponseCode = 24`, chữ ký hợp lệ.
3. `handleVnpayCallback`: chữ ký OK → số tiền OK → chưa `PAID` → đơn chưa huỷ →
   `!"00".equals(responseCode)` → **`return SUCCESS`**.
4. `handleVnpayReturn` trả `SUCCESS.laThanhToanThanhCong()` = **`true`**.
5. Controller redirect sang `/vnpay-result?status=success`.

**Chuyện gì xảy ra:** khách thấy dấu tích xanh và dòng chữ *"Thanh toán thành công — Cảm ơn bạn! Đơn
hàng đã được ghi nhận thanh toán qua VNPay."*
([VNPayResultPage.tsx:26-31](frontend/src/pages/VNPayResultPage.tsx#L26-L31)) trong khi thẻ chưa hề bị
trừ. Đơn vẫn `PENDING / UNPAID`. Khách ngồi đợi hàng. Admin không xác nhận đơn được vì
`updateStatus` đòi VNPAY phải `PAID`
([AdminOrderService.java:104-109](backend/src/main/java/com/datn/service/AdminOrderService.java#L104-L109)).
Đơn treo cho tới khi ai đó gọi điện.

**Đáng lẽ phải:** `SUCCESS` (mã 00 gửi cho VNPay) mang nghĩa "mình đã xử lý xong thông báo", **không**
mang nghĩa "khách đã trả tiền". Trang kết quả phải căn cứ vào `vnp_ResponseCode`, hoặc vào
`paymentStatus` thật của đơn sau khi xử lý.

**Vì sao mắt thường khó thấy:** hai chú thích ngay cạnh nhau **mâu thuẫn** nhau và cả hai đều đúng
theo góc nhìn của nó:
- `SUCCESS` = *"Đã ghi nhận kết quả (**kể cả kết quả THẤT BẠI** do khách huỷ ở cổng thanh toán) — VNPay
  dừng gửi lại"* ([VnpayIpnResult.java:238-239](backend/src/main/java/com/datn/dto/order/VnpayIpnResult.java#L238-L239))
- `laThanhToanThanhCong()` = *"Giao dịch có thật sự được ghi nhận là ĐÃ THANH TOÁN hay không"*
  ([VnpayIpnResult.java:264-265](backend/src/main/java/com/datn/dto/order/VnpayIpnResult.java#L264-L265))

Một enum bị dùng cho hai câu hỏi khác nhau. Bộ test cũng bỏ lọt đúng khe này: có test cho
`ipn("24")` trả `SUCCESS`, có test cho `handleVnpayReturn("00")` trả `true`, nhưng **không có test nào
cho `handleVnpayReturn` với mã lỗi** ([OrderServiceVnpayTest.java:161-170](backend/src/test/java/com/datn/service/OrderServiceVnpayTest.java#L161-L170)).

**Hướng sửa gợi ý:** tách khái niệm. `laThanhToanThanhCong()` chỉ đúng khi đơn thực sự sang `PAID` —
thêm một giá trị enum riêng cho "đã xử lý xong nhưng giao dịch hỏng" (vẫn trả RspCode `00` cho VNPay,
nhưng `laThanhToanThanhCong()` trả `false`). `ALREADY_CONFIRMED` cũng cần xem lại: nó đang gộp cả
"đã ghi nhận PAID trước đó" (đúng là thành công) lẫn "đơn đã huỷ" (không phải).

---

## 5. [NẶNG] Huỷ đơn COD chưa giao vẫn bị bắt khai số tài khoản ngân hàng — và số đó bị vứt đi

**Mức độ:** NẶNG (chặn thao tác hợp lệ ở luồng phổ biến nhất; thu thập dữ liệu ngân hàng vô ích)

**Ở đâu:** [OrderDetailPage.tsx:201-202](frontend/src/pages/OrderDetailPage.tsx#L201-L202) đối chiếu
với [OrderService.java:298-314](backend/src/main/java/com/datn/service/OrderService.java#L298-L314)

**Kịch bản tái hiện:**
1. Khách đặt đơn **COD** 500.000₫. Đơn ở `PENDING`, `paymentStatus = UNPAID`. Khách chưa trả gì.
2. Khách vào chi tiết đơn, bấm **"Huỷ đơn"**.
3. `handleCancel` kiểm `canHoanTien`. Định nghĩa ở frontend:
   `order.paymentMethod === "COD" || order.paymentStatus !== "UNPAID"` → **`true`** (vì là COD).
4. Thay vì hộp thoại xác nhận đơn giản, hệ thống mở **form khai tài khoản nhận tiền hoàn**.
   `handleSubmitCancelWithRefund` chạy `kiemTaiKhoanHoanTien` và **chặn nút gửi** cho tới khi khách
   điền đủ tên ngân hàng + số tài khoản 6-20 chữ số + tên chủ tài khoản.

**Chuyện gì xảy ra:** khách hàng COD — nhóm đông nhất và là nhóm **chưa trả một đồng nào** — không huỷ
được đơn nếu không khai số tài khoản ngân hàng. Ai không muốn khai thì kẹt luôn, phải chờ admin huỷ hộ.
Ai chịu khai thì backend nhận request, `khachDaTraTien()` trả `false` (COD nhưng chưa
`DELIVERED`, `deliveredAt` null) nên **không gọi `ghiThongTinHoanTien`** — ba trường vừa gõ bị bỏ đi
lặng lẽ, `refundStatus` vẫn `NONE`. Khách vừa gõ số tài khoản của mình vào một cái form không dùng nó
vào việc gì.

**Đáng lẽ phải:** đơn COD chưa giao thì huỷ thẳng, chỉ hỏi một câu xác nhận — đúng như nhánh
`else` ngay dưới đó đã viết sẵn.

**Vì sao mắt thường khó thấy:** chú thích trên `canHoanTien` tự nhận là *"**Bản sao** của
OrderService.khachDaTraTien"* — nhưng nó **không phải bản sao**. Backend nhánh COD kiểm thêm trạng thái
giao hàng; frontend trả `true` **vô điều kiện** cho mọi đơn COD. Chính chú thích của backend
([OrderService.java:300-302](backend/src/main/java/com/datn/service/OrderService.java#L300-L302)) đã
cảnh báo đúng cái bẫy này: *"KHÔNG được trả về true vô điều kiện, nếu không luồng huỷ đơn sẽ đòi số
tài khoản của người chẳng có gì để nhận lại"* — backend tránh được, frontend rơi vào. Lý lẽ trong chú
thích frontend (*"Yêu cầu trả hàng chỉ mở ở đơn đã giao"*) chỉ đúng cho **luồng trả hàng**, nhưng biến
`canHoanTien` lại được dùng chung cho cả **luồng huỷ đơn** (dòng 227), nơi đơn chắc chắn chưa giao.
54 test frontend chạy ở môi trường node không có DOM nên không chạm tới nhánh này.

**Hướng sửa gợi ý:** cho `canHoanTien` nhận thêm ngữ cảnh, hoặc tách làm hai: `canHoanTienKhiTraHang`
(giữ nguyên) và `canHoanTienKhiHuy` (`paymentStatus !== 'UNPAID'`, COD không tính). Tốt nhất là để
backend trả thẳng một cờ trong `OrderResponse` thay vì frontend chép lại quy tắc.

---

## 6. [NHẸ] Hoá đơn POS chuyển khoản đã thu tiền, bị huỷ sau đó: khoản nợ khách không nằm ở đâu cả

**Mức độ:** NHẸ (số tiền có thật nhưng luồng POS là bán tại quầy, khả năng phát hiện tại chỗ cao)

**Ở đâu:** [PosOrderService.java:290-320](backend/src/main/java/com/datn/service/PosOrderService.java#L290-L320)

**Kịch bản tái hiện:**
1. Thu ngân lập hoá đơn POS 1.200.000₫, khách chọn **Chuyển khoản**. `checkout` →
   `COMPLETED`, `paymentStatus = UNPAID`.
2. Thu ngân kiểm app ngân hàng, thấy tiền về, bấm "Xác nhận đã nhận CK" → `paymentStatus = PAID`.
3. Phát hiện quét nhầm hàng → bấm **hoàn/huỷ hoá đơn** (`voidCompletedInvoice`).

**Chuyện gì xảy ra:** kho được hoàn, voucher được trả lượt, `paymentStatus = REFUNDED`, nhưng
`refundStatus` **vẫn là `NONE`** — `voidCompletedInvoice` không đụng tới nó. 1.200.000₫ đã thực sự
nằm trong tài khoản shop và phải chuyển trả, nhưng hoá đơn không vào danh sách chờ chuyển tiền nào.
Và kể cả muốn đưa vào cũng không được: `AdminOrderService.confirmRefund` gọi `requireOnlineOrder` nên
**từ chối thẳng mọi đơn POS**
([AdminOrderService.java:230, 260-264](backend/src/main/java/com/datn/service/AdminOrderService.java#L260-L264)).

**Đáng lẽ phải:** hoặc đặt `refundStatus = PENDING` và mở đường xác nhận hoàn tiền cho POS, hoặc ít
nhất hiện cảnh báo tại quầy "hoá đơn này đã thu tiền chuyển khoản — nhớ chuyển trả khách".

**Vì sao mắt thường khó thấy:** `voidCompletedInvoice` xử lý rất chỉn chu ba việc (kho, voucher,
`paymentStatus`) nên đọc qua có cảm giác đầy đủ; `refundStatus` là cột mới thêm ở PR hoàn tiền và
luồng POS không được cập nhật theo.

**Hướng sửa gợi ý:** thống nhất một hàng chờ hoàn tiền cho cả hai kênh, hoặc ghi rõ trong tài liệu
rằng POS hoàn tiền tại quầy ngoài hệ thống.

---

## 7. [NHẸ] Mã giảm 100% + miễn phí ship → đơn VNPay 0₫, không thanh toán được, không xác nhận được

**Mức độ:** NHẸ (đường cụt, cần admin tạo mã giảm 100%)

**Ở đâu:**
- [VoucherService.java:66-69](backend/src/main/java/com/datn/service/VoucherService.java#L66-L69) — cho phép `PERCENT` đúng bằng 100
- [OrderService.java:133-135](backend/src/main/java/com/datn/service/OrderService.java#L133-L135) — `totalAmount = total - discount + shippingFee`
- [ShippingService.java:47-49](backend/src/main/java/com/datn/service/ShippingService.java#L47-L49) — đơn ≥ 1.000.000₫ miễn phí ship

**Kịch bản tái hiện:**
1. Admin tạo mã `TANG100` giảm `PERCENT` = 100, không đặt `maxDiscountAmount`.
2. Khách đặt đơn 1.500.000₫ (≥ ngưỡng miễn phí ship) chọn **VNPay**, áp `TANG100`.
3. `discount = 1.500.000`, `shippingFee = 0` → `totalAmount = 0`.
4. Khách bấm thanh toán: `getVnpayPaymentUrl` không chặn, `buildPaymentUrl` gửi `vnp_Amount = 0`.

**Chuyện gì xảy ra:** đơn không thể sang `PAID` (VNPay không nhận giao dịch 0₫ — *tôi không kiểm chứng
được hành vi cụ thể của cổng VNPay chỉ bằng đọc mã*). Admin cũng không xác nhận được vì `updateStatus`
đòi VNPAY phải `PAID`. Đơn kẹt `PENDING` cho tới khi bị huỷ, và lượt dùng mã đã bị trừ (chỉ được trả
lại khi huỷ).

**Đáng lẽ phải:** đơn có `totalAmount == 0` thì không đi qua cổng thanh toán — đánh dấu `PAID` ngay
lúc checkout, hoặc chặn không cho chọn VNPay/BANK_TRANSFER.

**Hướng sửa gợi ý:** thêm một nhánh trong `checkout`: `totalAmount.signum() == 0` →
`paymentStatus = PAID` bất kể phương thức.

---

## 8. [NHẸ] Biểu đồ doanh thu theo ngày không cộng đủ bằng ô "Doanh thu gộp"

**Mức độ:** NHẸ (báo cáo mâu thuẫn nội bộ, không mất tiền)

**Ở đâu:** [AdminStatisticsService.java:185-204](backend/src/main/java/com/datn/service/AdminStatisticsService.java#L185-L204)

**Kịch bản tái hiện:**
1. Đơn Y 800.000₫ tạo và hoàn tất ngày **10/07**.
2. Khách trả hàng, admin duyệt ngày **05/09** → `returnedAt = 05/09`.
3. Admin xem thống kê khoảng **01/09 → 30/09**.

**Chuyện gì xảy ra:** `findForStatistics` lấy đơn Y vào (lọc `RETURNED` theo `returnedAt`). Ô
**"Doanh thu gộp"** = `heldRevenue + returnedRevenue` nên **có** 800.000₫ của đơn Y. Nhưng biểu đồ
theo ngày ghi doanh thu vào `o.getCreatedAt()` = **10/07**, nằm ngoài vòng lặp `for (d = from; ...)`
nên bị **rơi mất**; chỉ cột "hoàn trả" ngày 05/09 hiện 800.000₫. Kết quả: tổng các cột xanh của biểu đồ
nhỏ hơn ô "Doanh thu gộp" đúng 800.000₫, mà không có gì giải thích chênh lệch đó.

**Đáng lẽ phải:** hoặc kẹp ngày doanh thu về `from` khi `createdAt` nằm trước kỳ, hoặc bỏ phần doanh
thu của đơn `RETURNED` bán ngoài kỳ ra khỏi `grossRevenue` — chọn cách nào cũng được, miễn hai con số
dùng chung một định nghĩa.

**Vì sao mắt thường khó thấy:** chú thích ở
[AdminStatisticsService.java:187-190](backend/src/main/java/com/datn/service/AdminStatisticsService.java#L187-L190)
giải thích rất kỹ và rất đúng **vì sao** doanh thu phải vào ngày bán còn khoản hoàn vào ngày hoàn.
Chính vì lý lẽ đó thuyết phục nên không ai hỏi tiếp: "ngày bán ấy có nằm trong khoảng đang xem không?"

---

## 9. [NHẸ] Chú thích của `xoaDauDaDung` mô tả một hợp đồng mà mã gọi không thực hiện

**Mức độ:** NHẸ (khiếm khuyết tài liệu — **không dựng được kịch bản gây hại**)

**Ở đâu:** [VoucherUsageRepository.java:72-81](backend/src/main/java/com/datn/repository/VoucherUsageRepository.java#L72-L81)
đối chiếu với [VoucherService.java:212-220](backend/src/main/java/com/datn/service/VoucherService.java#L212-L220)

Javadoc viết: *"Trả về số dòng đã xoá **để bên gọi biết** có thực sự xoá được không: 0 nghĩa là khách
chưa từng được ghi nhận dùng mã này, lúc đó **KHÔNG được trừ** `usedCount` toàn cục."*

`revertVoucherUsage` **bỏ qua hoàn toàn giá trị trả về** và luôn trừ `usedCount`:

```java
if (userId != null) {
    voucherUsageRepository.xoaDauDaDung(v.getVoucherId(), userId);   // giá trị trả về bị vứt
}
v.setUsedCount(Math.max(0, current - 1));                            // trừ vô điều kiện
```

Tôi đã thử dựng kịch bản khai thác và **không dựng được**: mọi đường tới `revertVoucherUsage` đều đối
xứng với một lần `applyVoucher` đã tăng `usedCount` trước đó (kể cả đơn POS `userId = null`, kể cả đơn
cũ tạo trước khi có bảng `voucher_usages` — những đơn ấy vẫn đã tăng `usedCount`). Nên ở đây **mã đang
đúng còn chú thích thì sai**: nó mô tả một biện pháp phòng vệ không tồn tại và không cần thiết. Vấn đề
là người sửa sau sẽ tin vào chú thích đó.

**Hướng sửa gợi ý:** sửa chú thích cho khớp mã (nói rõ `usedCount` và `voucher_usages` được duy trì
độc lập và cả hai đều đối xứng với `applyVoucher`), hoặc dùng giá trị trả về đúng như đã hứa.

---

## Cần điều tra thêm (chưa dựng được kịch bản, cần kiểm bằng cách chạy thật)

1. **Khoá bi quan trên SQL Server.** `@Lock(PESSIMISTIC_WRITE)` với `SQLServerDialect` được kỳ vọng
   sinh ra `WITH (UPDLOCK, ROWLOCK)`. Tôi **không xác minh được điều này chỉ bằng đọc mã** — cần bật
   `show-sql` rồi chạy `tools/race-stock.js` và đọc câu SQL thật. Nếu gợi ý khoá bị bỏ qua, toàn bộ lập
   luận chống race trong `AdminOrderService.updateStatus`, `PosOrderService.addItem` và
   `VoucherService.applyVoucher` sụp theo. 145 test Mockito không chứng minh được điều này.
2. **`ddl-auto=update` và ràng buộc UNIQUE.** File `menswear_db_mssql.sql` có
   `uq_voucher_usage_user` (dòng 3790) nên cơ sở dữ liệu dựng mới thì đúng. Nhưng nếu ở máy nào bảng
   `voucher_usages` đã được Hibernate tạo trước khi annotation `@UniqueConstraint` được thêm vào, thì
   `update` **không** bổ sung ràng buộc cho bảng có sẵn — lúc đó "mỗi khách một mã" chỉ còn được bảo vệ
   bằng câu kiểm tra Java. Cần chạy
   `SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('voucher_usages')` trên chính cơ sở dữ liệu
   đang chạy để xác nhận.
3. **VNPay với `vnp_Amount = 0`** (mục 7) và **`vnp_TxnRef` dùng lại** khi khách thanh toán lại một đơn
   đã thất bại (`buildPaymentUrl` luôn dùng `orderId` làm `TxnRef` —
   [VNPayService.java:133](backend/src/main/java/com/datn/service/VNPayService.java#L133)). Đặc tả
   VNPay yêu cầu `vnp_TxnRef` duy nhất trong ngày; nếu cổng từ chối mã trùng thì khách **không thanh
   toán lại được** sau một lần huỷ giữa chừng. Không kiểm chứng được bằng đọc mã, cần bắn thử vào
   sandbox.
4. **`handleVnpayCallback` không kiểm `vnp_TransactionStatus`.** Đặc tả VNPay yêu cầu cả
   `vnp_ResponseCode` **và** `vnp_TransactionStatus` đều `"00"`. Mã chỉ kiểm cái đầu. Tôi không biết
   sandbox có bao giờ trả tổ hợp lệch nhau hay không, nên không kết luận là lỗi.

---

## Đã soát mà KHÔNG thấy vấn đề

Liệt kê để biết vùng nào đã được che. Tất cả đều đã đọc từng dòng và thử dựng kịch bản phá.

**Mã giảm giá theo từng người** — `VoucherService.applyVoucher` khoá row voucher (`...ForUpdate`)
**trước** khi gọi `requireChuaDung`, đúng thứ tự. Hai request checkout song song của cùng một khách bị
tuần tự hoá bởi khoá đó, request sau nhìn thấy dòng `voucher_usages` đã commit và bị từ chối. Ràng buộc
UNIQUE trong cơ sở dữ liệu là lớp chặn thứ hai, `DataIntegrityViolationException` → 409 qua
`GlobalExceptionHandler`. `previewDiscount` cũng kiểm cùng quy tắc nên khách không nhìn thấy một tổng
tiền không có thật. Ngoại lệ POS (`userId = null`) là có chủ ý và nhất quán.

**`previewDiscountForAppliedVoucher`** — lập luận trong chú thích đúng và mã khớp: bỏ kiểm
`usageLimit` khi tính lại cho mã **đã** áp vào chính hoá đơn đó, vẫn kiểm `isActive`/ngày/`minOrderValue`.
Không có đường nào lách qua `usageLimit` bằng hàm này vì nó không tăng `usedCount`.

**`status_before_return`** — `requestReturn` ghi trạng thái cũ; `updateStatus` ép admin từ chối phải
trả đơn về **đúng** `statusBeforeReturn`, chặn cả `RETURN_REQUESTED → COMPLETED` lẫn
`→ DELIVERED` nếu không khớp. Nhánh dự phòng `null → COMPLETED` cho đơn cũ hợp lý. Frontend
`thaoTacCho()` tính nút theo từng đơn, khớp chính xác backend.

**Hạn đổi trả 7 ngày** — đếm từ `deliveredAt`, `deliveredAt` chỉ ghi lần đầu (`== null`) nên không bị
đẩy lùi. Đơn cũ `deliveredAt = null` cố ý không chặn. Hằng số khớp giữa `OrderService`,
`ReturnPolicyPage` và tài liệu chatbot.

**Đối xứng trừ/hoàn kho** — ONLINE: trừ đúng một lần tại `PENDING → CONFIRMED`, hoàn tại
`CONFIRMED → CANCELLED` và tại `→ RETURNED`; `cancelMyOrder` cũng chỉ hoàn khi đơn đang `CONFIRMED`.
POS: trừ tại `addItem`/`updateItemQuantity` (theo delta), hoàn tại `removeItem`/`cancelInvoice`/
`voidCompletedInvoice`. Không tìm được đường trừ hai lần hay quên hoàn.
`AdminOrderService.requireOnlineOrder` chặn đúng nguy cơ trừ kho hai lần cho hoá đơn POS, và
`findPendingInvoice` khoá hoá đơn đã chốt.

**Khoá lạc quan `Order.version`** — có `@Version`, cột tồn tại trong schema, `LegacyDataFixer` lấp
`NULL` lúc khởi động (và chú thích giải thích rõ vì sao `@Transactional` không dùng được ở đó — đúng,
vì gọi nội bộ không qua proxy). Hai request cùng sửa một đơn (khách huỷ trùng lúc admin xác nhận) thì
request sau nhận 409 chứ không ghi đè âm thầm, nên các nhánh hoàn kho không bị chạy hai lần.

**Xác thực chữ ký VNPay và tính idempotent của IPN** — `verifyReturn` kiểm HMAC-SHA512 trước khi tin
bất kỳ tham số nào (test khẳng định `orderRepository.findById` **không hề** được gọi khi chữ ký sai),
so sánh bằng `MessageDigest.isEqual`. Đối chiếu số tiền trước khi xét trạng thái. Gọi lại nhiều lần
không xử lý lại. Ánh xạ RspCode (00/01/02/04/97/99) khớp bảng của VNPay, controller luôn trả HTTP 200
với JSON và bắt `Exception` để trả 99 cho VNPay thử lại. **Riêng phía IPN là đúng** — lỗi ở mục 4 chỉ
nằm ở cách trang ReturnUrl diễn giải kết quả.

**Quyền sở hữu dữ liệu** — mọi API của khách đều truy theo `userId` từ token
(`findByOrderIdAndUser_UserId`), địa chỉ giao hàng được đối chiếu chủ sở hữu trong `checkout`,
`getOwnedCartItemOrThrow` chặn thao tác lên giỏ người khác, `ShippingController` nhận `addressId` chứ
không nhận tỉnh tự do. Không tìm được đường sửa đơn của người khác hay tự đặt giá — giá luôn lấy từ
`CartService.effectivePrice(variant.getProduct())` phía server, không bao giờ từ request.

**Checkout một phần giỏ hàng** — `cartItemIds` được lọc trên chính `cart.getItems()` của người gọi nên
không tham chiếu được dòng của giỏ khác; giỏ trống hoặc chọn rỗng đều bị chặn; khoá row `Cart` chặn
double-click tạo hai đơn.

**Số lượng âm/0** — mọi DTO số lượng đều có `@Min(1)` + `@NotNull` và controller đều `@Valid`
(`AddToCartRequest`, `UpdateCartItemRequest`, `PosDto.AddItemRequest`,
`PosDto.UpdateItemQuantityRequest`). Không có đường bơm số âm để làm phình kho.

**Dữ liệu voucher vô lý** — `validateFields` chặn `minOrderValue`/`maxDiscountAmount`/`usageLimit` âm
và `PERCENT > 100`; `computeDiscount` kẹp trần theo `maxDiscountAmount` và kẹp trên theo `subtotal` nên
`totalAmount` không âm được. (Ca `PERCENT = 100` đúng ngưỡng là mục 7, không phải lỗi kiểm dữ liệu.)

**`confirmPayment` (cả ONLINE lẫn POS)** — chỉ nhận `BANK_TRANSFER`, chặn xác nhận trùng, chặn đơn đã
`CANCELLED/RETURNED`. Không có đường tự đánh dấu `PAID` cho đơn VNPay mà không qua cổng
(`PosOrderService.checkout` cũng chặn `VNPAY` ở tầng service, không chỉ ở DTO).

**Công thức doanh thu gộp/thuần** — lập luận "gộp = đang giữ + đã hoàn, thuần = đang giữ" là đúng và
tránh được lỗi trừ khống mà chú thích mô tả; `isRealizedRevenue` loại đúng hoá đơn POS chuyển khoản
chưa xác nhận mà không loại nhầm doanh thu COD; `findForStatistics` lọc đơn `RETURNED` theo `returnedAt`.
(Khe hở duy nhất tìm được là mục 8, chỉ ảnh hưởng biểu đồ.)

**Phí vận chuyển** — có trần `MAX_BILLABLE_KM` chặn toạ độ rác, có fallback khi VietMap lỗi nên lỗi API
ngoài không chặn được việc đặt hàng, và `ShippingController` dùng đúng `calculateFee` như `checkout`
nên số hiện ở màn thanh toán khớp số ghi vào đơn.

---

## Ghi chú về mức độ che phủ của kiểm thử hiện có

Bốn trong năm lỗi nặng nhất nằm ở **đường biên** mà bộ test hiện tại không với tới được:

| Lỗi | Vì sao test hiện có không bắt |
|---|---|
| 1 (COD giao thất bại) | Cần đi qua **chuỗi nhiều trạng thái** + hai service + giao diện admin. Test đơn vị Mockito soát từng phương thức riêng lẻ. |
| 2 (VNPay trên đơn đã huỷ) | Có test, nhưng test **dừng ở** "không set PAID" — đúng phần đã nghĩ tới, không hỏi tiếp về số tiền đã về. |
| 3 (không ai điền được số tài khoản) | Là lỗi **thiếu một endpoint**. Không test nào phát hiện được thứ không tồn tại. |
| 4 (ReturnUrl báo sai) | `OrderServiceVnpayTest` phủ kỹ nhánh IPN nhưng chỉ gọi `handleVnpayReturn` với mã `"00"`. |
| 5 (COD huỷ đơn đòi tài khoản) | Lệch giữa **frontend và backend**. 54 test frontend chạy môi trường node không DOM, chỉ phủ hàm thuần. |

Đề xuất: một bộ công cụ bắn API kiểu `backend/tools/` cho **chuỗi trạng thái đầy đủ** (đặt → xác nhận
→ giao → giao hỏng → trả hàng → hoàn tiền) sẽ bắt được mục 1 và 3; thêm một test cho
`handleVnpayReturn("24")` bắt được mục 4 trong vài dòng.
