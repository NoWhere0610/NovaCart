package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.pos.PosDto;
import com.datn.security.UserPrincipal;
import com.datn.service.PosOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Bán hàng tại quầy (POS). Nằm dưới /api/admin/** nên ADMIN hoặc STAFF đều qua được tầng route (xem
 * SecurityConfig) -- toàn bộ thao tác POS gộp chung 1 quyền POS_USE (không tách nhỏ hơn vì "được thêm
 * sản phẩm nhưng không được thanh toán" không có ý nghĩa nghiệp vụ thực tế).
 */
@RestController
@RequestMapping("/api/admin/pos")
@RequiredArgsConstructor
@PreAuthorize("@perm.has('POS_USE')")
public class AdminPosController {

    private final PosOrderService posOrderService;

    @PostMapping("/invoices")
    public ResponseEntity<PosDto.InvoiceResponse> createInvoice(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(posOrderService.createInvoice(principal.getUserId()));
    }

    @GetMapping("/invoices")
    public ResponseEntity<PageResponse<PosDto.InvoiceResponse>> listPendingInvoices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(posOrderService.listPendingInvoices(page, size));
    }

    @GetMapping("/invoices/{orderId}")
    public ResponseEntity<PosDto.InvoiceResponse> getInvoice(@PathVariable Long orderId) {
        return ResponseEntity.ok(posOrderService.getInvoice(orderId));
    }

    @PostMapping("/invoices/{orderId}/items")
    public ResponseEntity<PosDto.InvoiceResponse> addItem(
            @PathVariable Long orderId, @Valid @RequestBody PosDto.AddItemRequest request) {
        return ResponseEntity.ok(posOrderService.addItem(orderId, request));
    }

    @PutMapping("/invoices/{orderId}/items/{orderItemId}")
    public ResponseEntity<PosDto.InvoiceResponse> updateItemQuantity(
            @PathVariable Long orderId, @PathVariable Long orderItemId,
            @Valid @RequestBody PosDto.UpdateItemQuantityRequest request) {
        return ResponseEntity.ok(posOrderService.updateItemQuantity(orderId, orderItemId, request));
    }

    @DeleteMapping("/invoices/{orderId}/items/{orderItemId}")
    public ResponseEntity<PosDto.InvoiceResponse> removeItem(
            @PathVariable Long orderId, @PathVariable Long orderItemId) {
        return ResponseEntity.ok(posOrderService.removeItem(orderId, orderItemId));
    }

    @PostMapping("/invoices/{orderId}/voucher")
    public ResponseEntity<PosDto.InvoiceResponse> applyVoucher(
            @PathVariable Long orderId, @Valid @RequestBody PosDto.VoucherRequest request) {
        return ResponseEntity.ok(posOrderService.applyVoucher(orderId, request));
    }

    @DeleteMapping("/invoices/{orderId}/voucher")
    public ResponseEntity<PosDto.InvoiceResponse> removeVoucher(@PathVariable Long orderId) {
        return ResponseEntity.ok(posOrderService.removeVoucher(orderId));
    }

    @PostMapping("/invoices/{orderId}/checkout")
    public ResponseEntity<PosDto.InvoiceResponse> checkout(
            @PathVariable Long orderId, @Valid @RequestBody PosDto.CheckoutRequest request) {
        return ResponseEntity.ok(posOrderService.checkout(orderId, request));
    }

    @DeleteMapping("/invoices/{orderId}")
    public ResponseEntity<Void> cancelInvoice(@PathVariable Long orderId) {
        posOrderService.cancelInvoice(orderId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/invoices/{orderId}/void")
    public ResponseEntity<PosDto.InvoiceResponse> voidCompletedInvoice(@PathVariable Long orderId) {
        return ResponseEntity.ok(posOrderService.voidCompletedInvoice(orderId));
    }

    @PatchMapping("/invoices/{orderId}/confirm-payment")
    public ResponseEntity<PosDto.InvoiceResponse> confirmPayment(@PathVariable Long orderId) {
        return ResponseEntity.ok(posOrderService.confirmPayment(orderId));
    }
}