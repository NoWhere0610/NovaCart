package com.datn.dto.admin;

import com.datn.dto.ProductVariantResponse;
import com.datn.entity.Product;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class AdminProductResponse {
    private Long productId;
    private String productName;
    private String slug;
    private String description;
    private Integer categoryId;
    private String categoryName;
    private Integer brandId;
    private String brandName;
    private BigDecimal price;
    private BigDecimal salePrice;
    private String material;
    private Product.Status status;
    private List<String> imageUrls;
    private List<ProductVariantResponse> variants;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}