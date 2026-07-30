package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminInventoryCreateRequest;
import com.datn.dto.admin.AdminInventoryItemResponse;
import com.datn.dto.admin.AdminInventoryUpdateRequest;
import com.datn.service.AdminInventoryService;
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
@RequestMapping("/api/admin/inventory")
@RequiredArgsConstructor
public class AdminInventoryController {

    private final AdminInventoryService adminInventoryService;

    @GetMapping
    public ResponseEntity<PageResponse<AdminInventoryItemResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "false") boolean lowStockOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminInventoryService.list(keyword, lowStockOnly, page, size));
    }

    @PostMapping
    public ResponseEntity<AdminInventoryItemResponse> create(@Valid @RequestBody AdminInventoryCreateRequest request) {
        return ResponseEntity.ok(adminInventoryService.create(request));
    }

    @PutMapping("/{variantId}")
    public ResponseEntity<AdminInventoryItemResponse> update(
            @PathVariable Long variantId, @Valid @RequestBody AdminInventoryUpdateRequest request) {
        return ResponseEntity.ok(adminInventoryService.update(variantId, request));
    }

    @DeleteMapping("/{variantId}")
    public ResponseEntity<Void> delete(@PathVariable Long variantId) {
        adminInventoryService.delete(variantId);
        return ResponseEntity.noContent().build();
    }
}
