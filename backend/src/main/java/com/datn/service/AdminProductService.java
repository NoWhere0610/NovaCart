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

@Service
@RequiredArgsConstructor
public class AdminProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;

    /** Danh sách sản phẩm cho bảng quản trị — KHÔNG lọc theo status (admin phải thấy cả sản phẩm ẩn/hết hàng). */
    @Transactional(readOnly = true)
    public PageResponse<AdminProductResponse> list(String keyword, int page, int size) {
        Page<Product> products = (keyword == null || keyword.isBlank())
                ? productRepository.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                : productRepository.findByProductNameContainingIgnoreCase(
                    keyword, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.from(products.map(this::toResponse));
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
        // KHÔNG xoá cứng (hard delete) sản phẩm đã từng được đặt hàng — OrderItem đã snapshot
        // dữ liệu riêng nên không bị lỗi tham chiếu, nhưng để an toàn dữ liệu lịch sử/thống kê,
        // đồ án chọn cách chuyển status = INACTIVE (soft delete) thay vì xoá thật khỏi DB.
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
        product.setPrice(request.getPrice());
        product.setSalePrice(request.getSalePrice());
        product.setMaterial(request.getMaterial());
        product.setStatus(request.getStatus() != null ? request.getStatus() : Product.Status.ACTIVE);
        // Slug tự sinh từ tên (đơn giản hoá cho đồ án: không xử lý bỏ dấu tiếng Việt phức tạp,
        // chỉ thay khoảng trắng + lowercase, đủ dùng cho URL thân thiện)
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
     * Đồng bộ ảnh: XOÁ SẠCH ảnh cũ rồi tạo lại theo đúng danh sách mới gửi lên.
     * Đơn giản hoá hợp lý cho đồ án vì ảnh không bị tham chiếu bởi bảng nào khác
     * (không như variant có thể đã nằm trong OrderItem/CartItem) — orphanRemoval=true
     * trên Product.images sẽ tự xoá record cũ trong DB khi list được thay thế.
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
     * Đồng bộ variant theo chiến lược "match theo variantId":
     *  - variantId != null VÀ còn trong request -> GIỮ LẠI, cập nhật size/color/sku/stock (KHÔNG tạo record mới,
     *    vì variant này có thể đã được tham chiếu trong CartItem/OrderItem lịch sử qua variant_id).
     *  - variantId == null -> variant MỚI, tạo record mới.
     *  - variant cũ trong DB nhưng KHÔNG còn xuất hiện trong request -> bị XOÁ (orphanRemoval).
     * Cách làm này tránh việc xoá-tạo-lại toàn bộ variant mỗi lần sửa, vốn sẽ làm ĐỨT liên kết
     * variant_id trong OrderItem/CartItem cũ (biến chúng thành tham chiếu tới ID không tồn tại).
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

    private AdminProductResponse toResponse(Product p) {
        List<String> imageUrls = p.getImages() == null ? List.of()
                : p.getImages().stream().map(ProductImage::getImageUrl).toList();

        List<ProductVariantResponse> variants = p.getVariants() == null ? List.of()
                : p.getVariants().stream().map(v -> ProductVariantResponse.builder()
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