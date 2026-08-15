package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminOrderResponse;
import com.datn.dto.admin.UpdateOrderStatusRequest;
import com.datn.entity.Order;
import com.datn.service.AdminOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {

    private final AdminOrderService adminOrderService;

    @GetMapping
    @PreAuthorize("@perm.has('ORDER_VIEW')")
    public ResponseEntity<PageResponse<AdminOrderResponse>> list(
            @RequestParam(required = false) Order.Status status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminOrderService.list(status, page, size));
    }

    @GetMapping("/{orderId}")
    @PreAuthorize("@perm.has('ORDER_VIEW')")
    public ResponseEntity<AdminOrderResponse> getDetail(@PathVariable Long orderId) {
        return ResponseEntity.ok(adminOrderService.getDetail(orderId));
    }

    @PutMapping("/{orderId}/status")
    @PreAuthorize("@perm.has('ORDER_UPDATE_STATUS')")
    public ResponseEntity<AdminOrderResponse> updateStatus(
            @PathVariable Long orderId, @Valid @RequestBody UpdateOrderStatusRequest request) {
        return ResponseEntity.ok(adminOrderService.updateStatus(orderId, request.getStatus()));
    }
}