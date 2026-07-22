package com.datn.dto.admin;

import com.datn.entity.Product;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class AdminProductRequest {

    @NotBlank(message = "Tên sản phẩm không được để trống")
    private String productName;

    private String description;

    @NotNull(message = "Vui lòng chọn danh mục")
    private Integer categoryId;

    private Integer brandId;

    @NotNull(message = "Giá bán không được để trống")
    @DecimalMin(value = "0", message = "Giá bán phải >= 0")
    private BigDecimal price;

    // null = không giảm giá
    private BigDecimal salePrice;

    private String material;

    private Product.Status status;

    // Danh sách URL ảnh theo đúng thứ tự hiển thị — ảnh đầu tiên là thumbnail
    private List<String> imageUrls;

    // Danh sách phân loại size/màu — xem giải thích cơ chế đồng bộ ở AdminProductService.syncVariants
    @Valid
    private List<AdminVariantRequest> variants;
}