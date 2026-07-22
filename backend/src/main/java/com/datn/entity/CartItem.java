package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * 1 dòng trong giỏ hàng = 1 ProductVariant (đã chọn size + color cụ thể) + số lượng.
 * KHÔNG lưu variant_id trùng nhau 2 lần trong cùng 1 giỏ — nếu user thêm lại
 * variant đã có sẵn thì service sẽ CỘNG DỒN quantity thay vì tạo dòng mới
 * (đảm bảo bằng unique constraint (cart_id, variant_id) ở tầng DB).
 */
@Entity
@Table(
    name = "cart_items",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_cart_variant",
        columnNames = {"cart_id", "variant_id"}
    )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CartItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cart_item_id")
    private Long cartItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cart_id", nullable = false)
    private Cart cart;

    // LAZY nhưng service sẽ luôn cần join thêm Product để lấy giá/tên/ảnh hiện tại
    // -> dùng JOIN FETCH ở repository khi cần hiển thị, tránh N+1 query
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariant variant;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;
}