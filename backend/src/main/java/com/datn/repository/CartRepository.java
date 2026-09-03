package com.datn.repository;

import com.datn.entity.Cart;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CartRepository extends JpaRepository<Cart, Long> {

    // @EntityGraph: load sẵn items + variant + product trong CÙNG 1 query
    // (tránh N+1 query khi service duyệt qua từng CartItem để tính tiền)
    @EntityGraph(attributePaths = {"items", "items.variant", "items.variant.product"})
    Optional<Cart> findByUser_UserId(Long userId);

    // Dùng ở các thao tác MUTATE giỏ hàng (thêm sản phẩm, checkout) -- khoá row Cart tới hết transaction,
    // tránh 2 request cùng lúc đọc trùng state cũ của giỏ rồi cùng ghi (double-click "Đặt hàng" tạo 2 đơn
    // trùng cho cùng 1 giỏ, hoặc 2 lần "Thêm vào giỏ" làm mất 1 lần cộng dồn số lượng).
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"items", "items.variant", "items.variant.product"})
    @Query("SELECT c FROM Cart c WHERE c.user.userId = :userId")
    Optional<Cart> findByUser_UserIdForUpdate(@Param("userId") Long userId);
}