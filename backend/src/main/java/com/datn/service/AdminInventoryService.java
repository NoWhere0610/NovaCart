package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminInventoryCreateRequest;
import com.datn.dto.admin.AdminInventoryItemResponse;
import com.datn.dto.admin.AdminInventoryUpdateRequest;
import com.datn.entity.Product;
import com.datn.entity.ProductVariant;
import com.datn.exception.ApiException;
import com.datn.repository.ProductRepository;
import com.datn.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quản lý tồn kho ở mức biến thể (size/màu). Khác AdminProductService (sửa cả sản phẩm),
 * service này chỉ thao tác trên ProductVariant.
 */
@Service
@RequiredArgsConstructor
public class AdminInventoryService {

    // Ngưỡng cảnh báo "sắp hết hàng" — đơn giản hoá cho đồ án, hardcode thay vì cấu hình động
    private static final int LOW_STOCK_THRESHOLD = 5;

    private final ProductVariantRepository variantRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public PageResponse<AdminInventoryItemResponse> list(String keyword, boolean lowStockOnly, int page, int size) {
        Page<ProductVariant> variants = variantRepository.search(
                keyword, lowStockOnly, LOW_STOCK_THRESHOLD,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "variantId")));
        return PageResponse.from(variants.map(this::toResponse));
    }

    @Transactional
    public AdminInventoryItemResponse create(AdminInventoryCreateRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> ApiException.notFound("Sản phẩm không tồn tại"));

        if (variantRepository.existsByProduct_ProductIdAndSizeAndColor(
                product.getProductId(), request.getSize(), request.getColor())) {
            throw ApiException.badRequest("Sản phẩm này đã có sẵn phân loại size/màu vừa nhập, hãy sửa dòng đó thay vì tạo mới");
        }

        ProductVariant variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSize(request.getSize());
        variant.setColor(request.getColor());
        variant.setSku(request.getSku());
        variant.setStockQuantity(request.getStockQuantity());

        try {
            return toResponse(variantRepository.save(variant));
        } catch (DataIntegrityViolationException ex) {
            // Nhiều khả năng nhất: SKU trùng với biến thể khác (unique constraint ở DB)
            throw ApiException.badRequest("SKU đã tồn tại, vui lòng nhập SKU khác");
        }
    }

    @Transactional
    public AdminInventoryItemResponse update(Long variantId, AdminInventoryUpdateRequest request) {
        ProductVariant variant = getVariantOrThrow(variantId);
        variant.setSize(request.getSize());
        variant.setColor(request.getColor());
        variant.setSku(request.getSku());
        variant.setStockQuantity(request.getStockQuantity());

        try {
            return toResponse(variantRepository.save(variant));
        } catch (DataIntegrityViolationException ex) {
            throw ApiException.badRequest("SKU đã tồn tại hoặc trùng size/màu với 1 phân loại khác của sản phẩm này");
        }
    }

    @Transactional
    public void delete(Long variantId) {
        ProductVariant variant = getVariantOrThrow(variantId);
        try {
            variantRepository.delete(variant);
            variantRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            // variant_id trong order_items không có ON DELETE CASCADE -> xoá sẽ vi phạm FK nếu đã từng được đặt hàng.
            throw ApiException.badRequest(
                    "Không thể xoá — mặt hàng này đã từng phát sinh đơn hàng. Hãy đặt tồn kho về 0 thay vì xoá.");
        }
    }

    // ----- helper nội bộ -----

    private ProductVariant getVariantOrThrow(Long variantId) {
        return variantRepository.findById(variantId)
                .orElseThrow(() -> ApiException.notFound("Mặt hàng tồn kho không tồn tại"));
    }

    private AdminInventoryItemResponse toResponse(ProductVariant v) {
        Product p = v.getProduct();
        int stock = v.getStockQuantity() == null ? 0 : v.getStockQuantity();
        return AdminInventoryItemResponse.builder()
                .variantId(v.getVariantId())
                .productId(p.getProductId())
                .productName(p.getProductName())
                .categoryName(p.getCategory() != null ? p.getCategory().getCategoryName() : null)
                .size(v.getSize())
                .color(v.getColor())
                .sku(v.getSku())
                .stockQuantity(stock)
                .price(p.getPrice())
                .productStatus(p.getStatus() != null ? p.getStatus().name() : null)
                .lowStock(stock <= LOW_STOCK_THRESHOLD)
                .build();
    }
}
