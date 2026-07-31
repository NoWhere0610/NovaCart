package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.order.CheckoutRequest;
import com.datn.dto.order.OrderResponse;
import com.datn.dto.order.RequestReturnRequest;
import com.datn.security.UserPrincipal;
import com.datn.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/checkout")
    public ResponseEntity<OrderResponse> checkout(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CheckoutRequest request) {
        return ResponseEntity.ok(orderService.checkout(principal.getUserId(), request));
    }

    @GetMapping
    public ResponseEntity<PageResponse<OrderResponse>> getMyOrders(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(orderService.getMyOrders(principal.getUserId(), page, size));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderResponse> getMyOrderDetail(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.getMyOrderDetail(principal.getUserId(), orderId));
    }

    @GetMapping("/{orderId}/vnpay-url")
    public ResponseEntity<java.util.Map<String, String>> getVnpayUrl(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long orderId,
            jakarta.servlet.http.HttpServletRequest request) {
        String url = orderService.getVnpayPaymentUrl(principal.getUserId(), orderId, request);
        return ResponseEntity.ok(java.util.Map.of("paymentUrl", url));
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<OrderResponse> cancelOrder(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.cancelMyOrder(principal.getUserId(), orderId));
    }

    /** Khách bấm "Hoàn thành" ở tab Cần đánh giá: DELIVERED -> COMPLETED. */
    @PostMapping("/{orderId}/complete")
    public ResponseEntity<OrderResponse> completeOrder(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.completeMyOrder(principal.getUserId(), orderId));
    }

    /** Khách bấm "Yêu cầu trả hàng/hoàn tiền": DELIVERED/COMPLETED -> RETURN_REQUESTED. */
    @PostMapping("/{orderId}/request-return")
    public ResponseEntity<OrderResponse> requestReturn(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long orderId,
            @Valid @RequestBody RequestReturnRequest request) {
        return ResponseEntity.ok(orderService.requestReturn(principal.getUserId(), orderId, request));
    }
}