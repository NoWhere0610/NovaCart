package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.order.CheckoutRequest;
import com.datn.dto.order.OrderItemResponse;
import com.datn.dto.order.OrderResponse;
import com.datn.entity.*;
import com.datn.exception.ApiException;
import com.datn.repository.AddressRepository;
import com.datn.repository.CartRepository;
import com.datn.repository.OrderRepository;
import com.datn.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final CartRepository cartRepository;
    private final AddressRepository addressRepository;
    private final ProductVariantRepository variantRepository;
    private final OrderRepository orderRepository;

    /**
     * Checkout: chuyển TOÀN BỘ giỏ hàng hiện tại thành 1 đơn hàng.
     * Đây là thao tác NHẠY CẢM NHẤT trong toàn hệ thống (đụng tới tồn kho + tiền)
     * nên @Transactional bắt buộc phải có: nếu bất kỳ dòng nào lỗi (hết hàng giữa
     * chừng, dữ liệu sai...) toàn bộ phải rollback, KHÔNG được để xảy ra tình
     * trạng trừ kho 1 nửa hoặc tạo đơn hàng rỗng.
     */
    @Transactional
    public OrderResponse checkout(Long userId, CheckoutRequest request) {
        Cart cart = cartRepository.findByUser_UserId(userId)
                .orElseThrow(() -> ApiException.badRequest("Giỏ hàng trống, không thể đặt hàng"));

        if (cart.getItems().isEmpty()) {
            throw ApiException.badRequest("Giỏ hàng trống, không thể đặt hàng");
        }

        // Địa chỉ phải tồn tại VÀ thuộc đúng user đang checkout (không cho dùng
        // addressId của người khác chỉ bằng cách sửa số trên request)
        Address address = addressRepository.findById(request.getAddressId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy địa chỉ giao hàng"));
        if (!address.getUser().getUserId().equals(userId)) {
            throw ApiException.forbidden("Địa chỉ giao hàng không hợp lệ");
        }

        Order order = new Order();
        User userRef = new User();
        userRef.setUserId(userId);
        order.setUser(userRef);
        order.setReceiverName(address.getReceiverName());
        order.setPhone(address.getPhone());
        order.setShippingAddress(buildFullAddress(address));
        order.setPaymentMethod(request.getPaymentMethod());
        order.setNote(request.getNote());
        order.setStatus(Order.Status.PENDING);

        BigDecimal total = BigDecimal.ZERO;

        // Duyệt từng dòng trong giỏ: kiểm tra lại tồn kho LẦN CUỐI (có thể đã đổi
        // kể từ lúc user thêm vào giỏ), trừ kho ngay, và snapshot lại thông tin
        // sản phẩm vào OrderItem
        for (CartItem cartItem : cart.getItems()) {
            ProductVariant variant = variantRepository.findById(cartItem.getVariant().getVariantId())
                    .orElseThrow(() -> ApiException.notFound("Sản phẩm không còn tồn tại"));

            int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
            if (cartItem.getQuantity() > stock) {
                throw ApiException.badRequest(
                        "Sản phẩm \"" + variant.getProduct().getProductName() + "\" chỉ còn " + stock + " sản phẩm");
            }

            // Trừ kho ngay tại thời điểm đặt hàng (đồ án đơn giản hoá: không tách
            // riêng bước "giữ chỗ tạm" - trừ thẳng vì COD là phương thức chính)
            variant.setStockQuantity(stock - cartItem.getQuantity());
            variantRepository.save(variant);

            BigDecimal unitPrice = CartService.effectivePrice(variant.getProduct());
            BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(cartItem.getQuantity()));
            total = total.add(subtotal);

            OrderItem orderItem = new OrderItem();
            orderItem.setOrder(order);
            orderItem.setVariant(variant);
            orderItem.setProductName(variant.getProduct().getProductName());
            orderItem.setSize(variant.getSize());
            orderItem.setColor(variant.getColor());
            orderItem.setUnitPrice(unitPrice);
            orderItem.setQuantity(cartItem.getQuantity());
            orderItem.setSubtotal(subtotal);
            order.getItems().add(orderItem);
        }

        order.setTotalAmount(total);
        Order saved = orderRepository.save(order);

        // Đặt hàng xong -> dọn sạch giỏ hàng (orphanRemoval=true trên Cart.items
        // sẽ tự xoá hết CartItem trong DB khi list được clear())
        cart.getItems().clear();
        cartRepository.save(cart);

        return toResponse(saved, true);
    }

    /** Trang "Đơn hàng của tôi" — phân trang, đơn mới nhất lên đầu. */
    public PageResponse<OrderResponse> getMyOrders(Long userId, int page, int size) {
        Page<Order> orders = orderRepository.findByUser_UserId(
                userId, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        Page<OrderResponse> mapped = orders.map(o -> toResponse(o, false));
        return PageResponse.from(mapped);
    }

    public OrderResponse getMyOrderDetail(Long userId, Long orderId) {
        Order order = orderRepository.findByOrderIdAndUser_UserId(orderId, userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));
        return toResponse(order, true);
    }

    /** Khách chỉ được tự huỷ đơn khi đơn CÒN CHƯA được xác nhận/giao (PENDING/CONFIRMED). */
    @Transactional
    public OrderResponse cancelMyOrder(Long userId, Long orderId) {
        Order order = orderRepository.findByOrderIdAndUser_UserId(orderId, userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));

        if (order.getStatus() != Order.Status.PENDING && order.getStatus() != Order.Status.CONFIRMED) {
            throw ApiException.badRequest("Đơn hàng đang giao hoặc đã hoàn tất, không thể huỷ");
        }

        // Huỷ đơn -> hoàn lại tồn kho đã trừ lúc đặt hàng
        for (OrderItem item : order.getItems()) {
            ProductVariant variant = item.getVariant();
            if (variant != null) {
                int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
                variant.setStockQuantity(stock + item.getQuantity());
                variantRepository.save(variant);
            }
        }

        order.setStatus(Order.Status.CANCELLED);
        return toResponse(orderRepository.save(order), true);
    }

    // ----- helper nội bộ -----

    private String buildFullAddress(Address a) {
        return String.join(", ",
                nonBlankOrEmpty(a.getDetailAddress()),
                nonBlankOrEmpty(a.getWard()),
                nonBlankOrEmpty(a.getDistrict()),
                nonBlankOrEmpty(a.getProvince())
        ).replaceAll("(, )+", ", ").replaceAll("^, |, $", "");
    }

    private String nonBlankOrEmpty(String s) {
        return s == null ? "" : s;
    }

    private OrderResponse toResponse(Order order, boolean includeItems) {
        List<OrderItemResponse> items = includeItems
                ? order.getItems().stream().map(i -> OrderItemResponse.builder()
                    .productName(i.getProductName())
                    .size(i.getSize())
                    .color(i.getColor())
                    .unitPrice(i.getUnitPrice())
                    .quantity(i.getQuantity())
                    .subtotal(i.getSubtotal())
                    .build()).toList()
                : null;

        return OrderResponse.builder()
                .orderId(order.getOrderId())
                .receiverName(order.getReceiverName())
                .phone(order.getPhone())
                .shippingAddress(order.getShippingAddress())
                .totalAmount(order.getTotalAmount())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .note(order.getNote())
                .createdAt(order.getCreatedAt())
                .items(items)
                .build();
    }
}