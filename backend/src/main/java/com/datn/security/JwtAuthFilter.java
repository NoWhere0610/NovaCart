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
 * Chạy 1 lần cho MỖI request (OncePerRequestFilter) trước khi request đi vào
 * Controller. Nhiệm vụ:
 *  1. Lấy token từ header "Authorization: Bearer <token>".
 *  2. Nếu token hợp lệ -> load user tương ứng và "đăng nhập" user đó vào
 *     SecurityContext của request hiện tại (để @PreAuthorize, hasRole()... hoạt động).
 *  3. Nếu không có token / token sai -> để trống, request đi tiếp như 1 người
 *     dùng ẩn danh (SecurityConfig sẽ quyết định endpoint đó có cần login hay không).
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
        String username = jwtService.extractUsername(token);

        // Chỉ xử lý nếu: đọc được username từ token VÀ request này chưa được xác thực trước đó
        // (tránh ghi đè lên context nếu đã có filter khác xử lý)
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);

            if (jwtService.isTokenValid(token, userDetails.getUsername())) {
                var authToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}