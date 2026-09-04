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

    @NotBlank(message = "Vui lòng nhập tên ngân hàng")
    @Size(max = 100, message = "Tên ngân hàng tối đa 100 ký tự")
    private String bankName;

    @NotBlank(message = "Vui lòng nhập số tài khoản")
    @Size(max = 50, message = "Số tài khoản tối đa 50 ký tự")
    private String accountNumber;

    @NotBlank(message = "Vui lòng nhập tên chủ tài khoản")
    @Size(max = 100, message = "Tên chủ tài khoản tối đa 100 ký tự")
    private String accountHolder;
}