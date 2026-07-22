package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;

/**
 * 1 dòng sản phẩm trong đơn hàng. Cũng giống Order, SNAPSHOT lại tên sản
 * phẩm/size/color/đơn giá tại thời điểm đặt hàng thay vì chỉ join sang
 * Product/ProductVariant — vì nếu admin sau này đổi tên/giá sản phẩm, hoá
 * đơn cũ của khách KHÔNG được phép đổi theo (khách phải luôn xem lại đúng
 * giá mình đã trả lúc mua).
 */
@Entity
@Table(name = "order_items")
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

    // Vẫn giữ liên kết tới variant gốc (phục vụ thống kê "sản phẩm bán chạy"),
    // nhưng KHÔNG dùng field này để hiển thị tên/giá cho khách - dùng các field snapshot bên dưới
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