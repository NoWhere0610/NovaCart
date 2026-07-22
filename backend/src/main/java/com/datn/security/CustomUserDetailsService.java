package com.datn.security;

import com.datn.entity.User;
import com.datn.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Được Spring Security gọi tự động mỗi khi cần xác thực 1 định danh
 * (login form, hoặc khi JwtAuthFilter cần load lại thông tin user từ username
 * lấy được trong token) -> trả về UserDetails tương ứng.
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String usernameOrEmail) throws UsernameNotFoundException {
        // Cho phép đăng nhập bằng username HOẶC email, tuỳ cái nào khớp trước
        User user = userRepository.findByUsername(usernameOrEmail)
                .or(() -> userRepository.findByEmail(usernameOrEmail))
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Không tìm thấy tài khoản: " + usernameOrEmail));
        return new UserPrincipal(user);
    }
}