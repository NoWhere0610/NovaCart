package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(
    name = "product_variants",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_product_size_color",
        columnNames = {"product_id", "size", "color"}
    )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProductVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "variant_id")
    private Long variantId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "size", nullable = false, length = 20)
    private String size;

    @Column(name = "color", nullable = false, length = 50)
    private String color;

    @Column(name = "sku", unique = true, length = 100)
    private String sku;

    @Column(name = "stock_quantity")
    private Integer stockQuantity = 0;
}
