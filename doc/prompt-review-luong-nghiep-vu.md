# Prompt: soát độc lập luồng nghiệp vụ bán hàng NovaCart

> Mở file này, copy toàn bộ phần trong khung dưới, dán cho người/mô hình soát độc lập.
> Phần này KHÔNG phải tài liệu hệ thống — nó là đề bài cho người soát.

---

Bạn là kỹ sư soát mã độc lập, được thuê để tìm lỗi NGHIỆP VỤ trong một hệ thống thương mại điện tử
trước khi nó được đem đi bảo vệ đồ án. Bạn KHÔNG phải người viết mã này và không có lợi ích gì trong
việc nó trông đẹp.

## Bối cảnh hệ thống

NovaCart — bán quần áo nam. Backend Java Spring Boot + SQL Server, frontend React/TypeScript.

Hai kênh bán song song, dùng chung bảng `orders` (phân biệt bằng cột `order_type`):
- **ONLINE**: khách tự đặt trên web
- **POS**: nhân viên bán tại quầy, khách vãng lai không có tài khoản (`orders.user_id` NULL)

Ba phương thức thanh toán: `COD`, `BANK_TRANSFER` (chuyển khoản tay, admin xác nhận đã nhận), `VNPAY`
(cổng thanh toán, có IPN).

Trạng thái đơn: `PENDING → CONFIRMED → SHIPPING → DELIVERED → COMPLETED`, rẽ nhánh `CANCELLED` (đầu
luồng) và `RETURN_REQUESTED → RETURNED` (cuối luồng).

## Phạm vi cần soát

Chỉ soát **luồng nghiệp vụ tiền và hàng**. Bỏ qua thẩm mỹ giao diện, cách đặt tên, kiến trúc.

| Luồng | File chính |
|---|---|
| Giỏ hàng | `service/CartService.java` |
| Đặt hàng | `service/OrderService.java` (`checkout`) |
| Huỷ đơn (khách) | `service/OrderService.java` (`cancelMyOrder`) |
| Trả hàng / hoàn tiền | `service/OrderService.java` (`requestReturn`), `service/AdminOrderService.java` (`updateStatus`, `confirmRefund`) |
| Chuyển trạng thái + tồn kho | `service/AdminOrderService.java` |
| Mã giảm giá | `service/VoucherService.java`, `entity/VoucherUsage.java` |
| Phí vận chuyển | `service/ShippingService.java` |
| Bán tại quầy | `service/PosOrderService.java` |
| Thanh toán VNPay | `service/VNPayService.java`, `service/OrderService.java` (`handleVnpayCallback`), `controller/VNPayIpnController.java` |
| Thống kê doanh thu | `service/AdminStatisticsService.java` |

## Điều quan trọng nhất: ĐỪNG TIN CHÚ THÍCH

Mã nguồn này có rất nhiều chú thích tiếng Việt giải thích "vì sao làm thế này". Chú thích được viết bởi
chính người viết mã, nên nó phản ánh Ý ĐỊNH chứ không chứng minh HÀNH VI. Đã có ít nhất một trường hợp
trong dự án này chú thích mô tả một đằng, mã chạy một nẻo.

Với mỗi chỗ có chú thích khẳng định điều gì đó ("đã khoá row", "đã kiểm tra", "không thể xảy ra"), hãy
tự đọc mã và xác minh lại. Nếu chú thích sai, đó là một phát hiện có giá trị.

## Loại lỗi cần ưu tiên tìm

Xếp theo mức độ nghiêm trọng đối với một hệ thống bán hàng thật:

1. **Tiền sai** — thu thiếu, thu thừa, hoàn thiếu, hoàn cho người không đáng, hoặc hệ thống ghi nhận
   một khoản tiền đã chuyển trong khi thực tế chưa chuyển
2. **Hàng sai** — bán vượt tồn kho, kho phình khống, trừ kho hai lần, quên hoàn kho
3. **Trạng thái đơn đi sai đường** — nhảy cóc, đi ngược, kẹt vĩnh viễn không có đường ra
4. **Người dùng làm được việc không được phép** — sửa đơn của người khác, tự đổi giá, dùng lại mã đã hết lượt
5. **Đua tranh (race)** — hai request song song cùng đọc rồi cùng ghi, mất cập nhật
6. **Đường cụt nghiệp vụ** — trạng thái mà nhân viên không có thao tác nào hợp lệ để xử lý tiếp

## Ba câu hỏi nên tự đặt ở mọi nhánh

- Nếu request này DỪNG GIỮA CHỪNG (mất mạng, lỗi), dữ liệu còn nhất quán không?
- Nếu hai người bấm cùng lúc thì sao?
- Nếu người dùng gọi thẳng API, bỏ qua giao diện, thì cái gì chặn họ?

## Những chỗ ĐÃ BIẾT là cố ý — vẫn được phản biện, nhưng đừng báo như lỗi mới

Nêu ra để bạn không mất thời gian, KHÔNG phải để bạn im lặng. Nếu bạn thấy quyết định nào trong đây
thực sự sai, cứ nói — nhưng hãy nói rõ là bạn đang phản biện một quyết định đã cân nhắc.

1. **Đặt hàng KHÔNG trừ kho.** Kho chỉ bị trừ khi admin xác nhận đơn (`PENDING → CONFIRMED`). Lý do:
   không giữ kho ảo cho đơn có thể bị bỏ. Hệ quả đã biết: hai khách cùng đặt món cuối, người được xác
   nhận trước thắng.
2. **Đơn COD giữ `payment_status = 'UNPAID'` vĩnh viễn**, kể cả sau khi khách đã trả tiền mặt cho
   shipper — hệ thống không có bước "xác nhận đã thu tiền mặt". Mọi chỗ suy ra "khách đã trả tiền chưa"
   đều KHÔNG được dựa vào `payment_status` với đơn COD.
3. **`payment_status = 'REFUNDED'` chỉ là bút toán đảo khoản**, đặt ngay lúc duyệt trả hàng/huỷ đơn,
   KHÔNG có nghĩa tiền đã chuyển. Việc tiền đã đi hay chưa do `refund_status` theo dõi.
4. **Ngưỡng miễn phí ship tính trên tiền hàng TRƯỚC giảm giá.** Đã cân nhắc và giữ nguyên.
5. **Hoá đơn POS không bị giới hạn "mỗi khách một mã giảm giá"** vì không gắn tài khoản khách nào.
6. **Chưa tích hợp API hoàn tiền của VNPay** — mọi khoản hoàn đều chuyển khoản tay.

## Những chỗ vừa được sửa — hãy soát KỸ HƠN chỗ khác

Đây là mã mới, chưa qua sử dụng thật, và người sửa cũng là người tự đánh giá kết quả. Xác suất còn sót
ở đây cao hơn hẳn phần mã cũ đã chạy lâu:

- Luồng hoàn tiền: `refund_status` (NONE/PENDING/COMPLETED), `confirmRefund`, thông tin tài khoản nhận
- Nhánh huỷ đơn đã thanh toán phải khai tài khoản nhận tiền
- Giới hạn mã giảm giá theo từng người (`voucher_usages`, ràng buộc UNIQUE)
- `status_before_return` — từ chối yêu cầu trả hàng thì trả đơn về đúng trạng thái cũ
- Hạn đổi trả 7 ngày kể từ `delivered_at`
- Xử lý IPN của VNPay

Câu hỏi cụ thể đáng đào ở nhóm này: **có tổ hợp trạng thái nào khiến một khoản tiền phải hoàn bị rơi
mất khỏi mọi danh sách không?** Ví dụ cần kiểm: đơn đã khai tài khoản rồi bị chuyển trạng thái khác;
khách gửi yêu cầu trả hàng hai lần; admin từ chối rồi khách gửi lại.

## Cách làm việc mong đợi

**Bắt buộc kèm bằng chứng.** Với mỗi phát hiện, phải chỉ ra được:
- File và số dòng
- Kịch bản CỤ THỂ tái hiện được: ai làm gì, theo thứ tự nào, dữ liệu ra sao
- Hậu quả đo được (số tiền sai bao nhiêu, tồn kho lệch bao nhiêu, đơn kẹt ở đâu)

Không nhận phát hiện dạng "chỗ này nên cẩn thận hơn" hay "có thể có vấn đề". Nếu chỉ nghi ngờ mà chưa
dựng được kịch bản, hãy xếp riêng vào mục "cần điều tra thêm" và nói rõ cần kiểm gì để xác nhận.

**Nói rõ khi bạn không chắc.** Nếu một nhánh phụ thuộc vào hành vi của SQL Server, của Hibernate, hoặc
của cổng VNPay mà bạn không kiểm chứng được chỉ bằng cách đọc mã, hãy nói thẳng là bạn không xác minh
được, thay vì đoán theo hướng có lợi cho kết luận.

**Đừng bịa số.** Không ước tính thời gian sửa theo ngày/giờ. Không tự nghĩ ra con số thống kê.

## Định dạng báo cáo

Với mỗi phát hiện:

```
### [MỨC ĐỘ] Tiêu đề ngắn gọn
Mức độ: NGHIÊM TRỌNG (mất tiền/mất hàng) | NẶNG (dữ liệu sai, nghiệp vụ kẹt) | NHẸ (khó chịu, không mất mát)

**Ở đâu:** file:dòng

**Kịch bản tái hiện:**
1. ...
2. ...

**Chuyện gì xảy ra:** ...
**Đáng lẽ phải:** ...
**Vì sao mắt thường khó thấy:** ...
**Hướng sửa gợi ý:** (ngắn gọn, không cần viết mã đầy đủ)
```

Cuối báo cáo, thêm một mục:

**Đã soát mà KHÔNG thấy vấn đề:** liệt kê những nhánh bạn đã đọc kỹ và tin là đúng, kèm lý do ngắn.
Mục này quan trọng ngang mục phát hiện — nó cho biết vùng nào đã được che phủ, vùng nào chưa ai nhìn tới.

Nếu bạn soát xong mà không tìm thấy lỗi nghiêm trọng nào, hãy nói thẳng như vậy. Bịa ra vấn đề để báo
cáo trông có giá trị còn tệ hơn là không tìm được gì.

## Bối cảnh kiểm thử hiện có (để bạn biết chỗ nào đã được che, đừng tin là đủ)

- 145 test đơn vị backend (Mockito, không cơ sở dữ liệu) — chứng minh LOGIC QUYẾT ĐỊNH đúng, KHÔNG
  chứng minh khoá bi quan hay ràng buộc cơ sở dữ liệu thật sự hoạt động
- 54 test frontend (Vitest, môi trường node, KHÔNG có DOM) — chỉ phủ hàm thuần, không phủ giao diện
- 7 công cụ bắn thẳng vào API đang chạy trong `backend/tools/` (`refund-flow-test.js`,
  `cancel-refund-test.js`, `voucher-per-user-test.js`, `vnpay-ipn-test.js`, `race-stock.js`,
  `auth-profile-test.js`, `mail-reset-test.js`)

Vùng test đang mỏng nhất: `CartService`, `ShippingService`, `PosOrderService`, và toàn bộ giao diện.
