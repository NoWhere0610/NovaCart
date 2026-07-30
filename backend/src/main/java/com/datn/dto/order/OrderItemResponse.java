package com.datn.dto.order;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class OrderItemResponse {
    // Có thể null nếu sản phẩm/biến thể gốc đã bị xoá khỏi hệ thống — khi đó
    // client vẫn hiển thị được tên/giá (đã snapshot) nhưng ẩn nút "Đánh giá"/"Mua lại"
    private Long productId;
    private String productName;
    private String size;
    private String color;
    private BigDecimal unitPrice;
    private Integer quantity;
    private BigDecimal subtotal;
    // true nếu user hiện tại đã đánh giá sản phẩm này rồi — chỉ populate ở API
    // "đơn của tôi" (không dùng cho phía admin)
    private Boolean reviewed;
}