package com.datn.service;

import com.datn.dto.auth.AuthResponse;
import com.datn.dto.auth.LoginRequest;
import com.datn.dto.auth.RegisterRequest;
import com.datn.entity.Role;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.RoleRepository;
import com.datn.repository.UserRepository;
import com.datn.security.JwtService;
import com.datn.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {

    // Role mặc định gán cho mọi user đăng ký qua form công khai (không ai tự đăng ký thành ADMIN được)
    private static final String DEFAULT_ROLE = "CUSTOMER";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw ApiException.badRequest("Tên đăng nhập đã tồn tại");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw ApiException.badRequest("Email đã được sử dụng");
        }

        Role customerRole = roleRepository.findByRoleName(DEFAULT_ROLE)
                // Báo lỗi rõ ràng thay vì NullPointerException nếu role mặc định chưa có trong DB.
                .orElseThrow(() -> ApiException.notFound(
                        "Chưa cấu hình role mặc định '" + DEFAULT_ROLE + "' trong hệ thống"));

        User user = new User();
        user.setUsername(request.getUsername());
        // BẮT BUỘC hash password trước khi lưu DB - không bao giờ lưu plaintext
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        user.setPhone(request.getPhone());
        user.setIsActive(true);
        user.setRoles(Set.of(customerRole));

        User saved = userRepository.save(user);
        return buildAuthResponse(new UserPrincipal(saved));
    }

    public AuthResponse login(LoginRequest request) {
        // AuthenticationManager tự load user + so khớp password; sai thì ném BadCredentialsException -> GlobalExceptionHandler trả 401.
        var authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getUsernameOrEmail(), request.getPassword()));

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return buildAuthResponse(principal);
    }

    private AuthResponse buildAuthResponse(UserPrincipal principal) {
        String token = jwtService.generateToken(principal);
        return AuthResponse.builder()
                .accessToken(token)
                .userId(principal.getUserId())
                .username(principal.getUsername())
                .email(principal.getEmail())
                .fullName(principal.getFullName())
                .roles(List.copyOf(principal.getRoles()))
                .build();
    }
}