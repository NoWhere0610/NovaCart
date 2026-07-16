package com.datn.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;
import java.util.function.Function;

/**
 * Đóng gói toàn bộ logic liên quan tới JWT: tạo token khi login thành công,
 * và verify/đọc thông tin từ token khi client gọi API kèm header
 * "Authorization: Bearer <token>".
 */
@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms}") long expirationMs) {
        // HS256 yêu cầu key tối thiểu 256 bit -> secret trong application.properties
        // phải đủ dài, nếu không sẽ ném exception ngay lúc khởi động app (fail-fast, tốt hơn lỗi ngầm lúc runtime)
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = expirationMs;
    }

    /** Sinh access token chứa username (subject) + danh sách role (custom claim). */
    public String generateToken(UserPrincipal principal) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(principal.getUsername())
                .claim("userId", principal.getUserId())
                .claim("roles", principal.getRoles())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    @SuppressWarnings("unchecked")
    public List<String> extractRoles(String token) {
        return extractClaim(token, claims -> (List<String>) claims.get("roles"));
    }

    /** Token hợp lệ = chữ ký đúng, chưa hết hạn, và username khớp với user đang xét. */
    public boolean isTokenValid(String token, String expectedUsername) {
        try {
            String usernameInToken = extractUsername(token);
            return usernameInToken.equals(expectedUsername) && !isExpired(token);
        } catch (JwtException | IllegalArgumentException e) {
            // Token sai định dạng / sai chữ ký / hết hạn... đều coi là không hợp lệ,
            // không để lộ chi tiết lỗi ra ngoài (tránh lộ thông tin cho kẻ tấn công)
            return false;
        }
    }

    private boolean isExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return resolver.apply(claims);
    }
}