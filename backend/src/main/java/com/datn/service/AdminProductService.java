package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.ProductVariantResponse;
import com.datn.dto.admin.AdminProductRequest;
import com.datn.dto.admin.AdminProductResponse;
import com.datn.dto.admin.AdminVariantRequest;
import com.datn.entity.*;
import com.datn.exception.ApiException;
import com.datn.repository.BrandRepository;
import com.datn.repository.CategoryRepository;
import com.datn.repository.ProductRepository;
import com.datn.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final ProductVariantRepository variantRepository;

    /** Danh sách sản phẩm cho bảng quản trị — KHÔNG lọc theo status (admin phải thấy cả sản phẩm ẩn/hết hàng). */
    @Transactional(readOnly = true)
    public PageResponse<AdminProductResponse> list(String keyword, int page, int size) {
        Page<Product> products = (keyword == null || keyword.isBlank())
                ? productRepository.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                : productRepository.findByProductNameContainingIgnoreCase(
                    keyword, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));

        // Batch 1 query lấy variants cho cả trang, tránh N+1 -- không gộp @EntityGraph vì "images" là bag collection khác.
        List<Long> productIds = products.getContent().stream().map(Product::getProductId).toList();
        Map<Long, List<ProductVariant>> variantsByProductId = variantRepository
                .findByProduct_ProductIdIn(productIds).stream()
                .collect(Collectors.groupingBy(v -> v.getProduct().getProductId()));

        return PageResponse.from(products.map(p ->
                toResponse(p, variantsByProductId.getOrDefault(p.getProductId(), List.of()))));
    }

    @Transactional(readOnly = true)
    public AdminProductResponse getDetail(Long productId) {
        return toResponse(getProductOrThrow(productId));
    }

    @Transactional
    public AdminProductResponse create(AdminProductRequest request) {
        Product product = new Product();
        applyBasicFields(product, request);
        syncImages(product, request.getImageUrls());
        syncVariants(product, request.getVariants());
        return toResponse(productRepository.save(product));
    }

    @Transactional
    public AdminProductResponse update(Long productId, AdminProductRequest request) {
        Product product = getProductOrThrow(productId);
        applyBasicFields(product, request);
        syncImages(product, request.getImageUrls());
        syncVariants(product, request.getVariants());
        return toResponse(productRepository.save(product));
    }

    @Transactional
    public void delete(Long productId) {
        Product product = getProductOrThrow(productId);
        // Soft delete (INACTIVE) thay vì xoá cứng -- giữ dữ liệu lịch sử/thống kê.
        product.setStatus(Product.Status.INACTIVE);
        productRepository.save(product);
    }

    // ----- helper nội bộ -----

    private Product getProductOrThrow(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> ApiException.notFound("Sản phẩm không tồn tại"));
    }

    private void applyBasicFields(Product product, AdminProductRequest request) {
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> ApiException.notFound("Danh mục không tồn tại"));

        product.setProductName(request.getProductName());
        product.setDescription(request.getDescription());
        product.setCategory(category);
        // @DecimalMin ở DTO không so sánh được 2 field -> chặn salePrice > price ở đây.
        if (request.getSalePrice() != null && request.getSalePrice().compareTo(request.getPrice()) > 0) {
            throw ApiException.badRequest("Giá khuyến mãi không được cao hơn giá bán");
        }
        product.setPrice(request.getPrice());
        product.setSalePrice(request.getSalePrice());
        product.setMaterial(request.getMaterial());
        product.setStatus(request.getStatus() != null ? request.getStatus() : Product.Status.ACTIVE);
        // Slug tự sinh từ tên, không xử lý bỏ dấu tiếng Việt.
        product.setSlug(toSlug(request.getProductName()) + "-" + System.currentTimeMillis() % 100000);

        if (request.getBrandId() != null) {
            Brand brand = brandRepository.findById(request.getBrandId())
                    .orElseThrow(() -> ApiException.notFound("Thương hiệu không tồn tại"));
            product.setBrand(brand);
        } else {
            product.setBrand(null);
        }
    }

    /**
     * Đồng bộ ảnh: xoá sạch ảnh cũ rồi tạo lại theo danh sách mới.
     * Ảnh không bị bảng nào tham chiếu nên xoá/tạo lại an toàn (orphanRemoval=true).
     */
    private void syncImages(Product product, List<String> imageUrls) {
        if (product.getImages() == null) {
            product.setImages(new ArrayList<>());
        } else {
            product.getImages().clear();
        }
        if (imageUrls == null) return;

        for (int i = 0; i < imageUrls.size(); i++) {
            ProductImage image = new ProductImage();
            image.setProduct(product);
            image.setImageUrl(imageUrls.get(i));
            image.setIsThumbnail(i == 0);
            image.setDisplayOrder(i);
            product.getImages().add(image);
        }
    }

    /**
     * Đồng bộ variant theo variantId: còn trong request -> giữ lại và cập nhật;
     * variantId null -> tạo mới; không còn trong request -> xoá (orphanRemoval).
     * Không xoá-tạo lại toàn bộ vì sẽ làm đứt liên kết variant_id trong OrderItem/CartItem cũ.
     */
    private void syncVariants(Product product, List<AdminVariantRequest> variantRequests) {
        if (product.getVariants() == null) {
            product.setVariants(new ArrayList<>());
        }
        if (variantRequests == null) {
            variantRequests = List.of();
        }

        Map<Long, ProductVariant> existingById = new HashMap<>();
        for (ProductVariant v : product.getVariants()) {
            existingById.put(v.getVariantId(), v);
        }

        List<ProductVariant> result = new ArrayList<>();
        for (AdminVariantRequest req : variantRequests) {
            ProductVariant variant = req.getVariantId() != null ? existingById.get(req.getVariantId()) : null;
            if (variant == null) {
                variant = new ProductVariant();
                variant.setProduct(product);
            }
            variant.setSize(req.getSize());
            variant.setColor(req.getColor());
            variant.setSku(req.getSku());
            variant.setStockQuantity(req.getStockQuantity());
            result.add(variant);
        }

        product.getVariants().clear();
        product.getVariants().addAll(result);
    }

    private String toSlug(String input) {
        return input.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("\\s+", "-");
    }

    // Dùng cho 1 sản phẩm đơn lẻ -- lazy-load getVariants() ở đây không phải N+1.
    private AdminProductResponse toResponse(Product p) {
        return toResponse(p, p.getVariants());
    }

    // Dùng cho list(): variants đã được batch-fetch sẵn ở nơi gọi, tránh N+1.
    private AdminProductResponse toResponse(Product p, List<ProductVariant> variantsForProduct) {
        List<String> imageUrls = p.getImages() == null ? List.of()
                : p.getImages().stream().map(ProductImage::getImageUrl).toList();

        List<ProductVariantResponse> variants = variantsForProduct == null ? List.of()
                : variantsForProduct.stream().map(v -> ProductVariantResponse.builder()
                    .variantId(v.getVariantId())
                    .size(v.getSize())
                    .color(v.getColor())
                    .stockQuantity(v.getStockQuantity())
                    .build()).toList();

        return AdminProductResponse.builder()
                .productId(p.getProductId())
                .productName(p.getProductName())
                .slug(p.getSlug())
                .description(p.getDescription())
                .categoryId(p.getCategory() != null ? p.getCategory().getCategoryId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getCategoryName() : null)
                .brandId(p.getBrand() != null ? p.getBrand().getBrandId() : null)
                .brandName(p.getBrand() != null ? p.getBrand().getBrandName() : null)
                .price(p.getPrice())
                .salePrice(p.getSalePrice())
                .material(p.getMaterial())
                .status(p.getStatus())
                .imageUrls(imageUrls)
                .variants(variants)
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}