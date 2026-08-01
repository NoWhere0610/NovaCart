package com.datn.repository;

import com.datn.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

        Page<Product> findByStatusOrderByCreatedAtDesc(Product.Status status, Pageable pageable);

        Page<Product> findByStatusAndCategory_CategoryIdOrderByCreatedAtDesc(
                        Product.Status status, Integer categoryId, Pageable pageable);

        // Mới thêm: khi xem 1 danh mục CHA (VD: "Áo"), gom luôn sản phẩm của toàn bộ
        // danh mục CON bên trong (VD: áo thun, áo sơ mi...) — vì sản phẩm chỉ được
        // gán trực tiếp vào danh mục lá, xem thẳng danh mục cha sẽ trống nếu không gom.
        Page<Product> findByStatusAndCategory_CategoryIdInOrderByCreatedAtDesc(
                        Product.Status status, List<Integer> categoryIds, Pageable pageable);

        @Query("SELECT p FROM Product p WHERE p.status = 'ACTIVE' AND p.salePrice IS NOT NULL " +
                        "ORDER BY p.createdAt DESC")
        Page<Product> findOnSaleProducts(Pageable pageable);

        Page<Product> findByStatusAndProductNameContainingIgnoreCase(
                        Product.Status status, String keyword, Pageable pageable);

        // Dành riêng cho trang quản trị: KHÔNG lọc theo status, admin cần thấy cả
        // sản phẩm đang ẩn (INACTIVE) hoặc hết hàng (OUT_OF_STOCK) để quản lý
        Page<Product> findByProductNameContainingIgnoreCase(String keyword, Pageable pageable);
}
