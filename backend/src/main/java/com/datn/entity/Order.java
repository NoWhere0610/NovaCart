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
     * Trạng thái đơn hàng, đi 1 chiều: Chờ thanh toán -> Chờ vận chuyển -> Chờ giao hàng -> Cần đánh giá
     * -> Hoàn thành, có thể rẽ Huỷ (đầu luồng) hoặc Trả hàng/Hoàn tiền (cuối luồng).
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

    /** Nguồn tạo đơn: khách đặt qua web (ONLINE) hay nhân viên bán tại quầy (POS). */
    public enum OrderType {
        ONLINE, POS
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "order_code", unique = true, length = 50)
    private String orderCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = true)
    private User user;

    // Đơn POS có thể là khách vãng lai không có tài khoản -> user null.
    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", nullable = false, length = 10)
    private OrderType orderType = OrderType.ONLINE;

    // Nhân viên đứng bán (role ADMIN, không phân biệt STAFF riêng) -- chỉ có giá trị với đơn POS.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cashier_id")
    private User cashier;

    // Nullable vì đơn POS không có bước giao hàng; validate bắt buộc cho đơn ONLINE ở tầng Service.
    @Column(name = "receiver_name", length = 100)
    private String receiverName;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "shipping_address", length = 500)
    private String shippingAddress;

    // Phí vận chuyển (0 với đơn POS, tính theo ShippingService cho đơn ONLINE)
    @Column(name = "shipping_fee", precision = 12, scale = 2)
    private BigDecimal shippingFee = BigDecimal.ZERO;

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

    // Lý do trả hàng/hoàn tiền, chỉ có giá trị khi status là RETURN_REQUESTED/RETURNED.
    @Column(name = "return_reason", length = 500)
    private String returnReason;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Optimistic lock -- 2 request cùng load rồi cùng sửa 1 đơn (vd double-click checkout, admin xác
    // nhận trùng lúc khách huỷ, POS checkout/huỷ cùng lúc) thì request save() SAU sẽ bị JPA ném
    // ObjectOptimisticLockingFailureException thay vì âm thầm ghi đè -- xem GlobalExceptionHandler.
    @Version
    @Column(name = "version")
    private Long version;

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