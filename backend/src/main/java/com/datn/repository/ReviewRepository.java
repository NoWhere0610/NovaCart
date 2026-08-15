package com.datn.repository;

import com.datn.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    @EntityGraph(attributePaths = {"user"})
    Page<Review> findByProduct_ProductId(Long productId, Pageable pageable);

    Optional<Review> findByProduct_ProductIdAndUser_UserId(Long productId, Long userId);

    @Query("select coalesce(avg(r.rating), 0) from Review r where r.product.productId = :productId")
    Double findAverageRatingByProductId(Long productId);

    long countByProduct_ProductId(Long productId);

    // Phân bố số lượng đánh giá theo từng mức sao (1-5) -- mỗi phần tử: Object[]{ rating, count }.
    @Query("select r.rating, count(r) from Review r where r.product.productId = :productId group by r.rating")
    List<Object[]> countByRatingGrouped(Long productId);
}