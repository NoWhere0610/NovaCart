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

    // Chỉ lấy productId, không tải cả Product -- dùng để tô icon trái tim đã lưu hay chưa.
    @Query("SELECT w.product.productId FROM Wishlist w WHERE w.user.userId = :userId")
    List<Long> findProductIdsByUser_UserId(@Param("userId") Long userId);

    // Trang "Sản phẩm yêu thích": cần đủ thông tin Product để hiển thị dạng lưới.
    // Lọc theo status như mọi truy vấn phía khách hàng -- sản phẩm đã ẩn/ngừng bán không được hiện lẫn
    // vào danh sách yêu thích như hàng đang bán. Lọc trong query (không lọc sau khi map) để Page trả đúng
    // tổng số bản ghi, phân trang không bị hụt.
    @EntityGraph(attributePaths = { "product", "product.images", "product.category", "product.brand" })
    Page<Wishlist> findByUser_UserIdAndProduct_StatusOrderByCreatedAtDesc(
            Long userId, com.datn.entity.Product.Status status, Pageable pageable);
}
