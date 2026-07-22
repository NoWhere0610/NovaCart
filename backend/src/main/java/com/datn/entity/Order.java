package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Đơn hàng. Địa chỉ giao hàng được SNAPSHOT (copy) trực tiếp vào các cột
 * receiver_name/phone/... của Order ngay lúc đặt hàng, thay vì chỉ giữ
 * address_id trỏ tới bảng addresses — vì nếu user sau này SỬA hoặc XOÁ địa
 * chỉ đó, đơn hàng cũ (đã giao/đang giao) không được phép bị thay đổi theo.
 * Đây là nguyên tắc bắt buộc trong nghiệp vụ đơn hàng thực tế.
 */
@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    /** Trạng thái xử lý đơn hàng, đi theo đúng 1 chiều (không nhảy cóc ngược lại). */
    public enum Status {
        PENDING,     // vừa đặt, chờ xác nhận
        CONFIRMED,   // đã xác nhận, chuẩn bị hàng
        SHIPPING,    // đang giao
        COMPLETED,   // đã giao thành công
        CANCELLED    // đã huỷ (chỉ huỷ được khi còn PENDING/CONFIRMED)
    }

    public enum PaymentMethod {
        COD,            // thanh toán khi nhận hàng
        BANK_TRANSFER,  // chuyển khoản (đồ án: đánh dấu thủ công / demo, chưa nối cổng thanh toán thật)
        VNPAY,          // DB đã có sẵn CHECK constraint cho phép giá trị này (chưa nối cổng thanh toán thật)
        MOMO
    }

    // DB có sẵn cột payment_status (CHECK: UNPAID/PAID/REFUNDED) — thêm enum
    // tương ứng để entity khớp đầy đủ với DB, dù đồ án hiện chưa có luồng
    // tự động chuyển PAID (chưa nối cổng thanh toán thật, admin có thể tự cập nhật thủ công)
    public enum PaymentStatus {
        UNPAID, PAID, REFUNDED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long orderId;

    // QUAN TRỌNG: cột order_code trong DB có UNIQUE constraint, và SQL Server
    // chỉ cho phép ĐÚNG 1 dòng NULL trong 1 UNIQUE constraint (khác Postgres/MySQL
    // cho phép nhiều NULL) — nếu để trống, đơn hàng thứ 2 trở đi sẽ INSERT lỗi
    // vi phạm unique constraint. BẮT BUỘC phải luôn set giá trị duy nhất khi tạo
    // đơn (xem OrderService.checkout() -> generateOrderCode()).
    @Column(name = "order_code", unique = true, length = 50)
    private String orderCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // ----- snapshot địa chỉ giao hàng tại thời điểm đặt -----
    @Column(name = "receiver_name", nullable = false, length = 100)
    private String receiverName;

    @Column(name = "phone", nullable = false, length = 20)
    private String phone;

    @Column(name = "shipping_address", nullable = false, length = 500)
    private String shippingAddress;
    // ----- hết phần snapshot -----

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    // ----- Sprint 4: áp mã giảm giá -----
    // Tổng tiền hàng TRƯỚC khi áp voucher (= tổng subtotal của các OrderItem)
    @Column(name = "subtotal_amount", precision = 12, scale = 2)
    private BigDecimal subtotalAmount;

    // Số tiền được giảm nhờ voucher — 0 nếu không dùng mã nào
    @Column(name = "discount_amount", precision = 12, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    // SNAPSHOT mã đã dùng (không lưu voucher_id tham chiếu động) — cùng lý do
    // với việc snapshot địa chỉ/tên sản phẩm: voucher có thể bị admin xoá/sửa
    // sau này nhưng hoá đơn cũ phải giữ nguyên đã dùng mã gì
    @Column(name = "voucher_code", length = 50)
    private String voucherCode;
    // ----- hết phần voucher -----

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", length = 20)
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}