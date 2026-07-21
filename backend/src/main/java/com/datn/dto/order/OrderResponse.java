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
    private String receiverName;
    private String phone;
    private String shippingAddress;
    private BigDecimal totalAmount;
    private Order.Status status;
    private Order.PaymentMethod paymentMethod;
    private String note;
    private LocalDateTime createdAt;
    // null ở API danh sách (list) để nhẹ payload, chỉ có giá trị ở API xem chi tiết 1 đơn
    private List<OrderItemResponse> items;
}