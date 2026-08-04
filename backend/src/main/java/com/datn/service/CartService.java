package com.datn.service;

import com.datn.dto.cart.AddToCartRequest;
import com.datn.dto.cart.CartItemResponse;
import com.datn.dto.cart.CartResponse;
import com.datn.entity.Cart;
import com.datn.entity.CartItem;
import com.datn.entity.Product;
import com.datn.entity.ProductVariant;
import com.datn.entity.ProductImage;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.CartItemRepository;
import com.datn.repository.CartRepository;
import com.datn.repository.ProductImageRepository;
import com.datn.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductVariantRepository variantRepository;
    private final ProductImageRepository productImageRepository;

    // ================== XEM GIỎ HÀNG ==================

    public CartResponse getMyCart(Long userId) {
        Cart cart = getOrCreateCart(userId);
        return toResponse(cart);
    }

    // ================== THÊM SẢN PHẨM ==================

    @Transactional
    public CartResponse addItem(Long userId, AddToCartRequest request) {
        Cart cart = getOrCreateCart(userId);

        ProductVariant variant = variantRepository.findById(request.getVariantId())
                .orElseThrow(() -> ApiException.notFound("Sản phẩm không tồn tại"));

        // Nếu variant này đã có sẵn trong giỏ -> CỘNG DỒN số lượng thay vì tạo dòng mới
        CartItem item = cartItemRepository
                .findByCart_CartIdAndVariant_VariantId(cart.getCartId(), variant.getVariantId())
                .orElseGet(() -> {
                    CartItem newItem = new CartItem();
                    newItem.setCart(cart);
                    newItem.setVariant(variant);
                    newItem.setQuantity(0);
                    return newItem;
                });

        int newQuantity = item.getQuantity() + request.getQuantity();
        validateStock(variant, newQuantity);
        item.setQuantity(newQuantity);
        cartItemRepository.save(item);

        // Load lại cart để lấy danh sách items mới nhất (tránh cache stale trong session)
        return toResponse(cartRepository.findByUser_UserId(userId).orElseThrow());
    }

    // ================== SỬA SỐ LƯỢNG ==================

    @Transactional
    public CartResponse updateItemQuantity(Long userId, Long cartItemId, int quantity) {
        CartItem item = getOwnedCartItemOrThrow(userId, cartItemId);
        validateStock(item.getVariant(), quantity);
        item.setQuantity(quantity);
        cartItemRepository.save(item);
        return toResponse(cartRepository.findByUser_UserId(userId).orElseThrow());
    }

    // ================== XOÁ 1 DÒNG ==================

    @Transactional
    public CartResponse removeItem(Long userId, Long cartItemId) {
        CartItem item = getOwnedCartItemOrThrow(userId, cartItemId);
        cartItemRepository.delete(item);
        return toResponse(cartRepository.findByUser_UserId(userId).orElseThrow());
    }

    // ================== helper nội bộ ==================

    /** Mỗi user chỉ có 1 Cart — tạo mới nếu đây là lần đầu tiên thêm hàng. */
    private Cart getOrCreateCart(Long userId) {
        return cartRepository.findByUser_UserId(userId).orElseGet(() -> {
            Cart cart = new Cart();
            User userRef = new User();
            userRef.setUserId(userId);
            cart.setUser(userRef);
            return cartRepository.save(cart);
        });
    }

    /** Kiểm tra cartItem có tồn tại VÀ thuộc đúng giỏ hàng của user đang đăng nhập. */
    private CartItem getOwnedCartItemOrThrow(Long userId, Long cartItemId) {
        CartItem item = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy sản phẩm trong giỏ"));
        if (!item.getCart().getUser().getUserId().equals(userId)) {
            throw ApiException.forbidden("Bạn không có quyền thao tác trên giỏ hàng này");
        }
        return item;
    }

    /** Chặn thêm/sửa số lượng vượt quá tồn kho thực tế của variant. */
    private void validateStock(ProductVariant variant, int requestedQuantity) {
        int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
        if (requestedQuantity > stock) {
            throw ApiException.badRequest(
                    "Sản phẩm chỉ còn " + stock + " sản phẩm trong kho");
        }
    }

    /** Giá áp dụng = salePrice nếu có (đang giảm giá), ngược lại dùng giá gốc price. */
    static BigDecimal effectivePrice(Product product) {
        return product.getSalePrice() != null ? product.getSalePrice() : product.getPrice();
    }

    private CartResponse toResponse(Cart cart) {
        List<CartItem> rawItems = cart.getItems();

        // Batch 1 query lấy ảnh cho TẤT CẢ sản phẩm trong giỏ, thay vì product.getImages() lazy-load
        // riêng từng dòng (N+1) -- xem giải thích ở ProductImageRepository.findByProduct_ProductIdInOrderByDisplayOrderAsc.
        List<Long> productIds = rawItems.stream()
                .map(ci -> ci.getVariant().getProduct().getProductId())
                .distinct()
                .toList();
        Map<Long, String> firstImageUrlByProductId = new HashMap<>();
        for (ProductImage img : productImageRepository.findByProduct_ProductIdInOrderByDisplayOrderAsc(productIds)) {
            firstImageUrlByProductId.putIfAbsent(img.getProduct().getProductId(), img.getImageUrl());
        }

        List<CartItemResponse> items = rawItems.stream().map(ci -> {
            ProductVariant variant = ci.getVariant();
            Product product = variant.getProduct();
            BigDecimal unitPrice = effectivePrice(product);
            BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(ci.getQuantity()));

            return CartItemResponse.builder()
                    .cartItemId(ci.getCartItemId())
                    .variantId(variant.getVariantId())
                    .productId(product.getProductId())
                    .productName(product.getProductName())
                    .imageUrl(firstImageUrlByProductId.get(product.getProductId()))
                    .size(variant.getSize())
                    .color(variant.getColor())
                    .unitPrice(unitPrice)
                    .quantity(ci.getQuantity())
                    .subtotal(subtotal)
                    .stockQuantity(variant.getStockQuantity())
                    .build();
        }).toList();

        int totalQuantity = items.stream().mapToInt(CartItemResponse::getQuantity).sum();
        BigDecimal totalAmount = items.stream()
                .map(CartItemResponse::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return CartResponse.builder()
                .items(items)
                .totalQuantity(totalQuantity)
                .totalAmount(totalAmount)
                .build();
    }
}