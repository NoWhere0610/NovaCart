package com.datn.repository;

import com.datn.entity.ProductVariant;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    // Batch-load variant cho nhiều sản phẩm trong 1 query, tránh lazy-load từng dòng -- không gộp vào
    // @EntityGraph của ProductRepository vì sẽ đụng "images", 2 bag collection trong 1 query gây lỗi.
    List<ProductVariant> findByProduct_ProductIdIn(List<Long> productIds);

    // Load kèm Product để CartService lấy tên/giá/ảnh trong 1 lần query.
    @EntityGraph(attributePaths = {"product"})
    Optional<ProductVariant> findById(Long variantId);

    // Dùng đúng ở các điểm ĐỌC-KIỂM TRA-RỒI-TRỪ kho (PosOrderService.addItem/updateItemQuantity,
    // AdminOrderService.updateStatus lúc PENDING->CONFIRMED) -- khoá row tới hết transaction, chặn 2
    // request cùng lúc đọc trùng số tồn rồi cùng trừ, có thể đẩy kho về âm. KHÔNG dùng cho findById()
    // mặc định (đọc thường) vì khoá không cần thiết sẽ làm chậm mọi truy vấn đọc trong hệ thống.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"product"})
    @Query("SELECT v FROM ProductVariant v WHERE v.variantId = :variantId")
    Optional<ProductVariant> findByIdForUpdate(@Param("variantId") Long variantId);

    // Màn "Kho tồn hàng": tìm theo tên sản phẩm/SKU/size/màu, kèm lọc "sắp hết hàng", xử lý ngay trong
    // 1 query để Pageable trả đúng tổng số bản ghi.
    @EntityGraph(attributePaths = {"product", "product.category"})
    @Query("SELECT v FROM ProductVariant v WHERE " +
            "(:keyword IS NULL OR :keyword = '' " +
            " OR LOWER(v.product.productName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            " OR LOWER(v.sku) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            " OR LOWER(v.size) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            " OR LOWER(v.color) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
            "AND (:lowStockOnly = false OR v.stockQuantity <= :lowStockThreshold)")
    Page<ProductVariant> search(
            @Param("keyword") String keyword,
            @Param("lowStockOnly") boolean lowStockOnly,
            @Param("lowStockThreshold") int lowStockThreshold,
            Pageable pageable);

    boolean existsByProduct_ProductIdAndSizeAndColor(Long productId, String size, String color);

    // Cảnh báo tồn kho thấp cho trang Thống kê -- top 10 biến thể ít hàng nhất, kèm sẵn Product để lấy tên.
    @EntityGraph(attributePaths = {"product"})
    List<ProductVariant> findTop10ByStockQuantityLessThanEqualOrderByStockQuantityAsc(int threshold);
}