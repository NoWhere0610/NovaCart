package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * Đánh giá sản phẩm. Ràng buộc nghiệp vụ (ở ReviewService, không phải entity): chỉ được đánh giá
 * sau khi có đơn hàng COMPLETED chứa sản phẩm đó -- tránh review ảo.
 */
@Entity
@Table(
    name = "reviews",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_review_user_product",
        columnNames = {"user_id", "product_id"}
    ),
    // uq_review_user_product không phục vụ được query lọc riêng theo product_id (composite unique bắt
    // đầu bằng user_id) -- cần thêm index riêng vì ReviewRepository query theo product_id trên mọi trang chi tiết.
    indexes = @Index(name = "idx_reviews_product_id", columnList = "product_id")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "review_id")
    private Long reviewId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "rating", nullable = false)
    private Integer rating;

    @Column(name = "comment", length = 1000)
    private String comment;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}