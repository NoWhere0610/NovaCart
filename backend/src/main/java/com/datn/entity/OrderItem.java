package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;

/**
 * 1 dòng sản phẩm trong đơn hàng. Snapshot tên/size/color/đơn giá tại thời điểm đặt hàng (không join
 * sống sang Product/ProductVariant), để hoá đơn cũ không đổi theo khi admin sửa giá/tên sau này.
 */
@Entity
// order_id có FK nhưng không có index riêng -- cần vì mỗi lần xem chi tiết đơn đều query theo order_id.
@Table(name = "order_items", indexes = @Index(name = "idx_order_items_order_id", columnList = "order_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_item_id")
    private Long orderItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    // Giữ liên kết variant gốc để thống kê "sản phẩm bán chạy" -- không dùng để hiển thị, dùng field snapshot bên dưới.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id")
    private ProductVariant variant;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    @Column(name = "size", length = 20)
    private String size;

    @Column(name = "color", length = 50)
    private String color;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;
}