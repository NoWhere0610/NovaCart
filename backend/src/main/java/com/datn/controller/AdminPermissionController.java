package com.datn.controller;

import com.datn.dto.admin.AdminPermissionDto;
import com.datn.service.AdminPermissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Trang "Phân quyền nhân viên" -- chỉ ADMIN vào được (khoá cứng ở SecurityConfig cùng nhóm với Kho tồn
 * hàng/Người dùng, không qua ma trận STAFF -- STAFF không thể tự cấp quyền cho chính mình).
 */
@RestController
@RequestMapping("/api/admin/permissions")
@RequiredArgsConstructor
public class AdminPermissionController {

    private final AdminPermissionService adminPermissionService;

    @GetMapping("/staff")
    public ResponseEntity<List<AdminPermissionDto.Item>> getStaffMatrix() {
        return ResponseEntity.ok(adminPermissionService.getStaffMatrix());
    }

    @PutMapping("/staff")
    public ResponseEntity<List<AdminPermissionDto.Item>> updateStaffMatrix(
            @Valid @RequestBody AdminPermissionDto.UpdateRequest request) {
        return ResponseEntity.ok(adminPermissionService.updateStaffMatrix(request.getPermissions()));
    }
}
