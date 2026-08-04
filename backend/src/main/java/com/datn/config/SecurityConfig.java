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
 * Cấu hình trung tâm Spring Security. Thay CorsConfig cũ (đã xoá) vì CORS phải khai báo
 * trong SecurityFilterChain, nếu không preflight (OPTIONS) sẽ bị chặn trước khi tới CorsConfig.
 */
@Configuration
@EnableWebSecurity
// Cho phép @PreAuthorize("hasRole(...)") trên method của Controller/Service
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    /** Danh sách API không cần đăng nhập (đăng ký, đăng nhập, trang chủ/sản phẩm...). */
     private static final String[] PUBLIC_ENDPOINTS = {
            "/api/auth/**",
            "/api/home/**",
            // VNPay redirect thẳng trình duyệt khách về đây nên phải public; an toàn nhờ
            // OrderService.handleVnpayReturn() luôn verify chữ ký HMAC-SHA512 trước khi tin tham số.
            "/api/vnpay/**",
            // Gọi server-to-server từ chatbot kit, không có JWT khách hàng; an toàn nhờ
            // InternalKbController tự verify header "X-Internal-Secret" trước khi trả dữ liệu.
            "/internal/**"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // API thuần REST dùng JWT -> không cần CSRF kiểu session/cookie.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Không dùng HttpSession -> mỗi request tự xác thực qua JWT (stateless, dễ scale).
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        // API quản trị chỉ role ADMIN được gọi -- kiểm tra ngay ở tầng route.
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                // Chèn filter đọc JWT vào TRƯỚC filter login-form mặc định của Spring Security
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /** Mã hoá mật khẩu 1 chiều bằng BCrypt. */
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

    /** Cấu hình CORS: chỉ cho phép frontend ở localhost:5173 gọi API. */
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