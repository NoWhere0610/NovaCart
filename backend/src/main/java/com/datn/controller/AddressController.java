package com.datn.controller;

import com.datn.dto.address.AddressRequest;
import com.datn.dto.address.AddressResponse;
import com.datn.security.UserPrincipal;
import com.datn.service.AddressService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Toàn bộ endpoint dưới đây KHÔNG nằm trong PUBLIC_ENDPOINTS của SecurityConfig
 * -> bắt buộc phải có header "Authorization: Bearer <token>" hợp lệ mới gọi được.
 *
 * @AuthenticationPrincipal: Spring Security tự lấy user đang đăng nhập (được
 * JwtAuthFilter set vào SecurityContext) và bind thẳng vào tham số method,
 * không cần tự parse token thủ công ở đây.
 */
@RestController
@RequestMapping("/api/addresses")
@RequiredArgsConstructor
public class AddressController {

    private final AddressService addressService;

    @GetMapping
    public ResponseEntity<List<AddressResponse>> getMyAddresses(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(addressService.getMyAddresses(principal.getUserId()));
    }

    @PostMapping
    public ResponseEntity<AddressResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody AddressRequest request) {
        return ResponseEntity.ok(addressService.create(principal.getUserId(), request));
    }

    @PutMapping("/{addressId}")
    public ResponseEntity<AddressResponse> update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long addressId,
            @Valid @RequestBody AddressRequest request) {
        return ResponseEntity.ok(addressService.update(principal.getUserId(), addressId, request));
    }

    @DeleteMapping("/{addressId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long addressId) {
        addressService.delete(principal.getUserId(), addressId);
        return ResponseEntity.noContent().build();
    }
}