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

import static com.datn.security.JsonAuthResponses.writeJsonError;

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
            "/internal/**",
            // Ảnh sản phẩm admin upload (xem WebMvcConfig) -- chỉ đọc file tĩnh, khách chưa đăng nhập
            // vẫn phải xem được ảnh sản phẩm trên trang shop.
            "/uploads/**"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // API thuần REST dùng JWT -> không cần CSRF kiểu session/cookie.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Không dùng HttpSession -> mỗi request tự xác thực qua JWT (stateless, dễ scale).
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Mặc định Spring Security coi request KHÔNG có token là "ẩn danh" (vẫn tính là 1 kiểu đã
                // xác thực, chỉ thiếu quyền) -> hasRole()/hasAnyRole() thất bại sẽ trả 403 thay vì 401,
                // khiến frontend không phân biệt được "token hỏng/hết hạn" (nên tự đăng xuất) với "đã
                // đăng nhập nhưng đúng là không đủ quyền" (KHÔNG nên đăng xuất, chỉ cần báo không có quyền).
                // Tắt hẳn ẩn danh: request không có token hợp lệ -> KHÔNG có Authentication nào cả -> đúng
                // bản chất là AuthenticationException (401), không phải AccessDeniedException (403).
                .anonymous(anon -> anon.disable())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) ->
                                writeJsonError(response, 401, "Vui lòng đăng nhập để tiếp tục"))
                        .accessDeniedHandler((request, response, accessDeniedException) ->
                                writeJsonError(response, 403, "Bạn không có quyền thực hiện thao tác này")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        // Kho tồn hàng + Người dùng luôn CHỈ ADMIN, không qua ma trận STAFF (đặt TRƯỚC
                        // rule chung /api/admin/** bên dưới -- Spring Security khớp theo thứ tự, luật cụ
                        // thể hơn phải đứng trước).
                        .requestMatchers("/api/admin/inventory/**").hasRole("ADMIN")
                        .requestMatchers("/api/admin/users/**").hasRole("ADMIN")
                        // Phân quyền nhân viên: chỉ ADMIN được đổi ma trận -- STAFF không được tự cấp quyền
                        // cho chính mình dù có bật gì trong ma trận đi nữa.
                        .requestMatchers("/api/admin/permissions/**").hasRole("ADMIN")
                        // API admin còn lại: ADMIN hoặc STAFF đều qua được ở tầng route -- quyền THẬT theo
                        // từng hành động cụ thể do @PreAuthorize("@perm.has(...)") kiểm tra ở tầng method
                        // (xem PermissionService), dựa trên ma trận role_permission có thể chỉnh qua UI sau.
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "STAFF")
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