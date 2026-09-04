package com.datn.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * Body của PUT /api/users/me.
 *
 * Khác với lúc đăng ký (RegisterRequest cho phép bỏ trống số điện thoại), ở đây số điện thoại là BẮT
 * BUỘC: đây là màn người dùng chủ động vào sửa thông tin của mình, không phải rào cản chắn ngang lúc
 * tạo tài khoản.
 */
@Getter
@Setter
public class UpdateProfileRequest {

    @NotBlank(message = "Vui lòng nhập họ tên")
    @Size(max = 100, message = "Họ tên tối đa 100 ký tự")
    private String fullName;

    @NotBlank(message = "Vui lòng nhập số điện thoại")
    // Cùng biểu thức với AddressRequest -- một định dạng số Việt Nam duy nhất trong toàn hệ thống.
    @Pattern(regexp = "^(0|\\+84)(3|5|7|8|9)[0-9]{8}$",
            message = "Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 03/05/07/08/09, vd 0912345678)")
    private String phone;

    /*
     * Cắt khoảng trắng NGAY LÚC NHẬN, không đợi tới Service.
     *
     * Bắt buộc phải ở đây: Jackson gọi setter để dựng đối tượng, RỒI @Valid mới chạy. Cắt ở Service là
     * quá muộn -- chuỗi "  0912345678  " bị @Pattern đánh trượt trước khi Service kịp nhìn thấy nó.
     * Người dùng dán số từ tin nhắn (rất hay dính dấu cách) sẽ nhìn vào ô thấy số đúng y nguyên mà vẫn
     * bị báo sai định dạng, không tài nào hiểu nổi.
     *
     * Đây là lỗi do công cụ tự kiểm tools/auth-profile-test.js phát hiện, không phải suy đoán.
     */
    public void setPhone(String phone) {
        this.phone = phone == null ? null : phone.trim();
    }

    public void setFullName(String fullName) {
        this.fullName = fullName == null ? null : fullName.trim();
    }
}
