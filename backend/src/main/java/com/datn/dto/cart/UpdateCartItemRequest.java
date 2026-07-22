package com.datn.dto.cart;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateCartItemRequest {

    @NotNull(message = "Số lượng không được để trống")
    @Min(value = 1, message = "Số lượng tối thiểu là 1 (dùng API xoá nếu muốn bỏ sản phẩm)")
    private Integer quantity;
}