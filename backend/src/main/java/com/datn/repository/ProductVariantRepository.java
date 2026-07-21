package com.datn.repository;

import com.datn.entity.ProductVariant;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    // Load kèm Product ngay để CartService lấy được tên/giá/ảnh sản phẩm
    // trong 1 lần query, không phải query thêm lần 2
    @EntityGraph(attributePaths = {"product"})
    Optional<ProductVariant> findById(Long variantId);
}