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
    private final VoucherService voucherService;

    /** Sơ đồ trạng thái hợp lệ -- admin chỉ được chuyển đơn theo đúng các mũi tên này, không nhảy cóc hay đi ngược. */
    private static final Map<Order.Status, Set<Order.Status>> ALLOWED_TRANSITIONS = new EnumMap<>(Order.Status.class);
    static {
        ALLOWED_TRANSITIONS.put(Order.Status.PENDING, EnumSet.of(Order.Status.CONFIRMED, Order.Status.CANCELLED));
        ALLOWED_TRANSITIONS.put(Order.Status.CONFIRMED, EnumSet.of(Order.Status.SHIPPING, Order.Status.CANCELLED));
        ALLOWED_TRANSITIONS.put(Order.Status.SHIPPING, EnumSet.of(Order.Status.DELIVERED));
        // DELIVERED -> COMPLETED thường do khách tự bấm (OrderService.completeMyOrder), nhưng admin có thể đóng hộ.
        ALLOWED_TRANSITIONS.put(Order.Status.DELIVERED, EnumSet.of(Order.Status.COMPLETED));
        // COMPLETED là điểm cuối với admin -- khách vẫn có thể tự chuyển sang RETURN_REQUESTED
        // (OrderService.requestReturn), không qua sơ đồ này.
        ALLOWED_TRANSITIONS.put(Order.Status.COMPLETED, EnumSet.noneOf(Order.Status.class));
        ALLOWED_TRANSITIONS.put(Order.Status.CANCELLED, EnumSet.noneOf(Order.Status.class));
        // Khách yêu cầu trả hàng -> admin duyệt (RETURNED, hoàn kho) hoặc từ chối (về lại COMPLETED).
        ALLOWED_TRANSITIONS.put(Order.Status.RETURN_REQUESTED, EnumSet.of(Order.Status.RETURNED, Order.Status.COMPLETED));
        ALLOWED_TRANSITIONS.put(Order.Status.RETURNED, EnumSet.noneOf(Order.Status.class));
    }

    // Trang "Quản lý đơn hàng" CHỈ quản lý đơn ONLINE -- đơn POS (bán tại quầy) có luồng/trạng thái
    // riêng, xem/thao tác ở trang Bán hàng tại quầy (PosOrderService). Trộn chung sẽ khiến hoá đơn
    // POS đang tạo dở (PENDING) bị admin bấm "Xác nhận" nhầm -> trừ kho lần 2 + khoá cứng hoá đơn đó
    // (PosOrderService.findPendingInvoice chỉ còn nhận trạng thái PENDING).
    public PageResponse<AdminOrderResponse> list(Order.Status status, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> orders = status == null
                ? orderRepository.findByOrderType(Order.OrderType.ONLINE, pageRequest)
                : orderRepository.findByOrderTypeAndStatus(Order.OrderType.ONLINE, status, pageRequest);
        return PageResponse.from(orders.map(o -> toResponse(o, false)));
    }

    public AdminOrderResponse getDetail(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));
        requireOnlineOrder(order);
        return toResponse(order, true);
    }

    @Transactional
    public AdminOrderResponse updateStatus(Long orderId, Order.Status newStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));
        requireOnlineOrder(order);

        Order.Status oldStatus = order.getStatus();
        Set<Order.Status> allowedNext = ALLOWED_TRANSITIONS.getOrDefault(oldStatus, Set.of());
        if (!allowedNext.contains(newStatus)) {
            throw ApiException.badRequest(
                    "Không thể chuyển đơn hàng từ trạng thái " + oldStatus + " sang " + newStatus);
        }

        // PENDING -> CONFIRMED là lúc thực sự trừ kho cho đơn online -- kiểm tra lại tồn kho vì
        // có thể đã bị đơn khác bán mất từ lúc đặt tới lúc xác nhận.
        if (oldStatus == Order.Status.PENDING && newStatus == Order.Status.CONFIRMED) {
            // Đơn chuyển khoản/VNPay CHƯA thanh toán mà xác nhận nhầm -> trừ kho, giao hàng cho đơn
            // chưa hề nhận được tiền. COD thì luôn UNPAID ở bước này là bình thường (trả khi nhận hàng).
            boolean requiresPaymentFirst = order.getPaymentMethod() == Order.PaymentMethod.BANK_TRANSFER
                    || order.getPaymentMethod() == Order.PaymentMethod.VNPAY;
            if (requiresPaymentFirst && order.getPaymentStatus() != Order.PaymentStatus.PAID) {
                throw ApiException.badRequest(
                        "Đơn hàng chưa được xác nhận thanh toán, không thể xác nhận đơn (xem nút \"Xác nhận đã nhận CK\")");
            }
            for (OrderItem item : order.getItems()) {
                if (item.getVariant() == null) continue;
                // findByIdForUpdate -- khoá row tới hết transaction, tránh 2 đơn cùng được xác nhận
                // song song đọc trùng số tồn của cùng 1 biến thể rồi cùng trừ, đẩy kho về âm.
                ProductVariant variant = variantRepository.findByIdForUpdate(item.getVariant().getVariantId())
                        .orElseThrow(() -> ApiException.notFound("Không tìm thấy sản phẩm"));
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

        // Huỷ đơn chỉ hoàn kho nếu đã ở CONFIRMED (đã từng bị trừ kho); huỷ từ PENDING thì chưa đụng kho.
        // RETURNED luôn hoàn kho vì chắc chắn đã qua CONFIRMED trước đó.
        boolean shouldRestoreStock = (newStatus == Order.Status.CANCELLED && oldStatus == Order.Status.CONFIRMED)
                || newStatus == Order.Status.RETURNED;
        if (shouldRestoreStock) {
            for (OrderItem item : order.getItems()) {
                if (item.getVariant() != null) {
                    // findByIdForUpdate -- khoá row, tránh mất cập nhật tồn kho nếu đúng lúc này biến thể
                    // đang được bán ở nơi khác (PosOrderService/OrderService).
                    ProductVariant variant = variantRepository.findByIdForUpdate(item.getVariant().getVariantId())
                            .orElseThrow(() -> ApiException.notFound("Không tìm thấy sản phẩm"));
                    int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
                    variant.setStockQuantity(stock + item.getQuantity());
                    variantRepository.save(variant);
                }
            }
        }

        // Đơn bị huỷ/trả hàng thì mã giảm giá (nếu có) phải trả lại lượt dùng -- không thì khách bị mất
        // vĩnh viễn 1 lượt cho đơn admin tự huỷ (khác lỗi khách hàng tự huỷ, đã sửa ở OrderService).
        if ((newStatus == Order.Status.CANCELLED || newStatus == Order.Status.RETURNED)
                && order.getVoucherCode() != null && !order.getVoucherCode().isBlank()) {
            voucherService.revertVoucherUsage(order.getVoucherCode());
        }
        // Đơn đã trả tiền thật rồi mới bị huỷ/duyệt trả hàng -- đánh dấu REFUNDED, không để lẫn với
        // UNPAID (chưa ai trả tiền).
        if ((newStatus == Order.Status.CANCELLED || newStatus == Order.Status.RETURNED)
                && order.getPaymentStatus() == Order.PaymentStatus.PAID) {
            order.setPaymentStatus(Order.PaymentStatus.REFUNDED);
        }

        // Mốc giao hàng -- hạn đổi trả 7 ngày đếm từ đây (OrderService.requestReturn). Chỉ ghi lần đầu
        // để không bị đẩy lùi nếu sau này có thao tác nào đưa đơn về DELIVERED lần nữa.
        if (newStatus == Order.Status.DELIVERED && order.getDeliveredAt() == null) {
            order.setDeliveredAt(java.time.LocalDateTime.now());
        }
        if (newStatus == Order.Status.RETURNED) {
            order.setReturnedAt(java.time.LocalDateTime.now());
        }
        order.setStatus(newStatus);
        return toResponse(orderRepository.save(order), true);
    }

    /** Admin xác nhận đã nhận được tiền chuyển khoản (khách tự chuyển qua QR, không qua cổng thanh toán
     * tự động như VNPay nên không có webhook nào báo -- phải xác nhận tay). */
    @Transactional
    public AdminOrderResponse confirmPayment(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));
        requireOnlineOrder(order);

        if (order.getPaymentMethod() != Order.PaymentMethod.BANK_TRANSFER) {
            throw ApiException.badRequest("Chỉ đơn chuyển khoản ngân hàng mới cần xác nhận thủ công");
        }
        if (order.getPaymentStatus() == Order.PaymentStatus.PAID) {
            throw ApiException.badRequest("Đơn hàng đã được xác nhận thanh toán trước đó");
        }
        // Đơn đã huỷ/trả hàng thì không còn ý nghĩa gì để xác nhận thanh toán nữa (khách không nhận
        // hàng), tránh admin bấm nhầm biến đơn đã chết thành "đã thanh toán".
        if (order.getStatus() == Order.Status.CANCELLED || order.getStatus() == Order.Status.RETURNED) {
            throw ApiException.badRequest("Đơn hàng đã huỷ/trả hàng, không thể xác nhận thanh toán");
        }

        order.setPaymentStatus(Order.PaymentStatus.PAID);
        return toResponse(orderRepository.save(order), true);
    }

    /** Chặn thao tác trạng thái/thanh toán của trang "Quản lý đơn hàng" lên đơn POS -- xem chú thích ở list(). */
    private void requireOnlineOrder(Order order) {
        if (order.getOrderType() == Order.OrderType.POS) {
            throw ApiException.badRequest(
                    "Đơn bán tại quầy (POS) không quản lý qua đây -- dùng trang \"Bán hàng tại quầy\"");
        }
    }

    private AdminOrderResponse toResponse(Order order, boolean includeItems) {
        return AdminOrderResponse.builder()
                .orderId(order.getOrderId())
                .orderType(order.getOrderType())
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
                .paymentStatus(order.getPaymentStatus())
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