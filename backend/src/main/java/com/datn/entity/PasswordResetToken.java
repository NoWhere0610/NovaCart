package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Vé một lần dùng để đặt lại mật khẩu.
 *
 * LƯU Ý QUAN TRỌNG: cột token_hash lưu bản BĂM SHA-256 của mã, không lưu mã gốc. Lý do giống hệt lý do
 * mật khẩu phải băm: ai đọc được cơ sở dữ liệu (lộ backup, SQL injection, người trong nhóm...) thì cũng
 * không dựng lại được link đặt lại mật khẩu, tức là không chiếm được tài khoản của người khác. Mã gốc
 * chỉ tồn tại đúng một lần trong email gửi đi.
 */
@Entity
@Table(name = "password_reset_tokens")
@Getter
@Setter
@NoArgsConstructor
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "token_id")
    private Long tokenId;

    // ManyToOne LAZY: hầu hết thao tác chỉ cần biết vé thuộc về ai chứ không cần cả bản ghi user.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // SHA-256 dạng hex luôn đúng 64 ký tự. unique để việc tra cứu theo mã là tra theo chỉ mục.
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    // Khác null = đã dùng rồi. Giữ lại bản ghi thay vì xoá để còn truy vết được là vé đã bị tiêu.
    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    /** Vé còn dùng được: chưa bị tiêu VÀ chưa quá hạn. */
    public boolean conHieuLuc() {
        return usedAt == null && LocalDateTime.now().isBefore(expiresAt);
    }
}
