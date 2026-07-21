package com.datn.dto.cart;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Builder
public class CartResponse {
    private List<CartItemResponse> items;
    private Integer totalQuantity;
    private BigDecimal totalAmount;
}