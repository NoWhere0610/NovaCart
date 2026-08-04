package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminUserResponse;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;

    public PageResponse<AdminUserResponse> list(int page, int size) {
        Page<User> users = userRepository.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.from(users.map(this::toResponse));
    }

    /** Khoá/mở khoá tài khoản (is_active) — user bị khoá sẽ không đăng nhập được nữa (xem UserPrincipal.isEnabled()). */
    @Transactional
    public AdminUserResponse setActive(Long userId, boolean active) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));

        // Chặn admin tự khoá tài khoản đang đăng nhập của chính mình -- tránh khoá xong không ai mở lại được.
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        if (!active && user.getUsername().equals(currentUsername)) {
            throw ApiException.badRequest("Không thể tự khoá tài khoản đang đăng nhập của chính mình");
        }

        user.setIsActive(active);
        return toResponse(userRepository.save(user));
    }

    private AdminUserResponse toResponse(User u) {
        return AdminUserResponse.builder()
                .userId(u.getUserId())
                .username(u.getUsername())
                .email(u.getEmail())
                .fullName(u.getFullName())
                .phone(u.getPhone())
                .isActive(u.getIsActive())
                .roles(u.getRoles() == null ? java.util.List.of()
                        : u.getRoles().stream().map(r -> r.getRoleName()).toList())
                .createdAt(u.getCreatedAt())
                .build();
    }
}