package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminProductRequest;
import com.datn.dto.admin.AdminProductResponse;
import com.datn.service.AdminProductService;
import com.datn.service.FileStorageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Toàn bộ endpoint dưới /api/admin/** đã bị chặn ở SecurityConfig (ADMIN hoặc STAFF mới qua được tầng
 * route) -- quyền THẬT theo từng hành động cụ thể (xem/sửa/xoá) do @PreAuthorize bên dưới quyết định,
 * dựa trên ma trận role_permission (xem PermissionService).
 */
@RestController
@RequestMapping("/api/admin/products")
@RequiredArgsConstructor
public class AdminProductController {

    private final AdminProductService adminProductService;
    private final FileStorageService fileStorageService;

    @PostMapping("/upload-image")
    @PreAuthorize("@perm.has('PRODUCT_WRITE')")
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        String url = fileStorageService.storeProductImage(file);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @GetMapping
    @PreAuthorize("@perm.has('PRODUCT_VIEW')")
    public ResponseEntity<PageResponse<AdminProductResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "false") boolean lowStockOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminProductService.list(keyword, lowStockOnly, page, size));
    }

    @GetMapping("/{productId}")
    @PreAuthorize("@perm.has('PRODUCT_VIEW')")
    public ResponseEntity<AdminProductResponse> getDetail(@PathVariable Long productId) {
        return ResponseEntity.ok(adminProductService.getDetail(productId));
    }

    @PostMapping
    @PreAuthorize("@perm.has('PRODUCT_WRITE')")
    public ResponseEntity<AdminProductResponse> create(@Valid @RequestBody AdminProductRequest request) {
        return ResponseEntity.ok(adminProductService.create(request));
    }

    @PutMapping("/{productId}")
    @PreAuthorize("@perm.has('PRODUCT_WRITE')")
    public ResponseEntity<AdminProductResponse> update(
            @PathVariable Long productId, @Valid @RequestBody AdminProductRequest request) {
        return ResponseEntity.ok(adminProductService.update(productId, request));
    }

    @DeleteMapping("/{productId}")
    @PreAuthorize("@perm.has('PRODUCT_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long productId) {
        adminProductService.delete(productId);
        return ResponseEntity.noContent().build();
    }
}