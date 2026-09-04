package com.datn.repository;

import com.datn.entity.PasswordResetToken;
import com.datn.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /** Tra theo bản BĂM -- mã gốc không bao giờ nằm trong cơ sở dữ liệu. */
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /**
     * Vé mới nhất còn hiệu lực của một người. Dùng để chặn gửi mail dồn dập: bấm "Quên mật khẩu" liên
     * tục không được biến thành công cụ dội bom hộp thư người khác.
     */
    Optional<PasswordResetToken> findFirstByUserAndUsedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(
            User user, LocalDateTime moc);

    /**
     * Tiêu hết vé chưa dùng của một người.
     *
     * Gọi khi đổi mật khẩu thành công: nếu không, những link đã gửi trước đó vẫn dùng được, nghĩa là
     * người từng xin link cũ vẫn đặt lại mật khẩu tiếp được sau lưng chủ tài khoản.
     */
    // flushAutomatically: đẩy các thay đổi đang chờ (vd mật khẩu mới vừa gán cho User) xuống cơ sở dữ
    // liệu TRƯỚC khi chạy câu UPDATE hàng loạt. Thiếu nó thì clearAutomatically ngay sau đó sẽ xoá sạch
    // ngữ cảnh và nuốt luôn mật khẩu mới -- đổi mật khẩu xong mà mật khẩu không đổi.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE PasswordResetToken t SET t.usedAt = :thoiDiem "
            + "WHERE t.user = :user AND t.usedAt IS NULL")
    int tieuHetVeChuaDung(@Param("user") User user, @Param("thoiDiem") LocalDateTime thoiDiem);
}
