package com.datn.controller;

import com.datn.service.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
            @RequestParam String code, @RequestParam BigDecimal subtotal) {
        BigDecimal discount = voucherService.previewDiscount(code, subtotal);
        return ResponseEntity.ok(Map.of("discountAmount", discount));
    }
}
