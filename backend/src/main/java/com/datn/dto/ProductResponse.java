package com.datn.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class ProductResponse {
    private Long productId;
    private String productName;
    private String slug;
    private BigDecimal price;
    private BigDecimal salePrice;
    private String thumbnailUrl;   // ảnh đại diện (is_thumbnail = true)
    private String categoryName;
    private String brandName;
}
