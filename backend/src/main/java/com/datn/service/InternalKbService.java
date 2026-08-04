package com.datn.service;

import com.datn.dto.chatbot.InternalProductDto;
import com.datn.entity.Product;
import com.datn.entity.ProductVariant;
import com.datn.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * Chuẩn bị dữ liệu sản phẩm cho chatbot kit đồng bộ vào kho tri thức mỗi ngày --
 * xem GET /internal/kb/products (InternalKbController).
 */
@Service
@RequiredArgsConstructor
public class InternalKbService {

    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public List<InternalProductDto> getProductsForKb() {
        return productRepository.findByStatus(Product.Status.ACTIVE).stream()
                .map(this::toDto)
                // Sản phẩm không còn size/màu nào tồn kho -> không thể mua, không đáng tư vấn cho khách.
                .filter(dto -> !dto.getSizes().isEmpty())
                .toList();
    }

    private InternalProductDto toDto(Product p) {
        List<ProductVariant> inStock = p.getVariants() == null
                ? List.of()
                : p.getVariants().stream().filter(v -> v.getStockQuantity() != null && v.getStockQuantity() > 0).toList();

        return InternalProductDto.builder()
                .maSanPham(String.valueOf(p.getProductId()))
                .tenSanPham(p.getProductName())
                .danhMuc(p.getCategory() != null ? p.getCategory().getCategoryName() : null)
                // "No Brand" là giá trị thật trong DB cho sản phẩm không có thương hiệu -- coi như null để
                // bot không trả lời kiểu "Thương hiệu: No Brand", giống cách xử lý ở frontend.
                .thuongHieu(p.getBrand() != null && !"No Brand".equals(p.getBrand().getBrandName())
                        ? p.getBrand().getBrandName() : null)
                .gia(p.getSalePrice() != null ? p.getSalePrice() : p.getPrice())
                .moTa(p.getDescription())
                .chatLieu(p.getMaterial())
                .sizes(distinctSorted(inStock, ProductVariant::getSize))
                .colors(distinctSorted(inStock, ProductVariant::getColor))
                .build();
    }

    private List<String> distinctSorted(List<ProductVariant> variants, java.util.function.Function<ProductVariant, String> extractor) {
        return variants.stream().map(extractor).filter(java.util.Objects::nonNull).distinct().sorted(Comparator.naturalOrder()).toList();
    }
}
