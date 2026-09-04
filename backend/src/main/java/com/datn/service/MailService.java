package com.datn.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Gửi email. Hiện chỉ phục vụ luồng đặt lại mật khẩu.
 *
 * Cấu hình SMTP nằm ở application.properties (mục "Gửi email"). Chưa điền tài khoản/mật khẩu ứng dụng
 * thì {@link #daCauHinh()} trả false và bên gọi báo lỗi rõ ràng -- KHÔNG được nuốt im lặng, vì khi đó
 * người dùng ngồi đợi một email không bao giờ tới mà chẳng biết vì sao.
 */
@Service
@RequiredArgsConstructor
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String nguoiGui;

    /** Đã điền tài khoản gửi mail chưa. */
    public boolean daCauHinh() {
        return nguoiGui != null && !nguoiGui.isBlank();
    }

    /**
     * Gửi link đặt lại mật khẩu.
     *
     * @throws org.springframework.mail.MailException khi SMTP từ chối (sai mật khẩu ứng dụng, chặn
     *         mạng...). Cố tình để ném ra ngoài: bên gọi cần biết mail KHÔNG đi được để còn ghi log,
     *         nếu nuốt ở đây thì lỗi cấu hình sẽ trông y hệt lúc chạy trơn tru.
     */
    public void guiLinkDatLaiMatKhau(String email, String tenHienThi, String link, int soPhutHieuLuc) {
        MimeMessage message = mailSender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(nguoiGui, "NovaCart");
            helper.setTo(email);
            helper.setSubject("NovaCart - Đặt lại mật khẩu");
            helper.setText(noiDung(tenHienThi, link, soPhutHieuLuc), true);
        } catch (Exception e) {
            // Lỗi khi DỰNG thư (địa chỉ sai định dạng, lỗi mã hoá) -- khác hẳn lỗi lúc GỬI ở dưới.
            throw new IllegalStateException("Không dựng được email đặt lại mật khẩu: " + e.getMessage(), e);
        }
        mailSender.send(message);
        log.info("[quen-mat-khau] Đã gửi link đặt lại mật khẩu tới {}", che(email));
    }

    /** Che bớt email khi ghi log -- log không phải chỗ để lộ danh sách địa chỉ người dùng. */
    public static String che(String email) {
        if (email == null) return "(trống)";
        int at = email.indexOf('@');
        if (at <= 1) return "***" + (at >= 0 ? email.substring(at) : "");
        return email.charAt(0) + "***" + email.substring(at);
    }

    private String noiDung(String tenHienThi, String link, int soPhut) {
        return """
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1c1917;line-height:1.6">
                  <p>Xin chào <b>%s</b>,</p>
                  <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản NovaCart của bạn.
                     Bấm nút dưới đây để đặt mật khẩu mới:</p>
                  <p style="margin:24px 0">
                    <a href="%s" style="background:#1c1917;color:#fafaf9;text-decoration:none;
                       padding:12px 24px;font-weight:600;display:inline-block">Đặt lại mật khẩu</a>
                  </p>
                  <p>Hoặc mở đường dẫn này:<br>
                     <a href="%s" style="color:#a16207;word-break:break-all">%s</a></p>
                  <p>Liên kết có hiệu lực trong <b>%d phút</b> và chỉ dùng được <b>một lần</b>.</p>
                  <p style="color:#78716c">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này --
                     mật khẩu hiện tại của bạn vẫn giữ nguyên.</p>
                  <p style="color:#78716c;font-size:13px;margin-top:32px">NovaCart</p>
                </div>
                """.formatted(tenHienThi, link, link, link, soPhut);
    }
}
