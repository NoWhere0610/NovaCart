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
}
