package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.ProductVariantResponse;
import com.datn.dto.admin.AdminProductRequest;
import com.datn.dto.admin.AdminProductResponse;
import com.datn.dto.admin.AdminVariantRequest;
import com.datn.entity.*;
import com.datn.exception.ApiException;
import com.datn.repository.BrandRepository;
import com.datn.repository.CartItemRepository;
import com.datn.repository.CategoryRepository;
import com.datn.repository.OrderItemRepository;
import com.datn.repository.ProductRepository;
import com.datn.repository.ProductVariantRepository;
import com.datn.security.PermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminProductService {

    // Cùng 1 định nghĩa "sắp hết hàng" với AdminInventoryService.LOW_STOCK_THRESHOLD và hằng
    // LOW_STOCK_THRESHOLD ở AdminProductsPage.
    private static final int LOW_STOCK_THRESHOLD = 5;

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final ProductVariantRepository variantRepository;
    private final OrderItemRepository orderItemRepository;
    private final CartItemRepository cartItemRepository;
    private final PermissionService permissionService;

    /** Danh sách sản phẩm cho bảng quản trị — KHÔNG lọc theo status (admin phải thấy cả sản phẩm ẩn/hết hàng). */
    @Transactional(readOnly = true)
    public PageResponse<AdminProductResponse> list(String keyword, boolean lowStockOnly, int page, int size) {
        Page<Product> products = productRepository.searchForAdmin(
                keyword, lowStockOnly, LOW_STOCK_THRESHOLD,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));

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

        // Tính slug TRƯỚC khi ghi đè tên -- resolveSlug cần so sánh tên cũ với tên mới.
        String slug = resolveSlug(product.getSlug(), product.getProductName(), request.getProductName());

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
        product.setSlug(slug);

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

        // product_images.image_url là NOT NULL nhưng chuỗi rỗng vẫn lọt qua ràng buộc đó -> sinh ra dòng
        // ảnh rỗng, render thành <img src=""> hỏng ở Shop/POS. Lọc ngay tại đây thay vì tin frontend đã lọc.
        List<String> cleaned = imageUrls == null ? List.of() : imageUrls.stream()
                .filter(u -> u != null && !u.isBlank())
                .map(String::trim)
                .toList();
        if (cleaned.isEmpty()) {
            throw ApiException.badRequest("Sản phẩm cần ít nhất 1 ảnh");
        }

        for (int i = 0; i < cleaned.size(); i++) {
            ProductImage image = new ProductImage();
            image.setProduct(product);
            image.setImageUrl(cleaned.get(i));
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

        // Tồn kho là dữ liệu CHỈ ADMIN được sửa (module "Kho tồn hàng" khoá cứng ADMIN ở SecurityConfig,
        // không nằm trong ma trận STAFF). Nhưng form Sản phẩm cũng gửi stockQuantity kèm theo variant, nên
        // Nhân viên có PRODUCT_WRITE sẽ sửa được tồn kho qua đường này -> lách đúng quy tắc trên. Chặn tại
        // đây: request của Nhân viên KHÔNG được đụng vào tồn kho -- variant cũ giữ nguyên số đang có,
        // variant mới bắt đầu từ 0 rồi Admin nhập kho ở trang "Kho tồn hàng".
        boolean canEditStock = permissionService.isCurrentUserAdmin();

        if (variantRequests.isEmpty()) {
            throw ApiException.badRequest("Sản phẩm cần ít nhất 1 phân loại (size/màu)");
        }

        Map<Long, ProductVariant> existingById = new HashMap<>();
        for (ProductVariant v : product.getVariants()) {
            existingById.put(v.getVariantId(), v);
        }

        // Chặn trùng NGAY TRONG 1 request, trước khi để DB ném lỗi: uq_product_size_color và UNIQUE(sku)
        // đều chặn đúng, nhưng DataIntegrityViolationException rơi vào handler chung và trả về thông báo
        // "dữ liệu bị trùng do có yêu cầu khác vừa xử lý cùng lúc" -- sai bản chất, admin đọc xong sẽ đi
        // tải lại trang và thử lại mãi mà không biết mình vừa nhập 2 dòng M/Đen.
        Set<String> seenSizeColor = new HashSet<>();
        Set<String> seenSku = new HashSet<>();

        List<ProductVariant> result = new ArrayList<>();
        for (AdminVariantRequest req : variantRequests) {
            String sizeColorKey = req.getSize().trim().toLowerCase() + "|" + req.getColor().trim().toLowerCase();
            if (!seenSizeColor.add(sizeColorKey)) {
                throw ApiException.badRequest(
                        "Phân loại \"" + req.getSize() + " / " + req.getColor() + "\" bị khai báo 2 lần");
            }

            ProductVariant variant = null;
            if (req.getVariantId() != null) {
                variant = existingById.get(req.getVariantId());
                // variantId có giá trị nhưng không thuộc sản phẩm này -> dữ liệu client sai. Trước đây rơi
                // vào nhánh "tạo mới" và âm thầm đẻ thêm phân loại thay vì báo lỗi.
                if (variant == null) {
                    throw ApiException.badRequest("Phân loại cần sửa không thuộc sản phẩm này, vui lòng tải lại trang");
                }
            }
            boolean isNewVariant = variant == null;
            if (isNewVariant) {
                variant = new ProductVariant();
                variant.setProduct(product);
            }

            String sku = normalizeSku(req.getSku(), variant.getSku(), req.getSize(), req.getColor());
            if (!seenSku.add(sku.toLowerCase())) {
                throw ApiException.badRequest("SKU \"" + sku + "\" bị khai báo 2 lần trong cùng sản phẩm");
            }

            variant.setSize(req.getSize());
            variant.setColor(req.getColor());
            variant.setSku(sku);
            applyStock(variant, req, isNewVariant, canEditStock);
            result.add(variant);
        }

        List<ProductVariant> removed = product.getVariants().stream()
                .filter(v -> !result.contains(v))
                .toList();
        assertRemovable(removed);

        product.getVariants().clear();
        product.getVariants().addAll(result);
    }

    /**
     * Tồn kho KHÔNG bao giờ được ghi đè bằng con số form đang giữ.
     *
     * Form sản phẩm nạp stockQuantity lúc mở trang rồi gửi lại y nguyên khi bấm Lưu. Giữa 2 thời điểm đó
     * POS/checkout có thể đã trừ kho nhiều lần -- admin chỉ sửa mỗi mô tả cũng vô tình quay số tồn về giá
     * trị cũ, xoá sạch các giao dịch bán đã phát sinh (và mở đường bán vượt kho thật).
     *
     * Nên: chỉ coi là "admin thực sự muốn đổi tồn kho" khi số gửi lên KHÁC số gốc mà form đã đọc
     * (originalStockQuantity). Khi đó mới ghi, và bắt buộc số gốc phải còn khớp với DB -- nếu không thì
     * dữ liệu trên màn hình đã cũ, phải tải lại chứ không được ghi đè.
     */
    private void applyStock(ProductVariant variant, AdminVariantRequest req, boolean isNewVariant, boolean canEditStock) {
        if (isNewVariant) {
            // Nhân viên (không phải Admin) không được đặt tồn kho -- xem chú thích ở syncVariants.
            variant.setStockQuantity(canEditStock ? req.getStockQuantity() : 0);
            return;
        }
        int current = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
        Integer requested = req.getStockQuantity();
        Integer original = req.getOriginalStockQuantity();
        if (requested == null || requested.equals(original) || requested == current) {
            return; // không có ý định đổi (hoặc đã trùng số hiện tại) -> giữ nguyên số trong DB
        }
        if (!canEditStock) {
            throw ApiException.badRequest("Bạn không có quyền sửa tồn kho");
        }
        if (original == null || original != current) {
            throw ApiException.badRequest("Tồn kho của phân loại \"" + req.getSize() + " / " + req.getColor()
                    + "\" vừa thay đổi (hiện là " + current + "), vui lòng tải lại trang rồi nhập lại");
        }
        variant.setStockQuantity(requested);
    }

    /**
     * SKU có ràng buộc UNIQUE trên TOÀN BẢNG, và SQL Server chỉ cho đúng 1 dòng NULL. Form ghi "SKU không
     * bắt buộc" nên bỏ trống là chuyện thường -- nhưng để trống (chuỗi rỗng hay null) thì sản phẩm thứ 2
     * có phân loại bỏ trống SKU sẽ vi phạm UNIQUE và không lưu được, kèm thông báo lỗi không liên quan.
     * Vì vậy: bỏ trống -> tự sinh mã, giữ nguyên mã cũ nếu biến thể đã có sẵn.
     */
    private String normalizeSku(String requestedSku, String currentSku, String size, String color) {
        if (requestedSku != null && !requestedSku.isBlank()) {
            return requestedSku.trim();
        }
        if (currentSku != null && !currentSku.isBlank()) {
            return currentSku;
        }
        String prefix = "SKU-" + toSlug(size) + "-" + toSlug(color);
        for (int i = 0; i < 20; i++) {
            String candidate = prefix + "-" + UUID.randomUUID().toString().substring(0, 6);
            if (!variantRepository.existsBySku(candidate)) {
                return candidate;
            }
        }
        throw ApiException.badRequest("Không sinh được mã SKU tự động, vui lòng nhập SKU thủ công");
    }

    /**
     * Biến thể bị gỡ khỏi request sẽ bị orphanRemoval xoá khỏi DB. Nhưng variant_id còn được order_items/
     * cart_items tham chiếu bằng FK KHÔNG CASCADE -> DB chặn, cả transaction rollback (mất luôn các sửa
     * đổi khác trong cùng lần Lưu) và trả về thông báo trùng lặp khó hiểu. Kiểm tra trước để báo đúng.
     */
    private void assertRemovable(List<ProductVariant> removed) {
        for (ProductVariant v : removed) {
            if (v.getVariantId() == null) continue;
            String label = "\"" + v.getSize() + " / " + v.getColor() + "\"";
            if (orderItemRepository.existsByVariant_VariantId(v.getVariantId())) {
                throw ApiException.badRequest("Không thể xoá phân loại " + label
                        + " vì đã phát sinh đơn hàng. Hãy đặt tồn kho về 0 thay vì xoá.");
            }
            if (cartItemRepository.existsByVariant_VariantId(v.getVariantId())) {
                throw ApiException.badRequest("Không thể xoá phân loại " + label
                        + " vì đang nằm trong giỏ hàng của khách. Hãy đặt tồn kho về 0 thay vì xoá.");
            }
        }
    }

    /**
     * Giữ nguyên slug khi tên không đổi -- slug là định danh trong URL, sinh lại mỗi lần bấm Lưu sẽ phá
     * mọi link đã chia sẻ nếu sau này định tuyến theo slug. Khi tên đổi thì lấy slug mới, đụng hàng thì
     * thêm hậu tố -2, -3... (products.slug có UNIQUE) thay vì gắn 5 số cuối của mili-giây rồi phó mặc DB.
     */
    private String resolveSlug(String currentSlug, String currentName, String newName) {
        if (currentSlug != null && !currentSlug.isBlank() && newName.equals(currentName)) {
            return currentSlug;
        }
        String base = toSlug(newName);
        if (base.isBlank()) {
            base = "san-pham";
        }
        if (base.equals(currentSlug)) {
            return currentSlug;
        }
        String candidate = base;
        int suffix = 2;
        while (productRepository.existsBySlug(candidate)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }

    /**
     * Bỏ dấu tiếng Việt trước khi lọc ký tự. Bản cũ lọc thẳng [^a-z0-9\s-] trên chuỗi còn dấu nên chữ có
     * dấu bị XOÁ chứ không phải chuyển thành không dấu: "Áo sơ mi trắng" ra "o-s-mi-trng".
     */
    private String toSlug(String input) {
        if (input == null) return "";
        String noMark = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")   // bỏ dấu thanh/dấu mũ đã tách rời sau khi chuẩn hoá NFD
                .replace("Đ", "D").replace("đ", "d");   // đ/Đ không tách dấu được bằng NFD
        return noMark.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("[\\s-]+", "-");
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
                    .sku(v.getSku())
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