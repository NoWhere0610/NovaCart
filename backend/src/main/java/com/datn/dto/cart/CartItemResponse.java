package com.datn.dto.cart;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class CartItemResponse {
    private Long cartItemId;
    private Long variantId;
    private Long productId;
    private String productName;
    private String imageUrl;
    private String size;
    private String color;
    /** Giá tại thời điểm xem giỏ hàng (ưu tiên salePrice nếu có) — CHƯA nhân số lượng. */
    private BigDecimal unitPrice;
    private Integer quantity;
    private BigDecimal subtotal;
    /** Tồn kho hiện tại của variant — frontend dùng để cảnh báo "vượt tồn kho" trước khi checkout. */
    private Integer stockQuantity;
}