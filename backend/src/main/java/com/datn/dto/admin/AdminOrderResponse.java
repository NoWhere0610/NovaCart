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
    private String note;
    private String returnReason;
    private LocalDateTime createdAt;
    private List<OrderItemResponse> items;
}