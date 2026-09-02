package com.datn.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProductVariantResponse {
    private Long variantId;
    private String size;
    private String color;
    private String sku;
    private Integer stockQuantity;
}