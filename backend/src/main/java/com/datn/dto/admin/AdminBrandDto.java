package com.datn.dto.admin;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

public class AdminBrandDto {

    @Getter
    @Setter
    public static class Request {
        @NotBlank(message = "Tên thương hiệu không được để trống")
        private String brandName;
        private String logoUrl;
    }

    @Getter
    @Builder
    public static class Response {
        private Integer brandId;
        private String brandName;
        private String logoUrl;
    }
}