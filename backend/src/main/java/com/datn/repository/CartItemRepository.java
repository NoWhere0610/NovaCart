package com.datn.repository;

import com.datn.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {

    // Kiểm tra variant này đã có sẵn trong giỏ chưa -> nếu có thì cộng dồn quantity
    // thay vì tạo dòng mới (tránh vi phạm unique constraint uq_cart_variant)
    Optional<CartItem> findByCart_CartIdAndVariant_VariantId(Long cartId, Long variantId);
}