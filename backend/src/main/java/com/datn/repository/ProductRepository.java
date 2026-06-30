package com.datn.repository;

import com.datn.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, Long> {

    Page<Product> findByStatusOrderByCreatedAtDesc(Product.Status status, Pageable pageable);

    Page<Product> findByStatusAndCategory_CategoryIdOrderByCreatedAtDesc(
            Product.Status status, Integer categoryId, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.status = 'ACTIVE' AND p.salePrice IS NOT NULL " +
           "ORDER BY p.createdAt DESC")
    Page<Product> findOnSaleProducts(Pageable pageable);

    Page<Product> findByStatusAndProductNameContainingIgnoreCase(
            Product.Status status, String keyword, Pageable pageable);
}
