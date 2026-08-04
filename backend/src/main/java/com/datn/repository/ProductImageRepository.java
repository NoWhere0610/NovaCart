package com.datn.repository;

import com.datn.entity.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {

    // Batch-load ảnh cho nhiều sản phẩm trong 1 query, tránh lazy-load từng dòng -- không gộp vào
    // @EntityGraph của Cart vì Cart đã fetch-join "items", thêm "images" sẽ gây MultipleBagFetchException.
    List<ProductImage> findByProduct_ProductIdInOrderByDisplayOrderAsc(List<Long> productIds);
}