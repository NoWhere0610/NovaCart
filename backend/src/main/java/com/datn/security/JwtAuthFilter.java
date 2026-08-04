package com.datn.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Chạy 1 lần mỗi request, trước Controller: đọc JWT từ header Authorization,
 * hợp lệ thì set Authentication vào SecurityContext; không có/sai thì bỏ qua, coi như ẩn danh.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String HEADER_NAME = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader(HEADER_NAME);

        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        // Lỗi giải mã token (hết hạn, sai chữ ký, user không còn tồn tại...) chỉ coi là chưa đăng nhập,
        // không được ném lỗi -- nếu không sẽ chặn nhầm cả API public (lỗi xảy ra trước bước permitAll).
        try {
            String username = jwtService.extractUsername(token);

            // Chỉ xử lý nếu đọc được username và request chưa được xác thực trước đó.
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                // isEnabled() đọc is_active hiện tại trong DB -> tài khoản bị khoá mất quyền truy cập
                // ngay, không cần chờ token hết hạn.
                if (jwtService.isTokenValid(token, userDetails.getUsername()) && userDetails.isEnabled()) {
                    var authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (Exception ex) {
            // Token hỏng / user không tồn tại -> bỏ qua, coi như ẩn danh.
        }

        filterChain.doFilter(request, response);
    }
}