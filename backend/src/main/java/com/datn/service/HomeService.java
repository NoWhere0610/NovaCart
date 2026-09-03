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

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

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
     * Nếu categoryId là danh mục cha, gom luôn sản phẩm của các danh mục con active
     * (sản phẩm chỉ gán trực tiếp vào danh mục lá) -- tránh trang trống khi bấm vào nhóm cha.
     */
    public PageResponse<ProductResponse> getProductsByCategory(Integer categoryId, Pageable pageable) {
        List<Integer> categoryIds = resolveCategoryIdsWithChildren(categoryId);
        Page<Product> page = productRepository.findByStatusAndCategory_CategoryIdInOrderByCreatedAtDesc(
                Product.Status.ACTIVE, categoryIds, pageable);
        return PageResponse.from(page.map(this::toProductResponse));
    }

    /** Gom ID danh mục con active vào danh mục cha (sản phẩm chỉ gán vào danh mục lá) --
     * dùng chung cho getProductsByCategory() và filterProducts(). */
    private List<Integer> resolveCategoryIdsWithChildren(Integer categoryId) {
        return categoryRepository.findById(categoryId)
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

    /** "Đã xem gần đây" -- trả đúng thứ tự ids truyền vào vì IN (...) ở DB không giữ thứ tự. */
    public List<ProductResponse> getProductsByIds(List<Long> ids) {
        List<Product> products = productRepository.findByProductIdInAndStatus(ids, Product.Status.ACTIVE);
        Map<Long, Product> byId = products.stream()
                .collect(Collectors.toMap(Product::getProductId, p -> p));
        return ids.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(this::toProductResponse)
                .toList();
    }

    /** Trang Shop: kết hợp danh mục (optional) + từ khoá + khoảng giá + size/màu, tất cả optional. */
    public PageResponse<ProductResponse> filterProducts(
            Integer categoryId, String keyword, BigDecimal minPrice, BigDecimal maxPrice,
            String size, String color, Pageable pageable) {
        Page<Product> page = categoryId == null
                ? productRepository.filterProducts(Product.Status.ACTIVE, keyword, minPrice, maxPrice, size, color, pageable)
                : productRepository.filterProductsByCategory(
                        Product.Status.ACTIVE, resolveCategoryIdsWithChildren(categoryId), keyword, minPrice, maxPrice, size, color, pageable);
        return PageResponse.from(page.map(this::toProductResponse));
    }

    /** Trang chi tiết sản phẩm — trả đầy đủ ảnh + danh sách variant (size/màu/tồn kho) để user chọn trước khi thêm giỏ. */
    public ProductDetailResponse getProductDetail(Long productId) {
        // Lọc status như mọi truy vấn danh sách phía khách hàng: sản phẩm đã ẩn/ngừng bán vẫn mở được qua
        // link cũ (đã lưu, hoặc từ kết quả tìm kiếm ngoài) và hiện y như đang bán -- khách chọn size, bấm
        // "Thêm vào giỏ" tới tận bước cuối mới bị CartService chặn.
        Product p = productRepository.findById(productId)
                .filter(prod -> prod.getStatus() == Product.Status.ACTIVE)
                .orElseThrow(() -> ApiException.notFound("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh"));

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
     * Chuyển Category thành CategoryResponse kèm danh sách con đã lọc active + sắp xếp theo tên --
     * dùng cho mega-menu và CategoriesPage.
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