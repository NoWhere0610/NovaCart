package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Ghi nhận "người này đã dùng mã này rồi" -- mỗi khách chỉ được dùng mỗi mã MỘT lần.
 *
 * VÌ SAO CẦN BẢNG RIÊNG: Voucher chỉ có usedCount là một con số đếm TỔNG, không biết ai đã dùng. Với
 * usageLimit = 100 thì một khách có thể tự dùng hết cả 100 lượt -- chương trình khuyến mãi nhắm tới
 * 100 người hoá ra phục vụ đúng một người.
 *
 * Ràng buộc DUY NHẤT trên (voucher_id, user_id) mới là thứ thực sự chặn, không phải câu lệnh kiểm tra
 * trong Java: hai lần đặt hàng SONG SONG của cùng một khách đều có thể đọc thấy "chưa dùng" trước khi
 * ai kịp ghi. Cơ sở dữ liệu từ chối bản ghi thứ hai, GlobalExceptionHandler đổi thành lỗi 409 cho
 * người dùng thay vì để lọt cả hai.
 *
 * KHÔNG áp dụng cho đơn bán tại quầy (POS): hoá đơn POS không gắn với tài khoản khách nào (khách vãng
 * lai), nên không có "người" để giới hạn -- xem PosOrderService.
 */
@Entity
@Table(
        name = "voucher_usages",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_voucher_usage_user",
                columnNames = {"voucher_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
public class VoucherUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "usage_id")
    private Long usageId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "voucher_id", nullable = false)
    private Voucher voucher;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Đơn nào đã dùng -- chỉ để truy vết khi cần đối chiếu, không tham gia vào ràng buộc nào. */
    @Column(name = "order_code", length = 50, columnDefinition = "nvarchar(50)")
    private String orderCode;

    @Column(name = "used_at", nullable = false)
    private LocalDateTime usedAt;

    @PrePersist
    protected void onCreate() {
        this.usedAt = LocalDateTime.now();
    }
}
