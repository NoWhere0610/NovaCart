package com.datn.controller;

import com.datn.dto.cart.AddToCartRequest;
import com.datn.dto.cart.CartResponse;
import com.datn.dto.cart.UpdateCartItemRequest;
import com.datn.security.UserPrincipal;
import com.datn.service.CartService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Toàn bộ endpoint yêu cầu đăng nhập (không nằm trong PUBLIC_ENDPOINTS). */
@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public ResponseEntity<CartResponse> getMyCart(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(cartService.getMyCart(principal.getUserId()));
    }

    @PostMapping("/items")
    public ResponseEntity<CartResponse> addItem(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody AddToCartRequest request) {
        return ResponseEntity.ok(cartService.addItem(principal.getUserId(), request));
    }

    @PutMapping("/items/{cartItemId}")
    public ResponseEntity<CartResponse> updateItem(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long cartItemId,
            @Valid @RequestBody UpdateCartItemRequest request) {
        return ResponseEntity.ok(
                cartService.updateItemQuantity(principal.getUserId(), cartItemId, request.getQuantity()));
    }

    @DeleteMapping("/items/{cartItemId}")
    public ResponseEntity<CartResponse> removeItem(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long cartItemId) {
        return ResponseEntity.ok(cartService.removeItem(principal.getUserId(), cartItemId));
    }
}