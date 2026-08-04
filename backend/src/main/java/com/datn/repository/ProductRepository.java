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

        // @EntityGraph trên các query TRẢ VỀ NHIỀU dòng (list/search) -- nếu không có, mỗi Product trong
        // trang load lazy riêng category/brand/images (N+1: 1 query lấy N sản phẩm + N*3 query phụ), vì
        // toProductResponse()/toResponse() ở service đều đọc getCategory()/getBrand()/getImages().
        @EntityGraph(attributePaths = { "images", "category", "brand" })
        Page<Product> findByStatusOrderByCreatedAtDesc(Product.Status status, Pageable pageable);

        // Dùng cho đồng bộ kho tri thức chatbot (InternalKbService) -- lấy TOÀN BỘ sản phẩm đang bán,
        // không phân trang (quy mô danh mục 1 shop, vài trăm-nghìn sản phẩm là ổn cho đồng bộ 1 lần/ngày).
        // KHÔNG phân trang càng cần @EntityGraph -- N ở đây là CẢ catalog, N+1 nặng nhất trong toàn hệ thống.
        @EntityGraph(attributePaths = { "variants", "category", "brand" })
        List<Product> findByStatus(Product.Status status);

        @EntityGraph(attributePaths = { "images", "category", "brand" })
        Page<Product> findByStatusAndCategory_CategoryIdOrderByCreatedAtDesc(
                        Product.Status status, Integer categoryId, Pageable pageable);

        // Mới thêm: khi xem 1 danh mục CHA (VD: "Áo"), gom luôn sản phẩm của toàn bộ
        // danh mục CON bên trong (VD: áo thun, áo sơ mi...) — vì sản phẩm chỉ được
        // gán trực tiếp vào danh mục lá, xem thẳng danh mục cha sẽ trống nếu không gom.
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

        // Dành riêng cho trang quản trị: KHÔNG lọc theo status, admin cần thấy cả
        // sản phẩm đang ẩn (INACTIVE) hoặc hết hàng (OUT_OF_STOCK) để quản lý.
        // KHÔNG thêm "variants" vào đây cùng "images" -- 2 collection (@OneToMany List, tức "bag" trong
        // thuật ngữ Hibernate) fetch-join trong CÙNG 1 entity graph sẽ ném MultipleBagFetchException lúc
        // chạy. AdminProductService batch-fetch variants riêng (xem ProductVariantRepository.findByProduct_ProductIdIn).
        @EntityGraph(attributePaths = { "images", "category", "brand" })
        Page<Product> findByProductNameContainingIgnoreCase(String keyword, Pageable pageable);

        // Override findAll(Pageable) có sẵn của JpaRepository để gắn @EntityGraph -- nhánh admin KHÔNG
        // có từ khoá tìm kiếm (AdminProductService.list) gọi thẳng findAll(Pageable), không phải 1 trong
        // các query riêng ở trên. Lý do không có "variants": xem comment ở method ngay trên.
        @Override
        @EntityGraph(attributePaths = { "images", "category", "brand" })
        Page<Product> findAll(Pageable pageable);

        // Lọc trang Shop: danh mục (đã gom cả con) + từ khoá + khoảng giá + size/màu -- tất cả tham số
        // đều optional (NULL/rỗng = không lọc theo tiêu chí đó). Dùng EXISTS thay vì JOIN v.size/v.color
        // trực tiếp -- JOIN sẽ nhân dòng (1 sản phẩm có nhiều variant khớp = nhiều dòng trùng), phải
        // DISTINCT, mà DISTINCT + ORDER BY theo cột không có trong SELECT lại bị SQL Server chặn. EXISTS
        // không nhân dòng nên tránh được cả 2 vấn đề, không cần DISTINCT.
        //
        // 2 method RÕ RÀNG (có/không categoryIds) thay vì 1 query dùng "(:categoryIds IS NULL OR ... IN
        // :categoryIds)" -- JPQL "IN :param" cần Hibernate expand param thành danh sách placeholder THẬT
        // lúc chuẩn bị câu lệnh, bind null/rỗng cho tham số kiểu List dễ vỡ (ném lỗi hoặc IN() không hợp
        // lệ ở SQL Server) chứ không đơn giản là "không lọc" như optional string ở trên. Giữ 2 method
        // tách biệt để KHÔNG BAO GIỜ phải bind null cho tham số List, khớp cách retrieveChunks() bên
        // chatbot (ragQuery.js) đã xử lý allowedFolders optional -- xem comment ở đó.
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

        // "Đã xem gần đây" (LandingPage, danh sách productId đọc từ localStorage FE) -- KHÔNG phân
        // trang nên list ids này luôn do FE truyền vào TRỰC TIẾP, không rỗng (FE tự bỏ qua việc gọi API
        // này khi chưa xem sản phẩm nào), nên bind List an toàn (không rơi vào rủi ro null/rỗng như
        // categoryIds ở filterProductsByCategory).
        @EntityGraph(attributePaths = { "images", "category", "brand" })
        List<Product> findByProductIdInAndStatus(List<Long> productIds, Product.Status status);
}
