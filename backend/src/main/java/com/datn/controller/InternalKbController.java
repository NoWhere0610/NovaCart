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
 * API NỘI BỘ (server-to-server), KHÔNG dùng JWT khách hàng -- chỉ chatbot kit
 * (Node.js, "D:/My Tech/Chatbot/lib/productSync.js") gọi vào mỗi ngày để đồng
 * bộ danh mục sản phẩm vào kho tri thức RAG. Public trong SecurityConfig
 * ("/internal/**") nhưng tự verify header "X-Internal-Secret" ở đây -- đúng
 * tinh thần middleware requireApiKey phía kit (xem middleware/apiKeyAuth.js
 * bên đó), chỉ khác chiều gọi.
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
        // MessageDigest.isEqual thay vì String.equals -> so sánh constant-time, tránh lộ độ dài/vị trí
        // ký tự đúng qua thời gian phản hồi (timing side-channel) cho 1 secret gọi server-to-server.
        if (secret == null || !MessageDigest.isEqual(
                internalSecret.getBytes(StandardCharsets.UTF_8), secret.getBytes(StandardCharsets.UTF_8))) {
            throw ApiException.unauthorized("Thiếu hoặc sai X-Internal-Secret.");
        }
        return internalKbService.getProductsForKb();
    }
}
