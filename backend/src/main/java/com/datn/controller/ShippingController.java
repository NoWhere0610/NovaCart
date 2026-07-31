package com.datn.controller;

import com.datn.service.ShippingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/shipping")
@RequiredArgsConstructor
public class ShippingController {

    private final ShippingService shippingService;

    @GetMapping("/fee")
    public ResponseEntity<Map<String, BigDecimal>> getFee(
            @RequestParam String province,
            @RequestParam(defaultValue = "0") BigDecimal subtotal) {
        BigDecimal fee = shippingService.calculateFee(province, subtotal);
        return ResponseEntity.ok(Map.of("shippingFee", fee));
    }
}