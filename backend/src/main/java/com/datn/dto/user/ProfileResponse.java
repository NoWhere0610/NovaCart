package com.datn.dto.user;

import lombok.Builder;
import lombok.Getter;

/** Body trả về của GET/PUT /api/users/me. */
@Getter
@Builder
public class ProfileResponse {

    private Long userId;

    /** Chỉ để hiển thị -- tên đăng nhập không đổi được (là định danh dùng để đăng nhập). */
    private String username;

    /**
     * Cũng chỉ để hiển thị. Email vừa là định danh đăng nhập thay thế, vừa là kênh nhận link đặt lại
     * mật khẩu -- cho đổi tự do mà không xác minh địa chỉ mới thì chỉ cần gõ nhầm một ký tự là mất luôn
     * đường lấy lại tài khoản. Muốn cho đổi thì phải làm quy trình xác minh email riêng.
     */
    private String email;

    private String fullName;

    private String phone;

    /** true khi tài khoản chưa có số điện thoại -- frontend dựa vào đây để nhắc bổ sung. */
    private boolean thieuSoDienThoai;
}
