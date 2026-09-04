package com.datn.controller;

import com.datn.dto.review.CreateReviewRequest;
import com.datn.dto.review.ReviewEligibility;
import com.datn.dto.review.ReviewResponse;
import com.datn.security.UserPrincipal;
import com.datn.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reviews/products/{productId}")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    /**
     * Giao diện hỏi trước khi vẽ form viết đánh giá.
     *
     * Không có endpoint này thì frontend buộc phải đoán -- và bản trước đoán là "cứ đăng nhập là hiện
     * form", nên khách chưa từng mua vẫn gõ hết cảm nhận rồi bấm gửi mới biết là không được.
     */
    @GetMapping("/eligibility")
    public ResponseEntity<ReviewEligibility> kiemTraQuyen(
            @PathVariable Long productId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reviewService.kiemTraQuyenDanhGia(principal.getUserId(), productId));
    }

    @PostMapping
    public ResponseEntity<ReviewResponse> create(
            @PathVariable Long productId,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateReviewRequest request) {
        return ResponseEntity.ok(reviewService.create(principal.getUserId(), productId, request));
    }
}