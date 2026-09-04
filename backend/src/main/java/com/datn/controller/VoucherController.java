package com.datn.controller;

import com.datn.security.UserPrincipal;
import com.datn.service.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Endpoint riêng cho khách xem trước số tiền giảm TRƯỚC khi đặt hàng (trang checkout) --
 * không nằm trong PUBLIC_ENDPOINTS nên vẫn bắt buộc đăng nhập, khớp các API khác của khách hàng.
 */
@RestController
@RequestMapping("/api/vouchers")
@RequiredArgsConstructor
public class VoucherController {

    private final VoucherService voucherService;

    @GetMapping("/preview")
    public ResponseEntity<Map<String, BigDecimal>> preview(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam String code, @RequestParam BigDecimal subtotal) {
        // Truyền userId để bước xem trước cũng bắt được "mã này bạn dùng rồi" -- để tới lúc bấm
        // "Đặt hàng" mới báo thì khách đã nhìn một tổng tiền không có thật suốt cả màn thanh toán.
        BigDecimal discount = voucherService.previewDiscount(code, subtotal, principal.getUserId());
        return ResponseEntity.ok(Map.of("discountAmount", discount));
    }
}
