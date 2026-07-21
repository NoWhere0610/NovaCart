package com.datn.dto.admin;

import com.datn.entity.Order;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateOrderStatusRequest {

    @NotNull(message = "Vui lòng chọn trạng thái mới")
    private Order.Status status;
}