package com.datn.dto.chatbot;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

/**
 * Dữ liệu 1 sản phẩm cho chatbot kit đồng bộ vào kho tri thức (GET /internal/kb/products).
 * Tên field phải khớp chính xác với productSync.js bên kit (Jackson serialize camelCase, không đổi tên).
 */
@Getter
@Builder
public class InternalProductDto {
    private String maSanPham;
    private String tenSanPham;
    private String danhMuc;
    private String thuongHieu;
    private BigDecimal gia; // giá cuối cùng: salePrice nếu có, không thì price
    private String moTa;
    private String chatLieu;
    private List<String> sizes; // size còn tồn kho (stockQuantity > 0), không trùng lặp
    private List<String> colors; // màu còn tồn kho (stockQuantity > 0), không trùng lặp

    /**
     * Các CẶP size/màu thực sự còn hàng. Bắt buộc phải có riêng, KHÔNG suy ra được từ sizes + colors:
     * 2 danh sách đó rời nhau nên sản phẩm chỉ còn M/Đen và L/Trắng sẽ bị hiểu thành 4 tổ hợp, và bot
     * khẳng định với khách là còn "M màu Trắng" -- một phân loại không hề tồn tại. sizes/colors vẫn giữ
     * để lọc khi khách chỉ nêu 1 trong 2 điều kiện.
     */
    private List<SizeColor> bienThe;

    @Getter
    @Builder
    public static class SizeColor {
        private String size;
        private String color;
    }
}
