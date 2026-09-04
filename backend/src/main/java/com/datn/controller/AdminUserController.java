package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminUserResponse;
import com.datn.dto.admin.UpdateUserRoleRequest;
import jakarta.validation.Valid;
import com.datn.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    /** keyword khớp cả email LẪN tên đăng nhập -- xem UserRepository.timTheoEmailHoacUsername. */
    @GetMapping
    public ResponseEntity<PageResponse<AdminUserResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(adminUserService.list(page, size, keyword));
    }

    /**
     * Đổi vai trò một tài khoản (ADMIN / STAFF / CUSTOMER).
     *
     * Trước đây muốn tạo nhân viên phải chạy INSERT tay vào bảng user_roles -- việc đó không ai ngoài
     * người viết mã làm được, và tài liệu demo phải hướng dẫn mở SQL Server Management Studio.
     */
    @PutMapping("/{userId}/role")
    public ResponseEntity<AdminUserResponse> doiVaiTro(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateUserRoleRequest request) {
        return ResponseEntity.ok(adminUserService.doiVaiTro(userId, request.getRoleName()));
    }

    @PutMapping("/{userId}/lock")
    public ResponseEntity<AdminUserResponse> lock(@PathVariable Long userId) {
        return ResponseEntity.ok(adminUserService.setActive(userId, false));
    }

    @PutMapping("/{userId}/unlock")
    public ResponseEntity<AdminUserResponse> unlock(@PathVariable Long userId) {
        return ResponseEntity.ok(adminUserService.setActive(userId, true));
    }
}