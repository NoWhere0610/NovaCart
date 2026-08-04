package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.ProductResponse;
import com.datn.security.UserPrincipal;
import com.datn.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    // Danh sách riêng chỉ productId -- FE dùng tô đậm icon trái tim mà không cần tải cả object Product.
    @GetMapping("/product-ids")
    public List<Long> getProductIds(@AuthenticationPrincipal UserPrincipal principal) {
        return wishlistService.getProductIds(principal.getUserId());
    }

    @GetMapping
    public PageResponse<ProductResponse> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return wishlistService.list(principal.getUserId(), pageable);
    }

    @PostMapping("/{productId}")
    public void add(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long productId) {
        wishlistService.add(principal.getUserId(), productId);
    }

    @DeleteMapping("/{productId}")
    public void remove(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long productId) {
        wishlistService.remove(principal.getUserId(), productId);
    }
}
