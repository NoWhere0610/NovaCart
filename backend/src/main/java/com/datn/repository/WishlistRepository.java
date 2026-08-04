package com.datn.repository;

import com.datn.entity.Wishlist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface WishlistRepository extends JpaRepository<Wishlist, Long> {

    boolean existsByUser_UserIdAndProduct_ProductId(Long userId, Long productId);

    @Transactional
    void deleteByUser_UserIdAndProduct_ProductId(Long userId, Long productId);

    // Danh sách RIÊNG chỉ productId -- dùng để tô đậm icon trái tim trên khắp nơi (Shop/Landing/chi
    // tiết sản phẩm) mà KHÔNG cần tải cả object Product, chỉ cần biết "đã lưu hay chưa".
    @Query("SELECT w.product.productId FROM Wishlist w WHERE w.user.userId = :userId")
    List<Long> findProductIdsByUser_UserId(@Param("userId") Long userId);

    // Trang "Sản phẩm yêu thích" -- cần đủ thông tin Product để hiển thị dạng lưới giống ShopPage.
    @EntityGraph(attributePaths = { "product", "product.images", "product.category", "product.brand" })
    Page<Wishlist> findByUser_UserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
