package com.datn.dto.review;

import lombok.Builder;
import lombok.Getter;

import java.util.Map;

@Getter
@Builder
public class ProductRatingSummary {
    private Double averageRating;
    private Long totalReviews;
    // Key 1-5 (số sao), value = số lượng đánh giá ở đúng mức đó -- LUÔN đủ 5 key kể cả count=0, để
    // frontend vẽ đủ 5 dòng phân bố không phải tự bù key thiếu.
    private Map<Integer, Long> ratingDistribution;
}