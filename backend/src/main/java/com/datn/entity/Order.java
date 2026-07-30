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

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    /**
     * Trạng thái xử lý đơn hàng, đi theo đúng 1 chiều (không nhảy cóc ngược lại),
     * mô phỏng đúng luồng của các sàn TMĐT lớn (Shopee/TikTok Shop):
     * Chờ thanh toán -> Chờ vận chuyển -> Chờ giao hàng -> Cần đánh giá -> Hoàn thành,
     * có thể rẽ nhánh sang Huỷ (đầu luồng) hoặc Trả hàng/Hoàn tiền (cuối luồng).
     */
    public enum Status {
        PENDING,           // vừa đặt, chờ thanh toán / chờ người bán xác nhận
        CONFIRMED,         // đã xác nhận, đang chuẩn bị hàng -> chờ vận chuyển
        SHIPPING,          // đã giao cho đơn vị vận chuyển -> chờ nhận hàng
        DELIVERED,         // đã giao thành công tới khách -> cần đánh giá
        COMPLETED,         // khách đã đánh giá (hoặc xác nhận hoàn tất) -> hoàn thành
        CANCELLED,         // đã huỷ (chỉ huỷ được khi còn PENDING/CONFIRMED)
        RETURN_REQUESTED,  // khách yêu cầu trả hàng/hoàn tiền, chờ admin duyệt
        RETURNED           // admin đã duyệt trả hàng/hoàn tiền
    }

    public enum PaymentMethod {
        COD,
        BANK_TRANSFER,
        VNPAY,
        MOMO
    }

    public enum PaymentStatus {
        UNPAID, PAID, REFUNDED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "order_code", unique = true, length = 50)
    private String orderCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "receiver_name", nullable = false, length = 100)
    private String receiverName;

    @Column(name = "phone", nullable = false, length = 20)
    private String phone;

    @Column(name = "shipping_address", nullable = false, length = 500)
    private String shippingAddress;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "subtotal_amount", precision = 12, scale = 2)
    private BigDecimal subtotalAmount;

    @Column(name = "discount_amount", precision = 12, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "voucher_code", length = 50)
    private String voucherCode;

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

    // Lý do khách nhập khi bấm "Yêu cầu trả hàng/hoàn tiền" (chỉ có giá trị khi
    // status là RETURN_REQUESTED/RETURNED) — cột mới, Hibernate tự ALTER TABLE
    // thêm cột này vì ddl-auto=update (không cần migrate tay như cột status).
    @Column(name = "return_reason", length = 500)
    private String returnReason;

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