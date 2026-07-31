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
    private String note;
    private String returnReason;
    private LocalDateTime createdAt;
    // null ở API danh sách (list) để nhẹ payload, chỉ có giá trị ở API xem chi tiết 1 đơn
    private List<OrderItemResponse> items;
}