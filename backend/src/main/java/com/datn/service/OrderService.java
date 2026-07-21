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
    private final VoucherService voucherService;

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
        // BẮT BUỘC set orderCode ngay từ đầu — cột order_code UNIQUE trong DB
        // chỉ cho phép 1 dòng NULL (đặc thù SQL Server), để trống sẽ lỗi insert
        // từ đơn hàng thứ 2 trở đi. Đồng thời đây cũng là mã đơn "thân thiện"
        // hiển thị cho khách (thay vì chỉ có orderId dạng số).
        order.setOrderCode(generateOrderCode());
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

        // ----- Sprint 4: áp mã giảm giá (nếu người dùng có nhập) -----
        order.setSubtotalAmount(total);
        BigDecimal discount = BigDecimal.ZERO;
        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            // applyVoucher() tự validate (hạn dùng, tối thiểu đơn hàng, số lượt còn lại...)
            // và TỰ TĂNG usedCount ngay trong transaction hiện tại — nếu checkout thất bại
            // ở bước sau, toàn bộ (kể cả usedCount vừa tăng) sẽ rollback cùng nhau
            discount = voucherService.applyVoucher(request.getVoucherCode(), total);
            order.setVoucherCode(request.getVoucherCode().trim().toUpperCase());
        }
        order.setDiscountAmount(discount);
        order.setTotalAmount(total.subtract(discount));
        // ----- hết phần voucher -----
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

    /**
     * Sinh mã đơn hàng dạng "DH" + timestamp (mili-giây) + 4 số ngẫu nhiên.
     * Không dùng UUID (quá dài, khó đọc cho khách) — timestamp mili-giây đã
     * gần như không trùng, cộng thêm số ngẫu nhiên để an toàn hơn nếu 2 đơn
     * được tạo trong cùng 1 mili-giây (hiếm nhưng vẫn có thể xảy ra khi tải cao).
     */
    private String generateOrderCode() {
        long timestamp = System.currentTimeMillis();
        int random = new java.util.Random().nextInt(9000) + 1000;
        return "DH" + timestamp + random;
    }

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
                .orderCode(order.getOrderCode())
                .receiverName(order.getReceiverName())
                .phone(order.getPhone())
                .shippingAddress(order.getShippingAddress())
                .totalAmount(order.getTotalAmount())
                .subtotalAmount(order.getSubtotalAmount())
                .discountAmount(order.getDiscountAmount())
                .voucherCode(order.getVoucherCode())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .note(order.getNote())
                .createdAt(order.getCreatedAt())
                .items(items)
                .build();
    }
}