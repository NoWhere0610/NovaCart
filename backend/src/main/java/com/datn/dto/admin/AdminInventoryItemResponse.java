package com.datn.dto.admin;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

/**
 * 1 dòng "Kho tồn hàng" -- tương ứng 1 biến thể (size/màu) của 1 sản phẩm.
 * Riêng với AdminProductResponse vì Inventory hiển thị phẳng theo variant kèm tên sản phẩm/danh mục.
 */
@Getter
@Builder
public class AdminInventoryItemResponse {
    private Long variantId;
    private Long productId;
    private String productName;
    private String categoryName;
    private String size;
    private String color;
    private String sku;
    private Integer stockQuantity;
    private BigDecimal price;
    private String productStatus;
    // true nếu tồn kho <= ngưỡng cảnh báo sắp hết hàng (xem AdminInventoryService.LOW_STOCK_THRESHOLD)
    private boolean lowStock;
}
