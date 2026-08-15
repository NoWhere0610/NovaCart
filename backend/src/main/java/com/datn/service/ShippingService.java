package com.datn.service;

import com.datn.entity.Address;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Tính phí vận chuyển theo khoảng cách thật (VietMapService.distanceKm) khi địa chỉ có toạ độ --
 * fallback về công thức cố định cũ (nội/ngoại thành Hà Nội theo tên tỉnh) khi:
 *  - Địa chỉ chưa có toạ độ (tạo trước khi có tính năng Autocomplete, hoặc khách tự gõ tay không qua
 *    gợi ý), hoặc
 *  - VietMap API lỗi/timeout -- KHÔNG được để lỗi gọi API bên ngoài chặn cả việc đặt hàng.
 *
 * Quy tắc chung: đơn hàng >= FREE_SHIP_THRESHOLD -> luôn miễn phí ship, bất kể khoảng cách.
 */
@Service
@RequiredArgsConstructor
public class ShippingService {

    private static final Logger log = LoggerFactory.getLogger(ShippingService.class);

    private final VietMapService vietMapService;

    private static final BigDecimal FREE_SHIP_THRESHOLD = BigDecimal.valueOf(1_000_000);

    // Công thức theo khoảng cách thật: BASE_FEE cho BASE_KM đầu, +PER_KM_FEE cho mỗi km vượt (làm tròn lên).
    private static final BigDecimal BASE_FEE = BigDecimal.valueOf(20_000);
    private static final BigDecimal BASE_KM = BigDecimal.valueOf(5);
    private static final BigDecimal PER_KM_FEE = BigDecimal.valueOf(3_000);

    // Fallback cũ khi không có toạ độ hoặc VietMap lỗi.
    private static final BigDecimal INNER_CITY_FEE = BigDecimal.valueOf(20_000);
    private static final BigDecimal OUTER_CITY_FEE = BigDecimal.valueOf(35_000);

    public BigDecimal calculateFee(Address address, BigDecimal subtotal) {
        if (subtotal != null && subtotal.compareTo(FREE_SHIP_THRESHOLD) >= 0) {
            return BigDecimal.ZERO;
        }

        if (address != null && address.getLatitude() != null && address.getLongitude() != null) {
            try {
                BigDecimal km = vietMapService.distanceKm(address.getLatitude(), address.getLongitude());
                if (km.compareTo(BASE_KM) <= 0) {
                    return BASE_FEE;
                }
                BigDecimal extraKm = km.subtract(BASE_KM).setScale(0, RoundingMode.UP);
                return BASE_FEE.add(extraKm.multiply(PER_KM_FEE));
            } catch (Exception e) {
                log.warn("VietMap distanceKm lỗi, fallback về công thức cố định: {}", e.getMessage());
            }
        }

        return isInnerHanoi(address != null ? address.getProvince() : null) ? INNER_CITY_FEE : OUTER_CITY_FEE;
    }

    private boolean isInnerHanoi(String province) {
        if (province == null) return false;
        String normalized = province.trim().toLowerCase();
        return normalized.contains("hà nội") || normalized.contains("ha noi");
    }
}