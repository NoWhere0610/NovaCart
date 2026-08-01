package com.datn.dto.admin;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

public class AdminCategoryDto {

    @Getter
    @Setter
    public static class Request {
        @NotBlank(message = "Tên danh mục không được để trống")
        private String categoryName;
        private Integer parentId;
        private String description;
        // Mới thêm: ảnh đại diện danh mục (URL) — hiển thị ở CategoriesPage + mega-menu
        private String imageUrl;
        private Boolean isActive;
    }

    @Getter
    @Builder
    public static class Response {
        private Integer categoryId;
        private String categoryName;
        private String slug;
        private Integer parentId;
        private String parentName;
        private String description;
        private String imageUrl;
        private Boolean isActive;
    }
}
