package com.datn.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** Body của POST /api/auth/reset-password. */
@Getter
@Setter
public class ResetPasswordRequest {

    @NotBlank(message = "Thiếu mã đặt lại mật khẩu")
    private String token;

    // Giữ đúng ràng buộc như lúc đăng ký (RegisterRequest) -- không được có đường vòng nào đặt được mật
    // khẩu yếu hơn mức tối thiểu.
    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
    private String newPassword;
}
