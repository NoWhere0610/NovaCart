package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.review.CreateReviewRequest;
import com.datn.dto.review.ProductRatingSummary;
import com.datn.dto.review.ReviewResponse;
import com.datn.entity.Order;
import com.datn.entity.Product;
import com.datn.entity.Review;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.OrderItemRepository;
import com.datn.repository.ProductRepository;
import com.datn.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> getByProduct(Long productId, int page, int size) {
        Page<Review> reviews = reviewRepository.findByProduct_ProductId(
                productId, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.from(reviews.map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public ProductRatingSummary getRatingSummary(Long productId) {
        Double avg = reviewRepository.findAverageRatingByProductId(productId);
        long count = reviewRepository.countByProduct_ProductId(productId);
        return ProductRatingSummary.builder()
                .averageRating(avg == null ? 0.0 : Math.round(avg * 10) / 10.0)
                .totalReviews(count)
                .build();
    }

    private static final java.util.List<Order.Status> REVIEWABLE_STATUSES =
            java.util.List.of(Order.Status.DELIVERED, Order.Status.COMPLETED);

    @Transactional
    public ReviewResponse create(Long userId, Long productId, CreateReviewRequest request) {
        boolean hasPurchased = orderItemRepository
                .existsByOrder_User_UserIdAndOrder_StatusInAndVariant_Product_ProductId(
                        userId, REVIEWABLE_STATUSES, productId);
        if (!hasPurchased) {
            throw ApiException.badRequest(
                    "Bạn cần mua và nhận hàng thành công sản phẩm này trước khi đánh giá");
        }

        reviewRepository.findByProduct_ProductIdAndUser_UserId(productId, userId).ifPresent(r -> {
            throw ApiException.badRequest("Bạn đã đánh giá sản phẩm này rồi");
        });

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> ApiException.notFound("Sản phẩm không tồn tại"));

        User userRef = new User();
        userRef.setUserId(userId);

        Review review = new Review();
        review.setProduct(product);
        review.setUser(userRef);
        review.setRating(request.getRating());
        review.setComment(request.getComment());

        return toResponse(reviewRepository.save(review));
    }

    private ReviewResponse toResponse(Review r) {
        return ReviewResponse.builder()
                .reviewId(r.getReviewId())
                .username(r.getUser() != null ? r.getUser().getUsername() : null)
                .rating(r.getRating())
                .comment(r.getComment())
                .createdAt(r.getCreatedAt())
                .build();
    }
}