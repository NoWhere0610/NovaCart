package com.datn.controller;

import com.datn.dto.review.CreateReviewRequest;
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

    @PostMapping
    public ResponseEntity<ReviewResponse> create(
            @PathVariable Long productId,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateReviewRequest request) {
        return ResponseEntity.ok(reviewService.create(principal.getUserId(), productId, request));
    }
}