package com.datn.dto.chatbot;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

/**
 * Dữ liệu 1 sản phẩm trả về cho chatbot kit (Node.js) đồng bộ vào kho tri thức
 * -- xem GET /internal/kb/products (InternalKbController). Tên field khớp
 * CHÍNH XÁC với productToText()/syncProducts() trong
 * "D:/My Tech/Chatbot/lib/productSync.js" (Jackson serialize camelCase y
 * nguyên, không đổi tên).
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
