package com.datn.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * Đọc cấu hình app.jwt.* từ application.properties bằng cơ chế Binder
 * (@ConfigurationProperties) thay vì @Value("${...}") trên constructor.
 *
 * Lý do đổi: với Spring Boot 4.0.6, @Value trên constructor param của
 * @Service bị lỗi "Could not resolve placeholder" dù property tồn tại
 * đúng trong application.properties (đã verify kỹ). server.port đọc được
 * bình thường vì Spring Boot bind nó qua Binder/Environment - not qua
 * PropertySourcesPlaceholderConfigurer như @Value. Dùng @ConfigurationProperties
 * đi chung "con đường" với server.port -> né được vấn đề.
 *
 * Yêu cầu: thêm @ConfigurationPropertiesScan (hoặc @EnableConfigurationProperties)
 * vào BackendApplication.java - xem hướng dẫn kèm theo.
 */
@Validated
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    /** Secret dùng ký token (HS256, tối thiểu 256 bit / 32 ký tự). */
    @NotBlank
    private String secret;

    /** Thời gian sống của access token, tính bằng millisecond. */
    @Positive
    private long expirationMs;

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    public void setExpirationMs(long expirationMs) {
        this.expirationMs = expirationMs;
    }
}
