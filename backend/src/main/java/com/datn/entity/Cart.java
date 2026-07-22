package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Giỏ hàng — mỗi User chỉ có DUY NHẤT 1 Cart (quan hệ 1-1), Cart được tạo
 * tự động (lazy) ngay lần đầu tiên user thêm sản phẩm vào giỏ, không tạo
 * sẵn lúc đăng ký để tránh rác dữ liệu cho user không mua sắm.
 */
@Entity
@Table(name = "carts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Cart {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cart_id")
    private Long cartId;

    // unique = true để đảm bảo ở tầng DB mỗi user chỉ có 1 giỏ hàng
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // cascade ALL + orphanRemoval: xoá CartItem khỏi list này (vd khi checkout xong,
    // xoá sạch giỏ hàng) thì Hibernate tự DELETE record tương ứng trong DB,
    // không cần tự viết cartItemRepository.delete() thủ công từng dòng.
    @OneToMany(mappedBy = "cart", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CartItem> items = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}