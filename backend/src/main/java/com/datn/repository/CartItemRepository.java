package com.datn.repository;

import com.datn.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {

    // Kiểm tra variant đã có trong giỏ chưa -> nếu có thì cộng dồn quantity thay vì tạo dòng mới
    // (tránh vi phạm unique constraint uq_cart_variant).
    Optional<CartItem> findByCart_CartIdAndVariant_VariantId(Long cartId, Long variantId);

    // Như OrderItemRepository.existsByVariant_VariantId: cart_items.variant_id cũng là FK không CASCADE,
    // biến thể đang nằm trong giỏ của khách nào đó thì không xoá được.
    boolean existsByVariant_VariantId(Long variantId);
}