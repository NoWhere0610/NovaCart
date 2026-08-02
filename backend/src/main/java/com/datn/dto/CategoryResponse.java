package com.datn.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class CategoryResponse {
    private Integer categoryId;
    private String categoryName;
    private String slug;
    // Mới thêm (mega-menu + CategoriesPage): ảnh đại diện, id danh mục cha,
    // và danh sách danh mục con (chỉ những cái đang active) để FE render cây 2 cấp.
    private String imageUrl;
    private Integer parentId;
    @Builder.Default
    private List<CategoryResponse> children = List.of();
}
