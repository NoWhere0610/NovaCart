package com.datn.repository;

import com.datn.entity.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {

    // Dùng để batch-load ảnh cho NHIỀU sản phẩm cùng lúc (VD: giỏ hàng) trong 1 query duy nhất, thay vì
    // lazy-load product.getImages() riêng cho từng dòng -- KHÔNG gộp chung vào @EntityGraph của Cart vì
    // Cart đã có 1 collection "items" fetch bằng JOIN FETCH, nhồi thêm 1 collection "images" nữa vào
    // CÙNG entity graph sẽ bị Hibernate MultipleBagFetchException (2 List fetch join trong 1 query).
    List<ProductImage> findByProduct_ProductIdInOrderByDisplayOrderAsc(List<Long> productIds);
}