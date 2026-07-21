package com.datn.dto.admin;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminVariantRequest {

    // null = tạo mới, có giá trị = đang sửa variant đã tồn tại (xem AdminProductService.syncVariants)
    private Long variantId;

    @NotBlank(message = "Size không được để trống")
    private String size;

    @NotBlank(message = "Màu sắc không được để trống")
    private String color;

    private String sku;

    @NotNull(message = "Tồn kho không được để trống")
    @Min(value = 0, message = "Tồn kho không được âm")
    private Integer stockQuantity;
}