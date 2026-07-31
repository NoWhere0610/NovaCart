package com.datn.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Tính phí vận chuyển theo CÔNG THỨC CỐ ĐỊNH (không gọi API hãng vận chuyển
 * ngoài — GHN/GHTK...).
 *
 * Quy tắc:
 *  - Đơn hàng >= FREE_SHIP_THRESHOLD -> miễn phí ship
 *  - Giao nội thành Hà Nội (nơi đặt showroom) -> INNER_CITY_FEE
 *  - Giao các tỉnh/thành khác -> OUTER_CITY_FEE
 */
@Service
public class ShippingService {

    private static final BigDecimal INNER_CITY_FEE = BigDecimal.valueOf(20_000);
    private static final BigDecimal OUTER_CITY_FEE = BigDecimal.valueOf(35_000);
    private static final BigDecimal FREE_SHIP_THRESHOLD = BigDecimal.valueOf(1_000_000);

    public BigDecimal calculateFee(String province, BigDecimal subtotal) {
        if (subtotal != null && subtotal.compareTo(FREE_SHIP_THRESHOLD) >= 0) {
            return BigDecimal.ZERO;
        }
        if (isInnerHanoi(province)) {
            return INNER_CITY_FEE;
        }
        return OUTER_CITY_FEE;
    }

    private boolean isInnerHanoi(String province) {
        if (province == null) return false;
        String normalized = province.trim().toLowerCase();
        return normalized.contains("hà nội") || normalized.contains("ha noi");
    }
}