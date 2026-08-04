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

    public PosDto.InvoiceResponse getInvoice(Long orderId) {
        return toResponse(findPendingInvoice(orderId));
    }

    @Transactional
    public PosDto.InvoiceResponse addItem(Long orderId, PosDto.AddItemRequest request) {
        Order order = findPendingInvoice(orderId);

        ProductVariant variant = variantRepository.findById(request.getVariantId())
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

        ProductVariant variant = item.getVariant();
        int delta = request.getQuantity() - item.getQuantity();
        if (variant != null && delta != 0) {
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

        order.setPaymentMethod(request.getPaymentMethod());
        order.setPaymentStatus(Order.PaymentStatus.PAID);
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

        BigDecimal discount = order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO;
        if (discount.compareTo(subtotal) > 0) {
            discount = subtotal;
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