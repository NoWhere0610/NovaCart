package com.datn.controller;

import com.datn.dto.auth.AuthResponse;
import com.datn.dto.auth.ForgotPasswordRequest;
import com.datn.dto.auth.LoginRequest;
import com.datn.dto.auth.RegisterRequest;
import com.datn.dto.auth.ResetPasswordRequest;
import com.datn.service.AuthService;
import com.datn.service.PasswordResetService;

import java.util.Map;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * API công khai (đã khai báo trong SecurityConfig.PUBLIC_ENDPOINTS) cho
 * luồng đăng ký/đăng nhập. Controller chỉ làm nhiệm vụ nhận request -> gọi
 * Service -> trả response, KHÔNG chứa logic nghiệp vụ (đặt hết ở AuthService).
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        // Đăng ký xong trả luôn accessToken -> frontend có thể auto-login ngay,
        // không bắt user phải đăng ký xong rồi đăng nhập lại lần nữa
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /**
     * Xin link đặt lại mật khẩu.
     *
     * Luôn trả 200 kèm ĐÚNG MỘT câu như nhau, dù email có tài khoản hay không -- xem
     * {@link PasswordResetService}. Trả lời khác nhau sẽ biến endpoint công khai này thành công cụ dò
     * xem email nào đã đăng ký.
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(Map.of("message", passwordResetService.yeuCauDatLai(request.getEmail())));
    }

    /** Đặt mật khẩu mới bằng mã trong link đã gửi qua email. */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.datLaiMatKhau(request.getToken(), request.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới."));
    }
}