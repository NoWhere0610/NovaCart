package com.datn.controller;

import com.datn.entity.Address;
import com.datn.security.UserPrincipal;
import com.datn.service.AddressService;
import com.datn.service.ShippingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/shipping")
@RequiredArgsConstructor
public class ShippingController {

    private final ShippingService shippingService;
    private final AddressService addressService;

    // Nhận addressId thay vì tự truyền tay province -- backend tự lấy đúng toạ độ (nếu có) của địa
    // chỉ đó để tính phí theo khoảng cách thật (xem ShippingService), đồng thời chặn xem phí ship
    // của địa chỉ người khác (getOwnedAddress kiểm tra quyền sở hữu).
    @GetMapping("/fee")
    public ResponseEntity<Map<String, BigDecimal>> getFee(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam Long addressId,
            @RequestParam(defaultValue = "0") BigDecimal subtotal) {
        Address address = addressService.getOwnedAddress(principal.getUserId(), addressId);
        BigDecimal fee = shippingService.calculateFee(address, subtotal);
        return ResponseEntity.ok(Map.of("shippingFee", fee));
    }
}