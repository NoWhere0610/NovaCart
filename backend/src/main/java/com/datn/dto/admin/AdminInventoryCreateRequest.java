package com.datn.dto.admin;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/** Thêm mới 1 mặt hàng tồn kho (= 1 biến thể size/màu) cho 1 sản phẩm đã có sẵn. */
@Getter
@Setter
public class AdminInventoryCreateRequest {

    @NotNull(message = "Vui lòng chọn sản phẩm")
    private Long productId;

    @NotBlank(message = "Size không được để trống")
    private String size;

    @NotBlank(message = "Màu sắc không được để trống")
    private String color;

    private String sku;

    @NotNull(message = "Tồn kho không được để trống")
    @Min(value = 0, message = "Tồn kho không được âm")
    private Integer stockQuantity;
}
