package com.datn.service;

import com.datn.dto.user.ChangePasswordRequest;
import com.datn.dto.user.ProfileResponse;
import com.datn.dto.user.UpdateProfileRequest;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.PasswordResetTokenRepository;
import com.datn.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Hồ sơ của chính người đang đăng nhập (/api/users/me).
 *
 * Mọi phương thức đều nhận userId lấy từ token đã xác thực chứ không nhận từ body request -- người dùng
 * không có cách nào chỉ định mình muốn sửa hồ sơ của ai.
 */
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public ProfileResponse getMyProfile(Long userId) {
        return toResponse(layUser(userId));
    }

    @Transactional
    public ProfileResponse updateMyProfile(Long userId, UpdateProfileRequest request) {
        User user = layUser(userId);
        user.setFullName(request.getFullName().trim());
        user.setPhone(request.getPhone().trim());
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = layUser(userId);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw ApiException.badRequest("Mật khẩu hiện tại không đúng");
        }
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw ApiException.badRequest("Mật khẩu mới phải khác mật khẩu hiện tại");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Đổi mật khẩu chủ động thì mọi link "quên mật khẩu" đang treo phải mất hiệu lực. Nếu không,
        // một link xin trước đó (có thể do kẻ khác xin) vẫn đặt lại được mật khẩu ngay sau lưng.
        tokenRepository.tieuHetVeChuaDung(user, LocalDateTime.now());
    }

    private User layUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản"));
    }

    private ProfileResponse toResponse(User u) {
        return ProfileResponse.builder()
                .userId(u.getUserId())
                .username(u.getUsername())
                .email(u.getEmail())
                .fullName(u.getFullName())
                .phone(u.getPhone())
                .thieuSoDienThoai(u.getPhone() == null || u.getPhone().isBlank())
                .build();
    }
}
