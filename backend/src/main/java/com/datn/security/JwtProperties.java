package com.datn.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * Đọc app.jwt.* bằng @ConfigurationProperties thay vì @Value trên constructor --
 * @Value bị lỗi "Could not resolve placeholder" ở Spring Boot 4.0.6 dù property tồn tại đúng.
 * Yêu cầu @ConfigurationPropertiesScan (hoặc @EnableConfigurationProperties) trong BackendApplication.java.
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
