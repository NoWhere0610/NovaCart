package com.datn.dto.order;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class OrderItemResponse {
    // Chỉ có giá trị khi cần thao tác trên từng dòng (POS xoá dòng khỏi hoá đơn chờ), không dùng ở "đơn của tôi".
    private Long orderItemId;
    private Long variantId;
    // Null nếu sản phẩm/biến thể gốc đã bị xoá -- client vẫn hiển thị tên/giá snapshot nhưng ẩn nút
    // "Đánh giá"/"Mua lại".
    private Long productId;
    private String productName;
    private String size;
    private String color;
    private BigDecimal unitPrice;
    private Integer quantity;
    private BigDecimal subtotal;
    // true nếu user đã đánh giá sản phẩm này -- chỉ populate ở API "đơn của tôi", không dùng cho admin.
    private Boolean reviewed;
}