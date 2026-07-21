package com.datn.repository;

import com.datn.entity.Cart;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CartRepository extends JpaRepository<Cart, Long> {

    // @EntityGraph: load sẵn items + variant + product trong CÙNG 1 query
    // (tránh N+1 query khi service duyệt qua từng CartItem để tính tiền)
    @EntityGraph(attributePaths = {"items", "items.variant", "items.variant.product"})
    Optional<Cart> findByUser_UserId(Long userId);
}