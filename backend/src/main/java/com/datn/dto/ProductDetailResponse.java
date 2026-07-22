package com.datn.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Builder
public class ProductDetailResponse {
    private Long productId;
    private String productName;
    private String slug;
    private String description;
    private BigDecimal price;
    private BigDecimal salePrice;
    private String material;
    private String categoryName;
    private String brandName;
    /** Toàn bộ ảnh (không chỉ thumbnail) để hiển thị gallery ở trang chi tiết. */
    private List<String> imageUrls;
    /** Danh sách phân loại size/màu để user chọn trước khi thêm vào giỏ. */
    private List<ProductVariantResponse> variants;
    // Sprint 4: rating tổng hợp, tính sẵn ở BE để FE khỏi phải gọi thêm API riêng
    // ngay lúc load trang chi tiết (chỉ cần gọi thêm khi xem DANH SÁCH review đầy đủ)
    private Double averageRating;
    private Long reviewCount;
}