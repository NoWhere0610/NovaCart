package com.datn.dto.review;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProductRatingSummary {
    private Double averageRating;
    private Long totalReviews;
}