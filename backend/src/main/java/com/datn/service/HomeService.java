package com.datn.service;

import com.datn.dto.CategoryResponse;
import com.datn.dto.PageResponse;
import com.datn.dto.ProductDetailResponse;
import com.datn.dto.ProductResponse;
import com.datn.dto.ProductVariantResponse;
import com.datn.entity.Category;
import com.datn.entity.Product;
import com.datn.entity.ProductImage;
import com.datn.entity.ProductVariant;
import com.datn.exception.ApiException;
import com.datn.repository.BrandRepository;
import com.datn.repository.CategoryRepository;
import com.datn.repository.ProductRepository;
import com.datn.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HomeService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final ReviewRepository reviewRepository;

    public List<CategoryResponse> getRootCategories() {
        return categoryRepository.findByParentIsNullAndIsActiveTrue()
                .stream()
                .map(this::toCategoryResponse)
                .toList();
    }

    public PageResponse<ProductResponse> getNewestProducts(Pageable pageable) {
        Page<Product> page = productRepository.findByStatusOrderByCreatedAtDesc(
                Product.Status.ACTIVE, pageable);
        return PageResponse.from(page.map(this::toProductResponse));
    }

    /**
     * Xem sản phẩm theo danh mục. Nếu categoryId là danh mục CHA (VD: "Áo"),
     * gom luôn sản phẩm của các danh mục CON active bên trong (vì sản phẩm chỉ
     * được gán trực tiếp vào danh mục lá) — tránh trang trống khi bấm vào 1
     * nhóm cha ở mega-menu/CategoriesPage.
     */
    public PageResponse<ProductResponse> getProductsByCategory(Integer categoryId, Pageable pageable) {
        List<Integer> categoryIds = categoryRepository.findById(categoryId)
                .map(cat -> {
                    List<Integer> childIds = cat.getChildren() == null ? List.of() : cat.getChildren().stream()
                            .filter(ch -> Boolean.TRUE.equals(ch.getIsActive()))
                            .map(Category::getCategoryId)
                            .toList();
                    if (childIds.isEmpty()) {
                        return List.of(categoryId);
                    }
                    List<Integer> all = new java.util.ArrayList<>(childIds);
                    all.add(categoryId);
                    return all;
                })
                .orElse(List.of(categoryId));

        Page<Product> page = productRepository.findByStatusAndCategory_CategoryIdInOrderByCreatedAtDesc(
                Product.Status.ACTIVE, categoryIds, pageable);
        return PageResponse.from(page.map(this::toProductResponse));
    }

    public PageResponse<ProductResponse> getOnSaleProducts(Pageable pageable) {
        Page<Product> page = productRepository.findOnSaleProducts(pageable);
        return PageResponse.from(page.map(this::toProductResponse));
    }

    public PageResponse<ProductResponse> searchProducts(String keyword, Pageable pageable) {
        Page<Product> page = productRepository.findByStatusAndProductNameContainingIgnoreCase(
                Product.Status.ACTIVE, keyword, pageable);
        return PageResponse.from(page.map(this::toProductResponse));
    }

    /** Trang chi tiết sản phẩm — trả đầy đủ ảnh + danh sách variant (size/màu/tồn kho) để user chọn trước khi thêm giỏ. */
    public ProductDetailResponse getProductDetail(Long productId) {
        Product p = productRepository.findById(productId)
                .orElseThrow(() -> ApiException.notFound("Sản phẩm không tồn tại"));

        List<String> imageUrls = p.getImages() == null ? List.of() : p.getImages().stream()
                .sorted(Comparator.comparing(ProductImage::getDisplayOrder,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(ProductImage::getImageUrl)
                .toList();

        List<ProductVariantResponse> variants = p.getVariants() == null ? List.of() : p.getVariants().stream()
                .map(v -> ProductVariantResponse.builder()
                        .variantId(v.getVariantId())
                        .size(v.getSize())
                        .color(v.getColor())
                        .stockQuantity(v.getStockQuantity())
                        .build())
                .toList();

        Double avgRating = reviewRepository.findAverageRatingByProductId(productId);
        long reviewCount = reviewRepository.countByProduct_ProductId(productId);

        return ProductDetailResponse.builder()
                .productId(p.getProductId())
                .productName(p.getProductName())
                .slug(p.getSlug())
                .description(p.getDescription())
                .price(p.getPrice())
                .salePrice(p.getSalePrice())
                .material(p.getMaterial())
                .categoryName(p.getCategory() != null ? p.getCategory().getCategoryName() : null)
                .brandName(p.getBrand() != null ? p.getBrand().getBrandName() : null)
                .imageUrls(imageUrls)
                .variants(variants)
                .averageRating(avgRating == null ? 0.0 : Math.round(avgRating * 10) / 10.0)
                .reviewCount(reviewCount)
                .build();
    }

    private ProductResponse toProductResponse(Product p) {
        String thumbnail = p.getImages() == null ? null : p.getImages().stream()
                .filter(ProductImage::getIsThumbnail)
                .map(ProductImage::getImageUrl)
                .findFirst()
                .orElse(p.getImages().isEmpty() ? null : p.getImages().get(0).getImageUrl());

        return ProductResponse.builder()
                .productId(p.getProductId())
                .productName(p.getProductName())
                .slug(p.getSlug())
                .price(p.getPrice())
                .salePrice(p.getSalePrice())
                .thumbnailUrl(thumbnail)
                .categoryName(p.getCategory() != null ? p.getCategory().getCategoryName() : null)
                .brandName(p.getBrand() != null ? p.getBrand().getBrandName() : null)
                .build();
    }

    /**
     * Chuyển 1 Category thành CategoryResponse, kèm theo danh sách con (nếu có)
     * đã lọc active + sắp xếp theo tên — dùng cho mega-menu (hover xổ danh mục
     * cha rồi hiện danh mục con bên cạnh) và CategoriesPage (nhóm theo cha).
     */
    private CategoryResponse toCategoryResponse(Category c) {
        List<CategoryResponse> children = c.getChildren() == null ? List.of() : c.getChildren().stream()
                .filter(child -> Boolean.TRUE.equals(child.getIsActive()))
                .sorted(Comparator.comparing(Category::getCategoryName))
                .map(this::toCategoryResponse)
                .toList();

        return CategoryResponse.builder()
                .categoryId(c.getCategoryId())
                .categoryName(c.getCategoryName())
                .slug(c.getSlug())
                .imageUrl(c.getImageUrl())
                .parentId(c.getParent() != null ? c.getParent().getCategoryId() : null)
                .children(children)
                .build();
    }
}