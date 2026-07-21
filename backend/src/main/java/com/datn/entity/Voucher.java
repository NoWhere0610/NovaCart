package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Mã giảm giá — map ĐÚNG theo bảng vouchers THẬT trong DB (khác với bản
 * thiết kế ban đầu). Lưu ý các khác biệt so với bản nháp trước:
 *  - Cột là min_order_value (không phải min_order_amount)
 *  - KHÔNG có max_discount_amount ở DB gốc -> field này map tới cột được
 *    bổ sung thêm qua migration (xem sprint4_migration_fix.sql), có thể
 *    NULL nếu bạn chưa chạy migration đó.
 *  - KHÔNG có used_count ở DB gốc -> cũng là cột bổ sung thêm qua migration.
 *  - discount_type CHECK constraint chỉ cho 'PERCENT' hoặc 'AMOUNT'
 *    (KHÔNG phải 'FIXED' như bản trước) -> đổi tên enum tương ứng.
 *  - start_date/end_date là DATE (không có giờ), không phải DATETIME2.
 */
@Entity
@Table(name = "vouchers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Voucher {

    public enum DiscountType {
        PERCENT,  // giảm theo %
        AMOUNT    // giảm số tiền cố định (tên khớp đúng giá trị CHECK constraint trong DB)
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "voucher_id")
    private Integer voucherId;

    @Column(name = "code", nullable = false, unique = true, length = 50)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 10)
    private DiscountType discountType;

    @Column(name = "discount_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountValue;

    // ĐÚNG tên cột thật trong DB: min_order_value (không phải min_order_amount)
    @Column(name = "min_order_value", precision = 12, scale = 2)
    private BigDecimal minOrderValue;

    // Cột bổ sung qua migration (sprint4_migration_fix.sql) - có thể NULL nếu
    // chưa chạy migration, code tự xử lý null-safe (xem VoucherService)
    @Column(name = "max_discount_amount", precision = 12, scale = 2)
    private BigDecimal maxDiscountAmount;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "usage_limit")
    private Integer usageLimit;

    // Cột bổ sung qua migration - mặc định 0 nếu chưa migrate
    @Column(name = "used_count")
    private Integer usedCount = 0;

    @Column(name = "is_active")
    private Boolean isActive = true;
}