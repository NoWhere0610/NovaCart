package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * 1 dòng giỏ hàng = 1 ProductVariant + số lượng. Không trùng variant_id trong cùng giỏ -- thêm lại
 * variant có sẵn thì service cộng dồn quantity (đảm bảo bằng unique constraint (cart_id, variant_id)).
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

    // LAZY nhưng service cần join Product để lấy giá/tên/ảnh -- dùng JOIN FETCH ở repository khi hiển thị.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariant variant;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;
}