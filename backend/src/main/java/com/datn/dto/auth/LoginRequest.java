package com.datn.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/** Body của POST /api/auth/login. usernameOrEmail cho phép nhập 1 trong 2. */
@Getter
@Setter
public class LoginRequest {

    @NotBlank(message = "Vui lòng nhập tên đăng nhập hoặc email")
    private String usernameOrEmail;

    @NotBlank(message = "Vui lòng nhập mật khẩu")
    private String password;
}