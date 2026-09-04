package com.datn.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** Body của PUT /api/users/me/password. */
@Getter
@Setter
public class ChangePasswordRequest {

    /**
     * Bắt nhập lại mật khẩu hiện tại dù người dùng ĐÃ đăng nhập.
     *
     * Lý do: token đăng nhập sống 24 giờ, nên "đang đăng nhập" không đồng nghĩa với "đúng là chủ tài
     * khoản đang ngồi ở đây". Thiếu bước này thì ai mượn được máy lúc màn hình đang mở là đổi được mật
     * khẩu và chiếm hẳn tài khoản.
     */
    @NotBlank(message = "Vui lòng nhập mật khẩu hiện tại")
    private String currentPassword;

    @NotBlank(message = "Vui lòng nhập mật khẩu mới")
    @Size(min = 6, message = "Mật khẩu mới phải có ít nhất 6 ký tự")
    private String newPassword;
}
