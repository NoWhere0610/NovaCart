package com.datn.service;

import com.datn.entity.PasswordResetToken;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.PasswordResetTokenRepository;
import com.datn.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Luồng "quên mật khẩu": xin link qua email -> bấm link -> đặt mật khẩu mới.
 *
 * BA NGUYÊN TẮC chi phối gần như mọi quyết định trong lớp này:
 *
 * 1. KHÔNG tiết lộ email nào có tài khoản. Yêu cầu đặt lại luôn trả về đúng một câu trả lời như nhau,
 *    dù email tồn tại hay không. Nếu phân biệt, endpoint công khai này trở thành công cụ dò danh sách
 *    khách hàng: cứ thử từng email là biết ai đã đăng ký.
 *
 * 2. Mã đặt lại được BĂM trước khi lưu, y như mật khẩu. Xem {@link PasswordResetToken}.
 *
 * 3. Không cho dội bom hộp thư. Vé vừa gửi chưa quá {@link #KHOANG_CACH_TOI_THIEU} thì lần bấm tiếp
 *    theo không gửi thêm mail nữa -- nhưng vẫn trả về câu trả lời y hệt, để nguyên tắc 1 không bị phá.
 *
 * ĐIỂM HẠN CHẾ ĐÃ BIẾT: hệ thống dùng JWT không trạng thái, không có danh sách thu hồi. Nghĩa là token
 * đăng nhập đã cấp TRƯỚC khi đổi mật khẩu vẫn còn hiệu lực tới khi hết hạn (24 giờ, xem
 * app.jwt.expiration-ms). Đổi mật khẩu vì vậy chặn được lần đăng nhập sau, nhưng chưa đá được phiên
 * đang mở của kẻ đã chiếm tài khoản. Muốn xử lý triệt để thì phải thêm số phiên bản token vào User và
 * kiểm ở JwtAuthFilter -- nằm ngoài phạm vi phần này.
 */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    /** Số byte ngẫu nhiên của mã. 32 byte = 256 bit, không có cách nào đoán mò. */
    private static final int SO_BYTE_MA = 32;

    /** Hai lần xin link cách nhau ít hơn khoảng này thì lần sau không gửi mail. */
    private static final Duration KHOANG_CACH_TOI_THIEU = Duration.ofSeconds(60);

    /** Câu trả lời DUY NHẤT cho mọi trường hợp -- xem nguyên tắc 1 ở javadoc lớp. */
    public static final String THONG_BAO_CHUNG =
            "Nếu email này có tài khoản, chúng tôi đã gửi link đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (kể cả mục Spam).";

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.password-reset.expiration-minutes}")
    private int soPhutHieuLuc;

    /**
     * Xin link đặt lại mật khẩu.
     *
     * Luôn kết thúc êm (trừ khi chưa cấu hình SMTP). Email không tồn tại, tài khoản bị khoá, hay vừa
     * xin link cách đây 10 giây -- cả ba đều lặng lẽ không gửi gì và trả về đúng câu như trường hợp
     * gửi thành công.
     */
    @Transactional
    public String yeuCauDatLai(String email) {
        // Kiểm cấu hình TRƯỚC khi tra email: lỗi này là lỗi của hệ thống, không phụ thuộc người dùng
        // nhập gì, nên báo ra không hề tiết lộ email nào có tài khoản.
        if (!mailService.daCauHinh()) {
            log.error("[quen-mat-khau] Chưa cấu hình SMTP -- đặt biến môi trường MAIL_USERNAME và MAIL_PASSWORD "
                    + "(app password của Gmail), xem mục 'Gửi email' trong application.properties.");
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "Hệ thống chưa cấu hình gửi email nên chưa dùng được chức năng này. Vui lòng liên hệ quản trị viên.");
        }

        Optional<User> tim = userRepository.findByEmail(email.trim());
        if (tim.isEmpty()) {
            log.info("[quen-mat-khau] Yêu cầu cho email không có tài khoản: {}", MailService.che(email));
            return THONG_BAO_CHUNG;
        }
        User user = tim.get();
        if (Boolean.FALSE.equals(user.getIsActive())) {
            log.info("[quen-mat-khau] Bỏ qua vì tài khoản đang bị khoá: {}", MailService.che(email));
            return THONG_BAO_CHUNG;
        }

        Optional<PasswordResetToken> veGanNhat = tokenRepository
                .findFirstByUserAndUsedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(user, LocalDateTime.now());
        if (veGanNhat.isPresent()
                && veGanNhat.get().getCreatedAt().isAfter(LocalDateTime.now().minus(KHOANG_CACH_TOI_THIEU))) {
            log.info("[quen-mat-khau] Bỏ qua vì vừa gửi link cách đây chưa tới {} giây: {}",
                    KHOANG_CACH_TOI_THIEU.toSeconds(), MailService.che(email));
            return THONG_BAO_CHUNG;
        }

        String maGoc = sinhMa();
        PasswordResetToken ve = new PasswordResetToken();
        ve.setUser(user);
        ve.setTokenHash(bam(maGoc));
        ve.setExpiresAt(LocalDateTime.now().plusMinutes(soPhutHieuLuc));
        tokenRepository.save(ve);

        String link = frontendUrl.replaceAll("/+$", "") + "/reset-password?token=" + maGoc;
        String tenHienThi = user.getFullName() != null && !user.getFullName().isBlank()
                ? user.getFullName() : user.getUsername();
        // Mail gửi lỗi thì để exception bay ra -> giao dịch cuộn lại -> KHÔNG để lại vé mồ côi trong cơ
        // sở dữ liệu cho một email chưa bao giờ tới tay ai.
        mailService.guiLinkDatLaiMatKhau(user.getEmail(), tenHienThi, link, soPhutHieuLuc);

        return THONG_BAO_CHUNG;
    }

    /**
     * Đặt mật khẩu mới bằng mã trong link.
     *
     * Ở đây thì NGƯỢC LẠI với lúc xin link: báo lỗi cụ thể là đúng. Người dùng cầm link hỏng cần biết
     * là link đã hết hạn hay đã dùng rồi để còn biết phải làm gì, mà thông tin đó cũng chẳng tiết lộ
     * email nào có tài khoản.
     */
    @Transactional
    public void datLaiMatKhau(String maGoc, String matKhauMoi) {
        PasswordResetToken ve = tokenRepository.findByTokenHash(bam(maGoc))
                .orElseThrow(() -> ApiException.badRequest(
                        "Link đặt lại mật khẩu không hợp lệ. Vui lòng yêu cầu link mới."));

        if (ve.getUsedAt() != null) {
            throw ApiException.badRequest("Link này đã được sử dụng. Vui lòng yêu cầu link mới.");
        }
        if (LocalDateTime.now().isAfter(ve.getExpiresAt())) {
            throw ApiException.badRequest(
                    "Link đặt lại mật khẩu đã hết hạn (chỉ có hiệu lực " + soPhutHieuLuc + " phút). Vui lòng yêu cầu link mới.");
        }

        User user = ve.getUser();
        user.setPassword(passwordEncoder.encode(matKhauMoi));
        userRepository.save(user);

        // Tiêu cả vé vừa dùng LẪN mọi vé chưa dùng khác của người này -- xem javadoc tieuHetVeChuaDung.
        tokenRepository.tieuHetVeChuaDung(user, LocalDateTime.now());
        log.info("[quen-mat-khau] Đã đặt lại mật khẩu cho {}", MailService.che(user.getEmail()));
    }

    /** Mã ngẫu nhiên an toàn mật mã, dạng base64url để nhét thẳng vào URL không cần mã hoá thêm. */
    private String sinhMa() {
        byte[] bytes = new byte[SO_BYTE_MA];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * SHA-256 dạng hex.
     *
     * Dùng SHA-256 chứ không dùng BCrypt như mật khẩu, và đó là chủ ý: BCrypt cố tình chậm và sinh muối
     * ngẫu nhiên mỗi lần băm, nên không thể tra cứu theo bản băm được -- sẽ phải quét toàn bộ bảng và
     * so từng dòng. Ở đây không cần độ chậm đó: mã là 256 bit ngẫu nhiên, không phải mật khẩu người tự
     * nghĩ ra, nên không có gì để tấn công từ điển cả.
     */
    private String bam(String maGoc) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(maGoc.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Máy ảo Java không hỗ trợ SHA-256", e);
        }
    }
}
