package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminOrderResponse;
import com.datn.dto.order.OrderItemResponse;
import com.datn.entity.Order;
import com.datn.entity.OrderItem;
import com.datn.entity.ProductVariant;
import com.datn.exception.ApiException;
import com.datn.repository.OrderRepository;
import com.datn.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminOrderService {

    private final OrderRepository orderRepository;
    private final ProductVariantRepository variantRepository;

    /**
     * Sơ đồ trạng thái HỢP LỆ — admin chỉ được chuyển đơn hàng theo đúng các
     * mũi tên này, không được "nhảy cóc" (vd PENDING -> COMPLETED thẳng) hay
     * đi ngược lại. Định nghĩa tập trung ở đây để dễ kiểm soát toàn bộ luồng
     * nghiệp vụ chỉ tại 1 chỗ duy nhất.
     */
    private static final Map<Order.Status, Set<Order.Status>> ALLOWED_TRANSITIONS = new EnumMap<>(Order.Status.class);
    static {
        ALLOWED_TRANSITIONS.put(Order.Status.PENDING, EnumSet.of(Order.Status.CONFIRMED, Order.Status.CANCELLED));
        ALLOWED_TRANSITIONS.put(Order.Status.CONFIRMED, EnumSet.of(Order.Status.SHIPPING, Order.Status.CANCELLED));
        ALLOWED_TRANSITIONS.put(Order.Status.SHIPPING, EnumSet.of(Order.Status.COMPLETED));
        ALLOWED_TRANSITIONS.put(Order.Status.COMPLETED, EnumSet.noneOf(Order.Status.class));
        ALLOWED_TRANSITIONS.put(Order.Status.CANCELLED, EnumSet.noneOf(Order.Status.class));
    }

    public PageResponse<AdminOrderResponse> list(Order.Status status, int page, int size) {
        Page<Order> orders = status == null
                ? orderRepository.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                : orderRepository.findByStatus(status, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.from(orders.map(o -> toResponse(o, false)));
    }

    public AdminOrderResponse getDetail(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));
        return toResponse(order, true);
    }

    @Transactional
    public AdminOrderResponse updateStatus(Long orderId, Order.Status newStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));

        Set<Order.Status> allowedNext = ALLOWED_TRANSITIONS.getOrDefault(order.getStatus(), Set.of());
        if (!allowedNext.contains(newStatus)) {
            throw ApiException.badRequest(
                    "Không thể chuyển đơn hàng từ trạng thái " + order.getStatus() + " sang " + newStatus);
        }

        // Admin huỷ đơn (CANCELLED) -> cũng phải hoàn tồn kho, giống hệt logic
        // user tự huỷ đơn ở OrderService.cancelMyOrder() — tách riêng vì đây là
        // hành động của ADMIN (không kiểm tra chủ sở hữu đơn hàng)
        if (newStatus == Order.Status.CANCELLED) {
            for (OrderItem item : order.getItems()) {
                ProductVariant variant = item.getVariant();
                if (variant != null) {
                    int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
                    variant.setStockQuantity(stock + item.getQuantity());
                    variantRepository.save(variant);
                }
            }
        }

        order.setStatus(newStatus);
        return toResponse(orderRepository.save(order), true);
    }

    private AdminOrderResponse toResponse(Order order, boolean includeItems) {
        return AdminOrderResponse.builder()
                .orderId(order.getOrderId())
                .buyerUserId(order.getUser() != null ? order.getUser().getUserId() : null)
                .buyerUsername(order.getUser() != null ? order.getUser().getUsername() : null)
                .buyerEmail(order.getUser() != null ? order.getUser().getEmail() : null)
                .receiverName(order.getReceiverName())
                .phone(order.getPhone())
                .shippingAddress(order.getShippingAddress())
                .totalAmount(order.getTotalAmount())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .note(order.getNote())
                .createdAt(order.getCreatedAt())
                .items(includeItems ? order.getItems().stream().map(i -> OrderItemResponse.builder()
                        .productName(i.getProductName())
                        .size(i.getSize())
                        .color(i.getColor())
                        .unitPrice(i.getUnitPrice())
                        .quantity(i.getQuantity())
                        .subtotal(i.getSubtotal())
                        .build()).toList() : null)
                .build();
    }
}