package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminInventoryAdjustRequest;
import com.datn.dto.admin.AdminInventoryCreateRequest;
import com.datn.dto.admin.AdminInventoryItemResponse;
import com.datn.dto.admin.AdminInventoryUpdateRequest;
import com.datn.service.AdminInventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Toàn bộ endpoint dưới /api/admin/** đã bị chặn ở SecurityConfig
 * (.requestMatchers("/api/admin/**").hasRole("ADMIN")) — chỉ user có role
 * ADMIN mới tới được đây. Vẫn thêm @PreAuthorize theo permission PRODUCT_* vì
 * endpoint này giờ chỉ phục vụ thao tác "sửa nhanh tồn kho" bên trong màn Sản phẩm
 * (AdminProductsPage) — cùng phạm vi quyền với AdminProductController.
 */
@RestController
@RequestMapping("/api/admin/inventory")
@RequiredArgsConstructor
public class AdminInventoryController {

    private final AdminInventoryService adminInventoryService;

    @PreAuthorize("@perm.has('PRODUCT_VIEW')")
    @GetMapping
    public ResponseEntity<PageResponse<AdminInventoryItemResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "false") boolean lowStockOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminInventoryService.list(keyword, lowStockOnly, page, size));
    }

    @PreAuthorize("@perm.has('PRODUCT_WRITE')")
    @PostMapping
    public ResponseEntity<AdminInventoryItemResponse> create(@Valid @RequestBody AdminInventoryCreateRequest request) {
        return ResponseEntity.ok(adminInventoryService.create(request));
    }

    @PreAuthorize("@perm.has('PRODUCT_WRITE')")
    @PutMapping("/{variantId}")
    public ResponseEntity<AdminInventoryItemResponse> update(
            @PathVariable Long variantId, @Valid @RequestBody AdminInventoryUpdateRequest request) {
        return ResponseEntity.ok(adminInventoryService.update(variantId, request));
    }

    // Nút +/- điều chỉnh nhanh tồn kho trong bảng sản phẩm -- gửi MỨC THAY ĐỔI, không gửi số tuyệt đối.
    @PreAuthorize("@perm.has('PRODUCT_WRITE')")
    @PatchMapping("/{variantId}/stock")
    public ResponseEntity<AdminInventoryItemResponse> adjustStock(
            @PathVariable Long variantId, @Valid @RequestBody AdminInventoryAdjustRequest request) {
        return ResponseEntity.ok(adminInventoryService.adjustStock(variantId, request.getDelta()));
    }

    @PreAuthorize("@perm.has('PRODUCT_DELETE')")
    @DeleteMapping("/{variantId}")
    public ResponseEntity<Void> delete(@PathVariable Long variantId) {
        adminInventoryService.delete(variantId);
        return ResponseEntity.noContent().build();
    }
}
