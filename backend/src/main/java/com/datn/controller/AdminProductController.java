package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminProductRequest;
import com.datn.dto.admin.AdminProductResponse;
import com.datn.service.AdminProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Toàn bộ endpoint dưới /api/admin/** đã bị chặn ở SecurityConfig
 * (.requestMatchers("/api/admin/**").hasRole("ADMIN")) — chỉ user có role
 * ADMIN mới tới được đây, không cần check lại thủ công trong Controller.
 */
@RestController
@RequestMapping("/api/admin/products")
@RequiredArgsConstructor
public class AdminProductController {

    private final AdminProductService adminProductService;

    @GetMapping
    public ResponseEntity<PageResponse<AdminProductResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminProductService.list(keyword, page, size));
    }

    @GetMapping("/{productId}")
    public ResponseEntity<AdminProductResponse> getDetail(@PathVariable Long productId) {
        return ResponseEntity.ok(adminProductService.getDetail(productId));
    }

    @PostMapping
    public ResponseEntity<AdminProductResponse> create(@Valid @RequestBody AdminProductRequest request) {
        return ResponseEntity.ok(adminProductService.create(request));
    }

    @PutMapping("/{productId}")
    public ResponseEntity<AdminProductResponse> update(
            @PathVariable Long productId, @Valid @RequestBody AdminProductRequest request) {
        return ResponseEntity.ok(adminProductService.update(productId, request));
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<Void> delete(@PathVariable Long productId) {
        adminProductService.delete(productId);
        return ResponseEntity.noContent().build();
    }
}