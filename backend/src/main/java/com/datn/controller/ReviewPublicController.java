package com.datn.controller;

import com.datn.dto.PageResponse;
import com.datn.dto.review.ProductRatingSummary;
import com.datn.dto.review.ReviewResponse;
import com.datn.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/home/products/{productId}/reviews")
@RequiredArgsConstructor
public class ReviewPublicController {

    private final ReviewService reviewService;

    @GetMapping
    public ResponseEntity<PageResponse<ReviewResponse>> getByProduct(
            @PathVariable Long productId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(reviewService.getByProduct(productId, page, size));
    }

    @GetMapping("/summary")
    public ResponseEntity<ProductRatingSummary> getSummary(@PathVariable Long productId) {
        return ResponseEntity.ok(reviewService.getRatingSummary(productId));
    }
}