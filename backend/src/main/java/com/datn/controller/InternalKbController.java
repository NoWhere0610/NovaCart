package com.datn.controller;

import com.datn.dto.chatbot.InternalProductDto;
import com.datn.exception.ApiException;
import com.datn.service.InternalKbService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * API nội bộ (server-to-server), không dùng JWT khách hàng -- chatbot kit gọi mỗi ngày để
 * đồng bộ sản phẩm vào kho tri thức RAG. Public trong SecurityConfig nhưng tự verify
 * header "X-Internal-Secret" ở đây.
 */
@RestController
@RequestMapping("/internal/kb")
@RequiredArgsConstructor
public class InternalKbController {

    private final InternalKbService internalKbService;

    @Value("${novacart.internal-secret}")
    private String internalSecret;

    @GetMapping("/products")
    public List<InternalProductDto> getProducts(@RequestHeader(value = "X-Internal-Secret", required = false) String secret) {
        if (internalSecret == null || internalSecret.isBlank()) {
            throw ApiException.unauthorized("Server chưa cấu hình novacart.internal-secret.");
        }
        // MessageDigest.isEqual thay vì String.equals -> so sánh constant-time, tránh lộ qua timing side-channel.
        if (secret == null || !MessageDigest.isEqual(
                internalSecret.getBytes(StandardCharsets.UTF_8), secret.getBytes(StandardCharsets.UTF_8))) {
            throw ApiException.unauthorized("Thiếu hoặc sai X-Internal-Secret.");
        }
        return internalKbService.getProductsForKb();
    }
}
