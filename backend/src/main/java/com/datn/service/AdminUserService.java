package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminUserResponse;
import com.datn.entity.Role;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.RoleRepository;
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

    /** Ba vai trò loại trừ nhau của hệ thống -- khớp đúng bảng roles. */
    private static final java.util.Set<String> VAI_TRO_HOP_LE = java.util.Set.of("ADMIN", "STAFF", "CUSTOMER");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    public PageResponse<AdminUserResponse> list(int page, int size, String keyword) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        // Lọc ở BACKEND trên toàn bộ người dùng, không lọc lại trên trang hiện tại: người cần tìm rất
        // có thể nằm ở trang sau, lọc phía client thì không bao giờ thấy.
        Page<User> users = (keyword == null || keyword.isBlank())
                ? userRepository.findAll(pageable)
                : userRepository.timTheoEmailHoacUsername(keyword.trim(), pageable);
        return PageResponse.from(users.map(this::toResponse));
    }

    /**
     * Đổi vai trò của một tài khoản.
     *
     * HAI CHỐT CHẶN, đều nhằm vào cùng một tai nạn: hệ thống không còn ADMIN nào.
     *   1. Admin không tự hạ vai trò của CHÍNH MÌNH -- bấm nhầm là mất quyền ngay lập tức, và không
     *      còn màn hình nào để tự sửa lại.
     *   2. Không hạ vai trò của ADMIN CUỐI CÙNG -- kể cả khi người bấm là một admin khác. Không chặn
     *      thì hai admin lần lượt hạ nhau xuống là cả hệ thống mất khu quản trị, chỉ còn cách sửa
     *      thẳng cơ sở dữ liệu.
     */
    @Transactional
    public AdminUserResponse doiVaiTro(Long userId, String roleName) {
        if (!VAI_TRO_HOP_LE.contains(roleName)) {
            throw ApiException.badRequest("Vai trò không hợp lệ, chỉ nhận ADMIN, STAFF hoặc CUSTOMER");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));

        boolean dangLaAdmin = user.getRoles() != null
                && user.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getRoleName()));
        boolean hoiXuongQuyen = dangLaAdmin && !"ADMIN".equals(roleName);

        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        if (hoiXuongQuyen && user.getUsername().equals(currentUsername)) {
            throw ApiException.badRequest(
                    "Không thể tự hạ vai trò của tài khoản đang đăng nhập -- bạn sẽ mất quyền quản trị ngay lập tức");
        }
        if (hoiXuongQuyen && userRepository.demSoAdmin() <= 1) {
            throw ApiException.badRequest(
                    "Đây là tài khoản quản trị duy nhất còn lại, không thể hạ vai trò. Hãy cấp quyền ADMIN cho một tài khoản khác trước.");
        }

        Role role = roleRepository.findByRoleName(roleName)
                .orElseThrow(() -> ApiException.notFound("Chưa cấu hình vai trò '" + roleName + "' trong hệ thống"));

        // Đặt lại thành ĐÚNG MỘT vai trò, không cộng dồn -- xem UpdateUserRoleRequest.
        user.setRoles(new java.util.HashSet<>(java.util.Set.of(role)));
        return toResponse(userRepository.save(user));
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