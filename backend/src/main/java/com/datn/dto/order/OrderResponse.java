package com.datn.dto.order;

import com.datn.entity.Order;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class OrderResponse {
    private Long orderId;
    private String orderCode;
    private String receiverName;
    private String phone;
    private String shippingAddress;
    private BigDecimal totalAmount;
    // Sprint 4: chi tiết áp mã giảm giá
    private BigDecimal subtotalAmount;
    private BigDecimal discountAmount;
    private BigDecimal shippingFee;
    private String voucherCode;
    private Order.Status status;
    private Order.PaymentMethod paymentMethod;
    private Order.PaymentStatus paymentStatus;
    // Chỉ có giá trị khi paymentMethod=BANK_TRANSFER và còn UNPAID -- xem VietQrService.
    private String qrCodeUrl;
    private String note;
    private String returnReason;

    // Khách cũng cần thấy tiến độ hoàn tiền của chính mình -- gửi yêu cầu xong mà màn hình không nói gì
    // thêm thì chỉ còn cách gọi điện hỏi. Số tài khoản trả về để khách tự đối chiếu xem có khai nhầm không.
    private Order.RefundStatus refundStatus;
    private String refundBankName;
    private String refundAccountNumber;
    private String refundAccountHolder;
    private LocalDateTime refundCompletedAt;
    private LocalDateTime createdAt;
    // null ở API danh sách (list) để nhẹ payload, chỉ có giá trị ở API xem chi tiết 1 đơn
    private List<OrderItemResponse> items;
}