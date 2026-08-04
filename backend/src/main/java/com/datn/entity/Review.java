package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * Đánh giá sản phẩm. Ràng buộc nghiệp vụ (kiểm tra ở ReviewService, KHÔNG
 * phải ở entity): user chỉ được đánh giá 1 sản phẩm sau khi có ít nhất 1
 * đơn hàng chứa sản phẩm đó ở trạng thái COMPLETED — tránh review ảo/spam
 * từ người chưa từng mua hàng thật.
 */
@Entity
@Table(
    name = "reviews",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_review_user_product",
        columnNames = {"user_id", "product_id"}
    ),
    // uq_review_user_product ở trên KHÔNG phục vụ được query lọc riêng theo product_id (composite unique
    // bắt đầu bằng user_id -- không dùng được nếu thiếu user_id ở điều kiện WHERE). ReviewRepository lại
    // gọi findByProduct_ProductId/countByProduct_ProductId riêng trên MỌI trang chi tiết sản phẩm -> cần
    // thêm index riêng cho product_id.
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