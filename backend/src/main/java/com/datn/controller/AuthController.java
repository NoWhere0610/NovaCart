package com.datn.controller;

import com.datn.dto.auth.AuthResponse;
import com.datn.dto.auth.LoginRequest;
import com.datn.dto.auth.RegisterRequest;
import com.datn.service.AuthService;
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
}