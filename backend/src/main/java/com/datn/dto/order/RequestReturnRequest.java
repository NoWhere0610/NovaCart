package com.datn.dto.order;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RequestReturnRequest {

    @NotBlank(message = "Vui lòng nhập lý do trả hàng/hoàn tiền")
    @Size(max = 500, message = "Lý do tối đa 500 ký tự")
    private String reason;
}