package com.datn.repository;

import com.datn.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

        // products.slug có ràng buộc UNIQUE ở DB -- dùng để tìm hậu tố còn trống thay vì bốc đại rồi để
        // DB ném lỗi trùng (xem AdminProductService.resolveSlug).
        boolean existsBySlug(String slug);

        // @EntityGraph tránh N+1 khi load category/brand/images cho từng Product (service cần cả 3 field này).
        @EntityGraph(attributePaths = { "images", "category", "brand" })
        Page<Product> findByStatusOrderByCreatedAtDesc(Product.Status status, Pageable pageable);

        // Đồng bộ kho tri thức chatbot (InternalKbService): lấy toàn bộ sản phẩm đang bán, không phân
        // trang. Không phân trang càng cần @EntityGraph vì N+1 ở đây là cả catalog.
        @EntityGraph(attributePaths = { "variants", "category", "brand" })
        List<Product> findByStatus(Product.Status status);

        @EntityGraph(attributePaths = { "images", "category", "brand" })
        Page<Product> findByStatusAndCategory_CategoryIdOrderByCreatedAtDesc(
                        Product.Status status, Integer categoryId, Pageable pageable);

        // Xem danh mục cha thì gom luôn sản phẩm của danh mục con, vì sản phẩm chỉ gán trực tiếp vào danh mục lá.
        @EntityGraph(attributePaths = { "images", "category", "brand" })
        Page<Product> findByStatusAndCategory_CategoryIdInOrderByCreatedAtDesc(
                        Product.Status status, List<Integer> categoryIds, Pageable pageable);

        @EntityGraph(attributePaths = { "images", "category", "brand" })
        @Query("SELECT p FROM Product p WHERE p.status = 'ACTIVE' AND p.salePrice IS NOT NULL " +
                        "ORDER BY p.createdAt DESC")
        Page<Product> findOnSaleProducts(Pageable pageable);

        @EntityGraph(attributePaths = { "images", "category", "brand" })
        Page<Product> findByStatusAndProductNameContainingIgnoreCase(
                        Product.Status status, String keyword, Pageable pageable);

        // Trang quản trị: không lọc status để admin thấy cả sản phẩm ẩn/hết hàng.
        // Không thêm "variants" cùng "images" vào entity graph -- 2 bag collection fetch-join sẽ ném
        // MultipleBagFetchException; variants được batch-fetch riêng (ProductVariantRepository.findByProduct_ProductIdIn).
        // Khớp cả tên sản phẩm lẫn SKU biến thể (thu ngân gõ/quét mã SKU ở POS cũng ra đúng sản phẩm).
        //
        // "Chỉ hiện sắp hết hàng" phải lọc NGAY TRONG QUERY chứ không lọc ở frontend trên số bản ghi vừa
        // tải: lọc phía client chỉ soi được đúng trang hiện tại, mặt hàng sắp hết nằm ở trang sau sẽ biến
        // mất khỏi kết quả -> bảng trống khiến admin kết luận "kho vẫn ổn" trong khi thực tế ngược lại.
        //
        // Dùng EXISTS thay JOIN variants để không nhân dòng (DISTINCT + ORDER BY cột ngoài SELECT bị SQL
        // Server chặn).
        @EntityGraph(attributePaths = { "images", "category", "brand" })
        @Query("SELECT p FROM Product p WHERE " +
                        "(:keyword IS NULL OR :keyword = '' " +
                        " OR LOWER(p.productName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
                        " OR EXISTS (SELECT 1 FROM ProductVariant v WHERE v.product = p " +
                        "            AND LOWER(v.sku) LIKE LOWER(CONCAT('%', :keyword, '%')))) " +
                        "AND (:lowStockOnly = false OR EXISTS (SELECT 1 FROM ProductVariant v2 " +
                        "     WHERE v2.product = p AND v2.stockQuantity <= :lowStockThreshold))")
        Page<Product> searchForAdmin(
                        @Param("keyword") String keyword,
                        @Param("lowStockOnly") boolean lowStockOnly,
                        @Param("lowStockThreshold") int lowStockThreshold,
                        Pageable pageable);

        // Lọc trang Shop: danh mục (đã gom cả con) + từ khoá + giá + size/màu, tham số optional (null/rỗng
        // = bỏ qua). Dùng EXISTS thay vì JOIN v.size/v.color để tránh nhân dòng (JOIN cần DISTINCT, mà
        // DISTINCT + ORDER BY theo cột ngoài SELECT bị SQL Server chặn).
        //
        // Tách riêng 2 method (có/không categoryIds) thay vì 1 query dùng "IN :categoryIds" động, vì bind
        // null/rỗng cho tham số List dễ vỡ ở SQL Server -- không đơn giản như optional string.
        @EntityGraph(attributePaths = { "images", "category", "brand" })
        @Query("SELECT p FROM Product p WHERE p.status = :status " +
                        "AND (:keyword IS NULL OR :keyword = '' OR LOWER(p.productName) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
                        "AND (:minPrice IS NULL OR COALESCE(p.salePrice, p.price) >= :minPrice) " +
                        "AND (:maxPrice IS NULL OR COALESCE(p.salePrice, p.price) <= :maxPrice) " +
                        "AND (:size IS NULL OR :size = '' OR EXISTS (SELECT 1 FROM ProductVariant v WHERE v.product = p AND v.size = :size)) " +
                        "AND (:color IS NULL OR :color = '' OR EXISTS (SELECT 1 FROM ProductVariant v WHERE v.product = p AND v.color = :color)) " +
                        "ORDER BY p.createdAt DESC")
        Page<Product> filterProducts(
                        @Param("status") Product.Status status,
                        @Param("keyword") String keyword,
                        @Param("minPrice") BigDecimal minPrice,
                        @Param("maxPrice") BigDecimal maxPrice,
                        @Param("size") String size,
                        @Param("color") String color,
                        Pageable pageable);

        @EntityGraph(attributePaths = { "images", "category", "brand" })
        @Query("SELECT p FROM Product p WHERE p.status = :status " +
                        "AND p.category.categoryId IN :categoryIds " +
                        "AND (:keyword IS NULL OR :keyword = '' OR LOWER(p.productName) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
                        "AND (:minPrice IS NULL OR COALESCE(p.salePrice, p.price) >= :minPrice) " +
                        "AND (:maxPrice IS NULL OR COALESCE(p.salePrice, p.price) <= :maxPrice) " +
                        "AND (:size IS NULL OR :size = '' OR EXISTS (SELECT 1 FROM ProductVariant v WHERE v.product = p AND v.size = :size)) " +
                        "AND (:color IS NULL OR :color = '' OR EXISTS (SELECT 1 FROM ProductVariant v WHERE v.product = p AND v.color = :color)) " +
                        "ORDER BY p.createdAt DESC")
        Page<Product> filterProductsByCategory(
                        @Param("status") Product.Status status,
                        @Param("categoryIds") List<Integer> categoryIds,
                        @Param("keyword") String keyword,
                        @Param("minPrice") BigDecimal minPrice,
                        @Param("maxPrice") BigDecimal maxPrice,
                        @Param("size") String size,
                        @Param("color") String color,
                        Pageable pageable);

        // "Đã xem gần đây" (LandingPage, ids đọc từ localStorage FE) -- FE luôn truyền list không rỗng
        // nên bind List an toàn, không như categoryIds ở filterProductsByCategory.
        @EntityGraph(attributePaths = { "images", "category", "brand" })
        List<Product> findByProductIdInAndStatus(List<Long> productIds, Product.Status status);
}
