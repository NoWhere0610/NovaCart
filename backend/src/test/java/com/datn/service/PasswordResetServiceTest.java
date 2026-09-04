package com.datn.service;

import com.datn.entity.PasswordResetToken;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.PasswordResetTokenRepository;
import com.datn.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mail.MailSendException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Luồng quên mật khẩu.
 *
 * VÌ SAO ĐÁNG TEST HƠN HẦU HẾT CHỖ KHÁC: đây là con đường CÔNG KHAI dẫn thẳng tới việc thay mật khẩu
 * của người khác. Sai ở đây không phải là "hiển thị sai" mà là mất tài khoản. Ba tính chất bên dưới
 * đều thuộc loại nhìn mắt thường không thấy được, và kiểm bằng tay thì phải ngồi đợi hết hạn thật hoặc
 * mở thẳng cơ sở dữ liệu ra soi:
 *
 *   - Trả lời giống hệt nhau dù email có tài khoản hay không (chống dò danh sách khách hàng)
 *   - Trong cơ sở dữ liệu chỉ có bản BĂM, không có mã thật trong link
 *   - Vé hết hạn / đã dùng thì không đổi được mật khẩu
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetServiceTest {

    private static final String EMAIL = "khach@example.com";
    private static final int SO_PHUT = 30;

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetTokenRepository tokenRepository;
    @Mock private MailService mailService;

    // Dùng BCrypt THẬT chứ không mock: phần đáng kiểm ở đây chính là mật khẩu có được băm đúng không.
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private PasswordResetService service;

    private User user;

    @BeforeEach
    void setUp() {
        // Dựng tay thay vì @InjectMocks -- cần một PasswordEncoder THẬT xen giữa các mock.
        service = new PasswordResetService(userRepository, tokenRepository, passwordEncoder, mailService);
        // Hai trường này bình thường do @Value bơm từ application.properties, ở test thì phải tự đặt.
        ReflectionTestUtils.setField(service, "frontendUrl", "http://localhost:5173");
        ReflectionTestUtils.setField(service, "soPhutHieuLuc", SO_PHUT);

        user = new User();
        user.setUserId(7L);
        user.setUsername("khach");
        user.setEmail(EMAIL);
        user.setFullName("Nguyễn Văn A");
        user.setIsActive(true);
        user.setPassword(passwordEncoder.encode("matkhaucu"));

        when(mailService.daCauHinh()).thenReturn(true);
        when(tokenRepository.findFirstByUserAndUsedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(any(), any()))
                .thenReturn(Optional.empty());
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ===================== Xin link =====================

    @Test
    @DisplayName("Email KHÔNG có tài khoản: trả lời y hệt lúc thành công và không gửi mail")
    void emailKhongTonTai_khongLoRaLaKhongTonTai() {
        when(userRepository.findByEmail("aikhongco@example.com")).thenReturn(Optional.empty());

        String traLoi = service.yeuCauDatLai("aikhongco@example.com");

        // Đây mới là điểm mấu chốt: câu trả lời phải TRÙNG KHÍT với trường hợp có tài khoản. Chỉ cần
        // khác một chữ là kẻ tấn công dò được email nào đã đăng ký.
        assertThat(traLoi).isEqualTo(PasswordResetService.THONG_BAO_CHUNG);
        verify(mailService, never()).guiLinkDatLaiMatKhau(anyString(), anyString(), anyString(), anyInt());
        verify(tokenRepository, never()).save(any());
    }

    @Test
    @DisplayName("Email CÓ tài khoản: trả lời trùng khít với trường hợp không có tài khoản")
    void emailCoTaiKhoan_traLoiGiongHet() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        assertThat(service.yeuCauDatLai(EMAIL)).isEqualTo(PasswordResetService.THONG_BAO_CHUNG);
    }

    @Test
    @DisplayName("Cơ sở dữ liệu chỉ lưu bản BĂM -- mã trong link không hề nằm trong bảng")
    void chiLuuBanBam_khongLuuMaGoc() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        service.yeuCauDatLai(EMAIL);

        var veCaptor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(veCaptor.capture());
        var linkCaptor = ArgumentCaptor.forClass(String.class);
        verify(mailService).guiLinkDatLaiMatKhau(eq(EMAIL), anyString(), linkCaptor.capture(), eq(SO_PHUT));

        String maTrongLink = linkCaptor.getValue().substring(linkCaptor.getValue().indexOf("token=") + 6);
        String daLuu = veCaptor.getValue().getTokenHash();

        assertThat(daLuu)
                .as("Mã gốc bị lưu thẳng vào cơ sở dữ liệu -- ai đọc được bảng là đặt lại được mật khẩu người khác")
                .isNotEqualTo(maTrongLink);
        assertThat(daLuu).isEqualTo(bam(maTrongLink)).hasSize(64);
        assertThat(maTrongLink)
                .as("Mã phải đủ dài để không đoán mò được")
                .hasSizeGreaterThanOrEqualTo(40);
        assertThat(veCaptor.getValue().getExpiresAt()).isAfter(LocalDateTime.now().plusMinutes(SO_PHUT - 1));
    }

    @Test
    @DisplayName("Bấm liên tục: vé vừa gửi chưa tới 60 giây thì không gửi thêm mail")
    void chanDoiBomHopThu() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        PasswordResetToken veVuaGui = new PasswordResetToken();
        veVuaGui.setUser(user);
        veVuaGui.setCreatedAt(LocalDateTime.now().minusSeconds(10));
        veVuaGui.setExpiresAt(LocalDateTime.now().plusMinutes(SO_PHUT));
        when(tokenRepository.findFirstByUserAndUsedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(any(), any()))
                .thenReturn(Optional.of(veVuaGui));

        String traLoi = service.yeuCauDatLai(EMAIL);

        verify(mailService, never()).guiLinkDatLaiMatKhau(anyString(), anyString(), anyString(), anyInt());
        // Vẫn phải trả câu y hệt: nếu báo "bạn vừa xin rồi" thì lại lộ ra email này CÓ tài khoản.
        assertThat(traLoi).isEqualTo(PasswordResetService.THONG_BAO_CHUNG);
    }

    @Test
    @DisplayName("Tài khoản bị khoá: không gửi link đặt lại")
    void taiKhoanBiKhoa_khongGui() {
        user.setIsActive(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        assertThat(service.yeuCauDatLai(EMAIL)).isEqualTo(PasswordResetService.THONG_BAO_CHUNG);
        verify(mailService, never()).guiLinkDatLaiMatKhau(anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    @DisplayName("Chưa cấu hình SMTP: báo lỗi rõ ràng, KHÔNG im lặng như thể đã gửi")
    void chuaCauHinhSmtp_baoLoiRoRang() {
        when(mailService.daCauHinh()).thenReturn(false);

        assertThatThrownBy(() -> service.yeuCauDatLai(EMAIL))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chưa cấu hình gửi email");
        // Chưa gửi được thì đừng tra email làm gì -- và nhất là đừng tạo vé mồ côi.
        verify(userRepository, never()).findByEmail(anyString());
        verify(tokenRepository, never()).save(any());
    }

    @Test
    @DisplayName("SMTP từ chối: exception bay ra để giao dịch cuộn lại, không để vé mồ côi")
    void mailLoi_neExceptionRaNgoai() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        doThrow(new MailSendException("sai app password"))
                .when(mailService).guiLinkDatLaiMatKhau(anyString(), anyString(), anyString(), anyInt());

        // Nuốt lỗi ở đây sẽ để lại một vé hợp lệ trong cơ sở dữ liệu ứng với email chưa bao giờ tới tay
        // ai -- vừa vô dụng vừa là mã đặt lại mật khẩu còn sống lang thang.
        assertThatThrownBy(() -> service.yeuCauDatLai(EMAIL))
                .isInstanceOf(MailSendException.class);
    }

    // ===================== Đặt mật khẩu mới =====================

    @Test
    @DisplayName("Vé hợp lệ: mật khẩu được băm lại và mọi vé chưa dùng đều bị tiêu")
    void datLaiThanhCong() {
        String maGoc = "ma-gia-de-test";
        when(tokenRepository.findByTokenHash(bam(maGoc))).thenReturn(Optional.of(taoVe(user, +10, null)));

        service.datLaiMatKhau(maGoc, "matkhaumoi123");

        assertThat(passwordEncoder.matches("matkhaumoi123", user.getPassword()))
                .as("Mật khẩu mới chưa được lưu").isTrue();
        assertThat(user.getPassword())
                .as("Mật khẩu bị lưu dạng chữ thường, không băm").doesNotContain("matkhaumoi123");
        verify(tokenRepository).tieuHetVeChuaDung(eq(user), any());
    }

    @Test
    @DisplayName("Vé đã hết hạn: từ chối và mật khẩu giữ nguyên")
    void veHetHan_tuChoi() {
        String maGoc = "ma-het-han";
        String matKhauCu = user.getPassword();
        when(tokenRepository.findByTokenHash(bam(maGoc))).thenReturn(Optional.of(taoVe(user, -1, null)));

        assertThatThrownBy(() -> service.datLaiMatKhau(maGoc, "matkhaumoi123"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("hết hạn");
        assertThat(user.getPassword()).isEqualTo(matKhauCu);
    }

    @Test
    @DisplayName("Vé đã dùng rồi: từ chối dùng lại lần hai")
    void veDaDung_tuChoi() {
        String maGoc = "ma-da-dung";
        String matKhauCu = user.getPassword();
        when(tokenRepository.findByTokenHash(bam(maGoc)))
                .thenReturn(Optional.of(taoVe(user, +10, LocalDateTime.now().minusMinutes(1))));

        assertThatThrownBy(() -> service.datLaiMatKhau(maGoc, "matkhaumoi123"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("đã được sử dụng");
        assertThat(user.getPassword()).isEqualTo(matKhauCu);
    }

    @Test
    @DisplayName("Mã bịa: từ chối")
    void maKhongTonTai_tuChoi() {
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.datLaiMatKhau("ma-bia-ra", "matkhaumoi123"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("không hợp lệ");
    }

    // ===================== Tiện ích =====================

    private PasswordResetToken taoVe(User u, int phutToiHan, LocalDateTime usedAt) {
        PasswordResetToken ve = new PasswordResetToken();
        ve.setUser(u);
        ve.setCreatedAt(LocalDateTime.now().minusMinutes(1));
        ve.setExpiresAt(LocalDateTime.now().plusMinutes(phutToiHan));
        ve.setUsedAt(usedAt);
        return ve;
    }

    /** Bản sao độc lập của cách băm trong service -- cố tình viết lại thay vì gọi hàm private qua
     *  reflection, để nếu ai đó đổi thuật toán băm thì test này đỏ chứ không âm thầm đổi theo. */
    private static String bam(String s) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
