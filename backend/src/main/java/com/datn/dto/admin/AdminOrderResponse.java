package com.datn.dto.admin;

import com.datn.dto.order.OrderItemResponse;
import com.datn.entity.Order;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class AdminOrderResponse {
    private Long orderId;
    private Order.OrderType orderType;
    private Long buyerUserId;
    private String buyerUsername;
    private String buyerEmail;
    private String receiverName;
    private String phone;
    private String shippingAddress;
    private BigDecimal totalAmount;
    private BigDecimal shippingFee;
    private Order.Status status;
    private Order.PaymentMethod paymentMethod;
    private Order.PaymentStatus paymentStatus;
    private String note;
    private String returnReason;

    /** Trạng thái đơn trước khi khách gửi yêu cầu trả hàng -- nút "Từ chối" phải đưa đơn về đúng đây. */
    private Order.Status statusBeforeReturn;

    // ----- Hoàn tiền -----
    // refundStatus là thứ nói tiền ĐÃ ĐI hay chưa; paymentStatus.REFUNDED ở trên chỉ là bút toán đảo
    // khoản, được đặt ngay lúc duyệt trả hàng. Xem Order.RefundStatus.
    private Order.RefundStatus refundStatus;
    private String refundBankName;
    private String refundAccountNumber;
    private String refundAccountHolder;
    private LocalDateTime refundCompletedAt;

    private LocalDateTime createdAt;
    private List<OrderItemResponse> items;
}