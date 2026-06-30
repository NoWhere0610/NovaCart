package com.datn.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CategoryResponse {
    private Integer categoryId;
    private String categoryName;
    private String slug;
}
