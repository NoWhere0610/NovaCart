package com.datn.config;

import com.datn.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Cấu hình trung tâm của Spring Security cho toàn bộ backend.
 * Thay thế hoàn toàn CorsConfig cũ (đã xoá) vì khi có Security, CORS phải
 * được khai báo NGAY TRONG SecurityFilterChain, nếu không request preflight
 * (OPTIONS) sẽ bị Security chặn trước khi tới được CorsConfig kiểu cũ.
 */
@Configuration
@EnableWebSecurity
// Cho phép dùng @PreAuthorize("hasRole('ADMIN')") ngay trên method của
// Controller/Service
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    /**
     * Danh sách API KHÔNG cần đăng nhập (đăng ký, đăng nhập, xem trang chủ/sản
     * phẩm...).
     */
    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/auth/**",
            "/api/home/**"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // API thuần REST dùng JWT -> không cần bảo vệ CSRF kiểu session/cookie truyền
                // thống
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Không dùng HttpSession để lưu trạng thái đăng nhập -> mỗi request tự chứng
                // minh
                // danh tính qua JWT (stateless, đúng chuẩn REST, dễ scale nhiều instance
                // backend)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        // Toàn bộ API quản trị (CRUD sản phẩm, quản lý đơn hàng, quản lý user)
                        // CHỈ user có role ADMIN mới gọi được — kiểm tra ngay ở tầng route,
                        // trước khi request kịp chạm vào Controller/Service
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                // Chèn filter đọc JWT vào TRƯỚC filter login-form mặc định của Spring Security
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Mã hoá mật khẩu 1 chiều bằng BCrypt (đúng như comment sẵn trong entity User).
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Provider nối UserDetailsService (đọc DB) với PasswordEncoder (so khớp hash)
     * khi login.
     */
    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    /** Bean trung tâm để AuthController gọi khi xử lý POST /api/auth/login. */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * Cấu hình CORS y hệt CorsConfig cũ: chỉ cho phép frontend chạy ở
     * localhost:5173 gọi API.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}