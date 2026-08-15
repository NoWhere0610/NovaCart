package com.datn.controller;

import com.datn.dto.maps.VietMapDto;
import com.datn.service.VietMapService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Proxy sang VietMap Maps API -- KHÔNG lộ apikey ra frontend (khác Google Maps Platform vốn phải để
 * key gọi thẳng từ browser). Không nằm trong PUBLIC_ENDPOINTS nên vẫn bắt buộc đăng nhập, khớp các
 * API khác của khách hàng (địa chỉ chỉ dùng lúc đã đăng nhập).
 */
@RestController
@RequestMapping("/api/maps")
@RequiredArgsConstructor
public class MapsController {

    private final VietMapService vietMapService;

    @GetMapping("/autocomplete")
    public ResponseEntity<List<VietMapDto.Suggestion>> autocomplete(@RequestParam String text) {
        return ResponseEntity.ok(vietMapService.autocomplete(text));
    }

    @GetMapping("/place")
    public ResponseEntity<VietMapDto.PlaceDetail> place(@RequestParam String refId) {
        return ResponseEntity.ok(vietMapService.placeDetail(refId));
    }

    @GetMapping("/reverse")
    public ResponseEntity<VietMapDto.PlaceDetail> reverse(
            @RequestParam double lat, @RequestParam double lng) {
        return ResponseEntity.ok(vietMapService.reverseGeocode(lat, lng));
    }
}
