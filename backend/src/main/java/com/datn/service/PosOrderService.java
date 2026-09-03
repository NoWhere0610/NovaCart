package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.order.OrderItemResponse;
import com.datn.dto.pos.PosDto;
import com.datn.entity.Order;
import com.datn.entity.OrderItem;
import com.datn.entity.ProductVariant;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.OrderItemRepository;
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

/**
 * Bán hàng tại quầy (POS). Khác đơn ONLINE (trừ kho lúc admin xác nhận),
 * đơn POS trừ kho ngay khi thêm sản phẩm vào hoá đơn.
 *
 * Dùng 3 trạng thái của Order.Status: PENDING (đang tạo), COMPLETED (đã thanh toán),
 * CANCELLED (đã huỷ, hoàn kho + hoàn voucher).
 */
@Service
@RequiredArgsConstructor
public class PosOrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductVariantRepository variantRepository;
    private final VoucherService voucherService;

    @Transactional
    public PosDto.InvoiceResponse createInvoice(Long cashierId) {
        Order order = new Order();
        order.setOrderType(Order.OrderType.POS);
        order.setOrderCode(generateOrderCode());
        User cashierRef = new User();
        cashierRef.setUserId(cashierId);
        order.setCashier(cashierRef);
        order.setStatus(Order.Status.PENDING);
        order.setPaymentMethod(Order.PaymentMethod.COD);
        order.setSubtotalAmount(BigDecimal.ZERO);
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setTotalAmount(BigDecimal.ZERO);
        return toResponse(orderRepository.save(order));
    }

    public PageResponse<PosDto.InvoiceResponse> listPendingInvoices(int page, int size) {
        Page<Order> orders = orderRepository.findByOrderTypeAndStatus(
                Order.OrderType.POS, Order.Status.PENDING,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.from(orders.map(this::toResponse));
    }

    /** Xem lại hoá đơn (kể cả để in) — KHÔNG dùng findPendingInvoice(), vì đó là để chặn SỬA hoá đơn đã
     * chốt, không phải để chặn XEM. Hoá đơn đã thanh toán/huỷ vẫn phải xem/in lại được bình thường. */
    public PosDto.InvoiceResponse getInvoice(Long orderId) {
        Order order = orderRepository.findByOrderIdAndOrderType(orderId, Order.OrderType.POS)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy hoá đơn"));
        return toResponse(order);
    }

    @Transactional
    public PosDto.InvoiceResponse addItem(Long orderId, PosDto.AddItemRequest request) {
        Order order = findPendingInvoice(orderId);

        // findByIdForUpdate -- khoá row tới hết transaction, tránh 2 quầy cùng bán biến thể cuối cùng
        // đọc trùng số tồn rồi cùng trừ, đẩy kho về âm.
        ProductVariant variant = variantRepository.findByIdForUpdate(request.getVariantId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy sản phẩm"));

        int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
        if (request.getQuantity() > stock) {
            throw ApiException.badRequest(
                    "Sản phẩm \"" + variant.getProduct().getProductName() + "\" chỉ còn " + stock + " trong kho");
        }

        OrderItem existing = order.getItems().stream()
                .filter(i -> i.getVariant() != null && i.getVariant().getVariantId().equals(variant.getVariantId()))
                .findFirst().orElse(null);

        BigDecimal unitPrice = CartService.effectivePrice(variant.getProduct());

        if (existing != null) {
            existing.setQuantity(existing.getQuantity() + request.getQuantity());
            existing.setSubtotal(unitPrice.multiply(BigDecimal.valueOf(existing.getQuantity())));
        } else {
            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setVariant(variant);
            item.setProductName(variant.getProduct().getProductName());
            item.setSize(variant.getSize());
            item.setColor(variant.getColor());
            item.setUnitPrice(unitPrice);
            item.setQuantity(request.getQuantity());
            item.setSubtotal(unitPrice.multiply(BigDecimal.valueOf(request.getQuantity())));
            order.getItems().add(item);
        }

        // Trừ kho ngay — điểm khác biệt cốt lõi so với đơn online
        variant.setStockQuantity(stock - request.getQuantity());
        variantRepository.save(variant);

        recalculateTotals(order);
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public PosDto.InvoiceResponse updateItemQuantity(Long orderId, Long orderItemId, PosDto.UpdateItemQuantityRequest request) {
        Order order = findPendingInvoice(orderId);
        OrderItem item = orderItemRepository.findByOrderItemIdAndOrder_OrderId(orderItemId, orderId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy dòng sản phẩm trong hoá đơn"));

        int delta = request.getQuantity() - item.getQuantity();
        if (item.getVariant() != null && delta != 0) {
            // findByIdForUpdate -- khoá row (xem chú thích ở addItem()), quan trọng nhất khi delta > 0
            // (đang trừ thêm kho, không phải đang hoàn lại).
            ProductVariant variant = variantRepository.findByIdForUpdate(item.getVariant().getVariantId())
                    .orElseThrow(() -> ApiException.notFound("Không tìm thấy sản phẩm"));
            int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
            if (delta > 0 && delta > stock) {
                throw ApiException.badRequest(
                        "Sản phẩm \"" + item.getProductName() + "\" chỉ còn " + stock + " trong kho");
            }
            variant.setStockQuantity(stock - delta);
            variantRepository.save(variant);
        }

        item.setQuantity(request.getQuantity());
        item.setSubtotal(item.getUnitPrice().multiply(BigDecimal.valueOf(request.getQuantity())));

        recalculateTotals(order);
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public PosDto.InvoiceResponse removeItem(Long orderId, Long orderItemId) {
        Order order = findPendingInvoice(orderId);
        OrderItem item = orderItemRepository.findByOrderItemIdAndOrder_OrderId(orderItemId, orderId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy dòng sản phẩm trong hoá đơn"));

        ProductVariant variant = item.getVariant();
        if (variant != null) {
            int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
            variant.setStockQuantity(stock + item.getQuantity());
            variantRepository.save(variant);
        }

        order.getItems().remove(item);
        recalculateTotals(order);
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public PosDto.InvoiceResponse applyVoucher(Long orderId, PosDto.VoucherRequest request) {
        Order order = findPendingInvoice(orderId);

        if (order.getVoucherCode() != null && !order.getVoucherCode().isBlank()) {
            voucherService.revertVoucherUsage(order.getVoucherCode());
            order.setVoucherCode(null);
            order.setDiscountAmount(BigDecimal.ZERO);
        }

        BigDecimal subtotal = order.getSubtotalAmount() != null ? order.getSubtotalAmount() : BigDecimal.ZERO;
        BigDecimal discount = voucherService.applyVoucher(request.getVoucherCode(), subtotal);
        order.setVoucherCode(request.getVoucherCode().trim().toUpperCase());
        order.setDiscountAmount(discount);
        order.setTotalAmount(subtotal.subtract(discount));

        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public PosDto.InvoiceResponse removeVoucher(Long orderId) {
        Order order = findPendingInvoice(orderId);
        if (order.getVoucherCode() != null && !order.getVoucherCode().isBlank()) {
            voucherService.revertVoucherUsage(order.getVoucherCode());
        }
        order.setVoucherCode(null);
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setTotalAmount(order.getSubtotalAmount() != null ? order.getSubtotalAmount() : BigDecimal.ZERO);
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public PosDto.InvoiceResponse checkout(Long orderId, PosDto.CheckoutRequest request) {
        Order order = findPendingInvoice(orderId);
        if (order.getItems().isEmpty()) {
            throw ApiException.badRequest("Hoá đơn chưa có sản phẩm nào, không thể thanh toán");
        }
        // POS chỉ hỗ trợ 2 phương thức tại quầy (khớp PosDto.CheckoutRequest) -- chặn ở service phòng
        // trường hợp có client khác gọi thẳng API với VNPAY/MOMO, tự set PAID mà không hề qua cổng nào.
        if (request.getPaymentMethod() != Order.PaymentMethod.COD
                && request.getPaymentMethod() != Order.PaymentMethod.BANK_TRANSFER) {
            throw ApiException.badRequest("Thanh toán tại quầy chỉ hỗ trợ Tiền mặt hoặc Chuyển khoản");
        }

        order.setPaymentMethod(request.getPaymentMethod());
        // Tiền mặt -- thu ngân cầm tiền trực tiếp nên coi như đã thanh toán ngay. Chuyển khoản thì
        // KHÔNG tự động PAID -- khớp đúng nguyên tắc đang áp dụng cho đơn online (OrderService/
        // AdminOrderService.confirmPayment): không có cổng thanh toán tự động nào báo webhook, phải
        // xác nhận tay sau khi thu ngân tự kiểm tra app ngân hàng đã nhận được tiền chưa.
        order.setPaymentStatus(
                request.getPaymentMethod() == Order.PaymentMethod.BANK_TRANSFER
                        ? Order.PaymentStatus.UNPAID
                        : Order.PaymentStatus.PAID);
        order.setReceiverName(request.getCustomerName());
        order.setPhone(request.getCustomerPhone());
        order.setNote(request.getNote());
        order.setStatus(Order.Status.COMPLETED);

        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public void cancelInvoice(Long orderId) {
        Order order = findPendingInvoice(orderId);

        for (OrderItem item : order.getItems()) {
            ProductVariant variant = item.getVariant();
            if (variant != null) {
                int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
                variant.setStockQuantity(stock + item.getQuantity());
                variantRepository.save(variant);
            }
        }
        if (order.getVoucherCode() != null && !order.getVoucherCode().isBlank()) {
            voucherService.revertVoucherUsage(order.getVoucherCode());
        }

        order.setStatus(Order.Status.CANCELLED);
        orderRepository.save(order);
    }

    /** Thu ngân xác nhận đã nhận được tiền chuyển khoản (tự kiểm tra app ngân hàng) -- xem chú thích ở checkout(). */
    @Transactional
    public PosDto.InvoiceResponse confirmPayment(Long orderId) {
        Order order = orderRepository.findByOrderIdAndOrderType(orderId, Order.OrderType.POS)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy hoá đơn"));
        if (order.getPaymentMethod() != Order.PaymentMethod.BANK_TRANSFER) {
            throw ApiException.badRequest("Chỉ hoá đơn chuyển khoản mới cần xác nhận thủ công");
        }
        if (order.getPaymentStatus() == Order.PaymentStatus.PAID) {
            throw ApiException.badRequest("Hoá đơn đã được xác nhận thanh toán trước đó");
        }
        // Hoá đơn đã bị huỷ/hoàn thì không còn ý nghĩa gì để xác nhận thanh toán nữa.
        if (order.getStatus() != Order.Status.COMPLETED) {
            throw ApiException.badRequest("Hoá đơn không ở trạng thái hợp lệ để xác nhận thanh toán");
        }
        order.setPaymentStatus(Order.PaymentStatus.PAID);
        return toResponse(orderRepository.save(order));
    }

    /**
     * Hoàn/huỷ 1 hoá đơn ĐÃ THANH TOÁN (vd quét nhầm hàng, khách trả hàng ngay tại quầy) -- khác
     * cancelInvoice() chỉ áp dụng cho hoá đơn PENDING chưa chốt. Dùng chung status RETURNED với
     * đơn online (OrderService/AdminOrderService) để AdminStatisticsService tự động trừ đúng doanh
     * thu, không cần sửa gì thêm ở tầng thống kê.
     */
    @Transactional
    public PosDto.InvoiceResponse voidCompletedInvoice(Long orderId) {
        Order order = orderRepository.findByOrderIdAndOrderType(orderId, Order.OrderType.POS)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy hoá đơn"));
        if (order.getStatus() != Order.Status.COMPLETED) {
            throw ApiException.badRequest("Chỉ hoá đơn đã thanh toán mới hoàn/huỷ được theo cách này");
        }

        for (OrderItem item : order.getItems()) {
            ProductVariant variant = item.getVariant();
            if (variant != null) {
                int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
                variant.setStockQuantity(stock + item.getQuantity());
                variantRepository.save(variant);
            }
        }
        if (order.getVoucherCode() != null && !order.getVoucherCode().isBlank()) {
            voucherService.revertVoucherUsage(order.getVoucherCode());
        }
        // Chỉ đánh dấu REFUNDED nếu hoá đơn thật sự đã PAID (BANK_TRANSFER chưa được thu ngân xác nhận
        // thì vẫn đang UNPAID, không có gì để "hoàn" cả).
        if (order.getPaymentStatus() == Order.PaymentStatus.PAID) {
            order.setPaymentStatus(Order.PaymentStatus.REFUNDED);
        }

        order.setStatus(Order.Status.RETURNED);
        return toResponse(orderRepository.save(order));
    }

    // ----- helper nội bộ -----

    private Order findPendingInvoice(Long orderId) {
        Order order = orderRepository.findByOrderIdAndOrderType(orderId, Order.OrderType.POS)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy hoá đơn"));
        if (order.getStatus() != Order.Status.PENDING) {
            throw ApiException.badRequest("Hoá đơn này đã thanh toán hoặc đã huỷ, không thể thao tác thêm");
        }
        return order;
    }

    private void recalculateTotals(Order order) {
        BigDecimal subtotal = order.getItems().stream()
                .map(OrderItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setSubtotalAmount(subtotal);

        // TÍNH LẠI (không phải chỉ cap trần) số tiền giảm mỗi khi giỏ hàng thay đổi -- mã % tính trên
        // subtotal MỚI, không phải đông cứng số tiền lúc áp mã (vd thêm hàng sau khi áp mã 10% thì phải
        // giảm nhiều hơn, không phải vẫn giữ đúng số cũ).
        BigDecimal discount = BigDecimal.ZERO;
        if (order.getVoucherCode() != null && !order.getVoucherCode().isBlank()) {
            try {
                discount = voucherService.previewDiscount(order.getVoucherCode(), subtotal);
            } catch (ApiException ex) {
                // Giỏ hàng thay đổi khiến mã không còn hợp lệ nữa (vd dưới min_order_value sau khi bớt
                // hàng) -- tự bỏ mã thay vì giữ số tiền giảm cũ (sai) hoặc throw giữa lúc sửa giỏ hàng.
                voucherService.revertVoucherUsage(order.getVoucherCode());
                order.setVoucherCode(null);
            }
        }
        order.setDiscountAmount(discount);
        order.setTotalAmount(subtotal.subtract(discount));
    }

    private String generateOrderCode() {
        long timestamp = System.currentTimeMillis();
        int random = new java.util.Random().nextInt(9000) + 1000;
        return "HD" + timestamp + random;
    }

    private PosDto.InvoiceResponse toResponse(Order order) {
        List<OrderItemResponse> items = order.getItems().stream().map(i -> OrderItemResponse.builder()
                .orderItemId(i.getOrderItemId())
                .variantId(i.getVariant() != null ? i.getVariant().getVariantId() : null)
                .productId(i.getVariant() != null && i.getVariant().getProduct() != null
                        ? i.getVariant().getProduct().getProductId() : null)
                .productName(i.getProductName())
                .size(i.getSize())
                .color(i.getColor())
                .unitPrice(i.getUnitPrice())
                .quantity(i.getQuantity())
                .subtotal(i.getSubtotal())
                .build()).toList();

        return PosDto.InvoiceResponse.builder()
                .orderId(order.getOrderId())
                .orderCode(order.getOrderCode())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .customerName(order.getReceiverName())
                .customerPhone(order.getPhone())
                .subtotalAmount(order.getSubtotalAmount())
                .discountAmount(order.getDiscountAmount())
                .voucherCode(order.getVoucherCode())
                .totalAmount(order.getTotalAmount())
                .cashierUsername(order.getCashier() != null ? order.getCashier().getUsername() : null)
                .createdAt(order.getCreatedAt())
                .items(items)
                .build();
    }
}