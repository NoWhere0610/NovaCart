package com.datn.service;

import com.datn.dto.user.ChangePasswordRequest;
import com.datn.dto.user.UpdateProfileRequest;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.PasswordResetTokenRepository;
import com.datn.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Hồ sơ của chính người đang đăng nhập.
 *
 * Trọng tâm là đổi mật khẩu: đây là thao tác mà làm sai thì mất tài khoản, mà nhìn màn hình thì không
 * phân biệt được đúng/sai (cả hai đều hiện "Đổi mật khẩu thành công").
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserProfileServiceTest {

    private static final long USER_ID = 7L;
    private static final String MAT_KHAU_CU = "matkhaucu";

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetTokenRepository tokenRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private UserProfileService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new UserProfileService(userRepository, tokenRepository, passwordEncoder);

        user = new User();
        user.setUserId(USER_ID);
        user.setUsername("khach");
        user.setEmail("khach@example.com");
        user.setFullName("Tên Cũ");
        user.setPassword(passwordEncoder.encode(MAT_KHAU_CU));

        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ===================== Xem / sửa hồ sơ =====================

    @Test
    @DisplayName("Tài khoản chưa có số điện thoại thì cờ thieuSoDienThoai bật lên")
    void chuaCoSoDienThoai_batCo() {
        user.setPhone(null);
        assertThat(service.getMyProfile(USER_ID).isThieuSoDienThoai()).isTrue();

        // Chuỗi rỗng phải tính là THIẾU y như null -- người dùng cũ đăng ký lúc số điện thoại còn không
        // bắt buộc rất dễ rơi vào trạng thái này, nếu tính là "đã có" thì lời nhắc bổ sung không bao giờ hiện.
        user.setPhone("   ");
        assertThat(service.getMyProfile(USER_ID).isThieuSoDienThoai()).isTrue();

        user.setPhone("0912345678");
        assertThat(service.getMyProfile(USER_ID).isThieuSoDienThoai()).isFalse();
    }

    @Test
    @DisplayName("Sửa hồ sơ: cắt khoảng trắng thừa hai đầu trước khi lưu")
    void suaHoSo_catKhoangTrang() {
        var request = new UpdateProfileRequest();
        request.setFullName("  Nguyễn Văn A  ");
        request.setPhone("  0912345678 ");

        var ketQua = service.updateMyProfile(USER_ID, request);

        // Không cắt thì số điện thoại lưu xuống có dấu cách, và mọi so sánh/tra cứu sau này đều lệch.
        assertThat(ketQua.getPhone()).isEqualTo("0912345678");
        assertThat(ketQua.getFullName()).isEqualTo("Nguyễn Văn A");
        assertThat(ketQua.isThieuSoDienThoai()).isFalse();
    }

    @Test
    @DisplayName("Sửa hồ sơ KHÔNG đụng tới email và tên đăng nhập")
    void suaHoSo_khongDoiDinhDanh() {
        var request = new UpdateProfileRequest();
        request.setFullName("Tên Mới");
        request.setPhone("0912345678");

        var ketQua = service.updateMyProfile(USER_ID, request);

        // Email vừa là định danh đăng nhập thay thế, vừa là kênh nhận link đặt lại mật khẩu.
        assertThat(ketQua.getEmail()).isEqualTo("khach@example.com");
        assertThat(ketQua.getUsername()).isEqualTo("khach");
    }

    // ===================== Đổi mật khẩu =====================

    @Test
    @DisplayName("Sai mật khẩu hiện tại: từ chối và giữ nguyên mật khẩu cũ")
    void saiMatKhauHienTai_tuChoi() {
        String bamCu = user.getPassword();

        assertThatThrownBy(() -> service.changePassword(USER_ID, doiMatKhau("sai-be-bét", "matkhaumoi")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Mật khẩu hiện tại không đúng");

        assertThat(user.getPassword()).isEqualTo(bamCu);
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Mật khẩu mới trùng mật khẩu cũ: từ chối")
    void matKhauMoiTrungCu_tuChoi() {
        assertThatThrownBy(() -> service.changePassword(USER_ID, doiMatKhau(MAT_KHAU_CU, MAT_KHAU_CU)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("phải khác");
    }

    @Test
    @DisplayName("Đổi thành công: mật khẩu được băm, và mọi link quên mật khẩu đang treo bị tiêu")
    void doiThanhCong() {
        service.changePassword(USER_ID, doiMatKhau(MAT_KHAU_CU, "matkhaumoi123"));

        assertThat(passwordEncoder.matches("matkhaumoi123", user.getPassword())).isTrue();
        assertThat(user.getPassword()).doesNotContain("matkhaumoi123");

        // Nếu không tiêu, một link "quên mật khẩu" xin trước đó (có thể do kẻ khác xin) vẫn đặt lại
        // được mật khẩu ngay sau lưng chủ tài khoản vừa mới đổi.
        verify(tokenRepository).tieuHetVeChuaDung(eq(user), any());
    }

    @Test
    @DisplayName("Không tìm thấy tài khoản: 404 chứ không phải NullPointerException")
    void khongTimThayTaiKhoan() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getMyProfile(999L))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Không tìm thấy tài khoản");
    }

    private ChangePasswordRequest doiMatKhau(String hienTai, String moi) {
        var r = new ChangePasswordRequest();
        r.setCurrentPassword(hienTai);
        r.setNewPassword(moi);
        return r;
    }
}
