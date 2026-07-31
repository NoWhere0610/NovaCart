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
        ALLOWED_TRANSITIONS.put(Order.Status.SHIPPING, EnumSet.of(Order.Status.DELIVERED));
        // DELIVERED ("cần đánh giá") -> COMPLETED thường do CHÍNH KHÁCH bấm sau khi
        // đánh giá (xem OrderService.completeMyOrder), nhưng admin vẫn có thể tự
        // đóng đơn hộ khách nếu khách không thao tác gì sau một thời gian dài.
        ALLOWED_TRANSITIONS.put(Order.Status.DELIVERED, EnumSet.of(Order.Status.COMPLETED));
        // COMPLETED là điểm cuối từ góc nhìn admin — khách vẫn có thể tự chuyển
        // sang RETURN_REQUESTED (xem OrderService.requestReturn), việc đó KHÔNG
        // đi qua sơ đồ này (admin không chủ động đẩy đơn đã xong sang trả hàng)
        ALLOWED_TRANSITIONS.put(Order.Status.COMPLETED, EnumSet.noneOf(Order.Status.class));
        ALLOWED_TRANSITIONS.put(Order.Status.CANCELLED, EnumSet.noneOf(Order.Status.class));
        // Khách yêu cầu trả hàng -> admin DUYỆT (RETURNED, hoàn kho + xem như đã
        // hoàn tiền) hoặc TỪ CHỐI (trả lại COMPLETED, đơn coi như vẫn hoàn tất)
        ALLOWED_TRANSITIONS.put(Order.Status.RETURN_REQUESTED, EnumSet.of(Order.Status.RETURNED, Order.Status.COMPLETED));
        ALLOWED_TRANSITIONS.put(Order.Status.RETURNED, EnumSet.noneOf(Order.Status.class));
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

        Order.Status oldStatus = order.getStatus();
        Set<Order.Status> allowedNext = ALLOWED_TRANSITIONS.getOrDefault(oldStatus, Set.of());
        if (!allowedNext.contains(newStatus)) {
            throw ApiException.badRequest(
                    "Không thể chuyển đơn hàng từ trạng thái " + oldStatus + " sang " + newStatus);
        }

        // SỬA LỖI: PENDING -> CONFIRMED là thời điểm THỰC SỰ trừ kho đối với đơn
        // online (checkout() không còn trừ kho ngay lúc đặt nữa). Kiểm tra lại
        // tồn kho lần cuối vì từ lúc đặt (PENDING) tới lúc admin xác nhận có thể
        // đã có đơn khác (POS hoặc online khác) bán mất hàng.
        if (oldStatus == Order.Status.PENDING && newStatus == Order.Status.CONFIRMED) {
            for (OrderItem item : order.getItems()) {
                ProductVariant variant = item.getVariant();
                if (variant == null) continue;
                int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
                if (item.getQuantity() > stock) {
                    throw ApiException.badRequest(
                            "Sản phẩm \"" + item.getProductName() + "\" (" + item.getSize() + "/" + item.getColor()
                                    + ") chỉ còn " + stock + " trong kho, không đủ để xác nhận đơn hàng này");
                }
                variant.setStockQuantity(stock - item.getQuantity());
                variantRepository.save(variant);
            }
        }

        // Admin huỷ đơn (CANCELLED) -> CHỈ hoàn kho nếu đơn ĐÃ ở CONFIRMED (tức đã
        // thực sự bị trừ kho ở bước trên); huỷ thẳng từ PENDING thì chưa từng đụng
        // tới kho nên không cần hoàn gì (SỬA LỖI so với bản cũ luôn hoàn kho vô
        // điều kiện). Duyệt trả hàng (RETURNED) thì luôn hoàn kho như cũ, vì đơn
        // RETURNED chắc chắn đã đi qua CONFIRMED (đã bị trừ kho) trước đó rồi.
        boolean shouldRestoreStock = (newStatus == Order.Status.CANCELLED && oldStatus == Order.Status.CONFIRMED)
                || newStatus == Order.Status.RETURNED;
        if (shouldRestoreStock) {
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
                .shippingFee(order.getShippingFee())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .note(order.getNote())
                .returnReason(order.getReturnReason())
                .createdAt(order.getCreatedAt())
                .items(includeItems ? order.getItems().stream().map(i -> OrderItemResponse.builder()
                        .productId(i.getVariant() != null && i.getVariant().getProduct() != null
                                ? i.getVariant().getProduct().getProductId() : null)
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