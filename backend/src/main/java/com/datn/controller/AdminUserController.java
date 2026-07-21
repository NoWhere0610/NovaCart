package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminUserResponse;
import com.datn.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public ResponseEntity<PageResponse<AdminUserResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminUserService.list(page, size));
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