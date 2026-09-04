package com.datn.controller;

import com.datn.dto.user.ChangePasswordRequest;
import com.datn.dto.user.ProfileResponse;
import com.datn.dto.user.UpdateProfileRequest;
import com.datn.security.UserPrincipal;
import com.datn.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Hồ sơ của CHÍNH người đang đăng nhập.
 *
 * Không nằm trong PUBLIC_ENDPOINTS nên rơi vào luật anyRequest().authenticated() của SecurityConfig:
 * phải có token hợp lệ. Không cần @PreAuthorize theo vai trò, vì ai cũng được sửa hồ sơ của chính mình
 * -- phạm vi được giới hạn bằng cách LUÔN dùng principal.getUserId() chứ không nhận userId từ request.
 *
 * Chú ý đường dẫn: /api/users/me KHÁC với /api/admin/users/** (chỉ ADMIN, quản lý người dùng khác).
 */
@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    @GetMapping
    public ResponseEntity<ProfileResponse> getMyProfile(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(userProfileService.getMyProfile(principal.getUserId()));
    }

    @PutMapping
    public ResponseEntity<ProfileResponse> updateMyProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userProfileService.updateMyProfile(principal.getUserId(), request));
    }

    @PutMapping("/password")
    public ResponseEntity<Map<String, String>> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        userProfileService.changePassword(principal.getUserId(), request);
        return ResponseEntity.ok(Map.of("message", "Đổi mật khẩu thành công"));
    }
}
