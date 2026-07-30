package com.datn.dto.admin;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

/**
 * 1 dòng trong màn "Kho tồn hàng" — tương ứng 1 biến thể (size/màu) của 1 sản phẩm.
 * Đây là DTO riêng cho màn Inventory (khác AdminProductResponse dùng cho màn Sản phẩm)
 * vì Inventory hiển thị phẳng theo variant kèm theo tên sản phẩm/danh mục để dễ tra cứu tồn kho.
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
