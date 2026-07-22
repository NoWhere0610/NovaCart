package com.datn.dto.review;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ReviewResponse {
    private Long reviewId;
    private String username;
    private Integer rating;
    private String comment;
    private LocalDateTime createdAt;
}