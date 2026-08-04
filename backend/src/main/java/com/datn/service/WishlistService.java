package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.ProductResponse;
import com.datn.entity.Product;
import com.datn.entity.ProductImage;
import com.datn.entity.User;
import com.datn.entity.Wishlist;
import com.datn.exception.ApiException;
import com.datn.repository.ProductRepository;
import com.datn.repository.WishlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public List<Long> getProductIds(Long userId) {
        return wishlistRepository.findProductIdsByUser_UserId(userId);
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> list(Long userId, Pageable pageable) {
        Page<Wishlist> page = wishlistRepository.findByUser_UserIdOrderByCreatedAtDesc(userId, pageable);
        return PageResponse.from(page.map(w -> toProductResponse(w.getProduct())));
    }

    // Idempotent -- bấm tim khi ĐÃ lưu rồi (vd 2 tab cùng lưu) không nên báo lỗi, chỉ cần đảm bảo cuối
    // cùng có đúng 1 dòng trong wishlist.
    @Transactional
    public void add(Long userId, Long productId) {
        if (wishlistRepository.existsByUser_UserIdAndProduct_ProductId(userId, productId)) {
            return;
        }
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> ApiException.notFound("Sản phẩm không tồn tại"));

        User userRef = new User();
        userRef.setUserId(userId);

        Wishlist w = new Wishlist();
        w.setUser(userRef);
        w.setProduct(product);
        wishlistRepository.save(w);
    }

    @Transactional
    public void remove(Long userId, Long productId) {
        wishlistRepository.deleteByUser_UserIdAndProduct_ProductId(userId, productId);
    }

    // Giống HomeService.toProductResponse() -- KHÔNG tái dùng chung (inject HomeService vào đây chỉ để
    // gọi 1 hàm private) vì tạo phụ thuộc chéo giữa 2 service không cần thiết cho 1 đoạn map ngắn.
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
}
