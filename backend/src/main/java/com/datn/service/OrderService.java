package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.order.CheckoutRequest;
import com.datn.dto.order.OrderItemResponse;
import com.datn.dto.order.OrderResponse;
import com.datn.dto.order.RequestReturnRequest;
import com.datn.entity.*;
import com.datn.exception.ApiException;
import com.datn.repository.AddressRepository;
import com.datn.repository.CartRepository;
import com.datn.repository.OrderRepository;
import com.datn.repository.ProductVariantRepository;
import com.datn.repository.ReviewRepository;
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
    private final ReviewRepository reviewRepository;
    private final ShippingService shippingService;
    private final VNPayService vnPayService;
    private final VietQrService vietQrService;

    @Transactional
    public OrderResponse checkout(Long userId, CheckoutRequest request) {
        // findByUser_UserIdForUpdate -- khoá row Cart tới hết transaction. Không có khoá này, double-click
        // "Đặt hàng" hoặc gửi 2 request checkout gần như đồng thời có thể cả hai cùng đọc y hệt danh sách
        // item TRƯỚC KHI request kia kịp xoá giỏ, tạo ra 2 đơn hàng trùng nhau cho cùng 1 lần mua.
        Cart cart = cartRepository.findByUser_UserIdForUpdate(userId)
                .orElseThrow(() -> ApiException.badRequest("Giỏ hàng trống, không thể đặt hàng"));

        if (cart.getItems().isEmpty()) {
            throw ApiException.badRequest("Giỏ hàng trống, không thể đặt hàng");
        }

        // cartItemIds có giá trị -> chỉ đặt hàng đúng các dòng đã chọn (mua đơn lẻ 1 phần giỏ hàng),
        // giữ lại các dòng còn lại trong giỏ. null -> đặt hàng CẢ giỏ như hành vi cũ.
        List<CartItem> itemsToCheckout = request.getCartItemIds() == null
                ? cart.getItems()
                : cart.getItems().stream()
                        .filter(ci -> request.getCartItemIds().contains(ci.getCartItemId()))
                        .toList();
        if (itemsToCheckout.isEmpty()) {
            throw ApiException.badRequest("Không có sản phẩm nào được chọn để đặt hàng");
        }

        Address address = addressRepository.findById(request.getAddressId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy địa chỉ giao hàng"));
        if (!address.getUser().getUserId().equals(userId)) {
            throw ApiException.forbidden("Địa chỉ giao hàng không hợp lệ");
        }

        Order order = new Order();
        User userRef = new User();
        userRef.setUserId(userId);
        order.setUser(userRef);
        order.setOrderCode(generateOrderCode());
        order.setReceiverName(address.getReceiverName());
        order.setPhone(address.getPhone());
        order.setShippingAddress(buildFullAddress(address));
        order.setPaymentMethod(request.getPaymentMethod());
        order.setNote(request.getNote());
        order.setStatus(Order.Status.PENDING);

        BigDecimal total = BigDecimal.ZERO;

        for (CartItem cartItem : itemsToCheckout) {
            ProductVariant variant = variantRepository.findById(cartItem.getVariant().getVariantId())
                    .orElseThrow(() -> ApiException.notFound("Sản phẩm không còn tồn tại"));
            // Sản phẩm có thể đã bị admin ẩn/ngừng bán SAU KHI khách bỏ vào giỏ -- kiểm tra lại ngay lúc
            // đặt hàng, không chỉ tin trạng thái lúc thêm vào giỏ.
            if (variant.getProduct().getStatus() != Product.Status.ACTIVE) {
                throw ApiException.badRequest(
                        "Sản phẩm \"" + variant.getProduct().getProductName() + "\" hiện không còn kinh doanh");
            }

            int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
            if (cartItem.getQuantity() > stock) {
                throw ApiException.badRequest(
                        "Sản phẩm \"" + variant.getProduct().getProductName() + "\" chỉ còn " + stock + " sản phẩm");
            }

            // Không trừ kho ở bước đặt hàng -- chỉ trừ khi admin xác nhận (PENDING -> CONFIRMED,
            // AdminOrderService.updateStatus), tránh giữ kho ảo cho đơn PENDING có thể bị huỷ. Ở đây chỉ kiểm tra đủ hàng.

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

        order.setSubtotalAmount(total);
        BigDecimal discount = BigDecimal.ZERO;
        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            discount = voucherService.applyVoucher(request.getVoucherCode(), total);
            order.setVoucherCode(request.getVoucherCode().trim().toUpperCase());
        }
        order.setDiscountAmount(discount);
        BigDecimal shippingFee = shippingService.calculateFee(address, total);
        order.setShippingFee(shippingFee);
        order.setTotalAmount(total.subtract(discount).add(shippingFee));
        Order saved = orderRepository.save(order);

        // Chỉ xoá đúng các dòng đã đặt hàng -- các dòng còn lại (nếu mua đơn lẻ 1 phần) vẫn giữ nguyên trong giỏ.
        cart.getItems().removeAll(itemsToCheckout);
        cartRepository.save(cart);

        return toResponse(saved, true);
    }

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

        // Chỉ hoàn kho nếu đơn đã CONFIRMED (lúc đó kho mới thực sự bị trừ) -- PENDING chưa đụng kho.
        if (order.getStatus() == Order.Status.CONFIRMED) {
            for (OrderItem item : order.getItems()) {
                if (item.getVariant() != null) {
                    // findByIdForUpdate -- khoá row, tránh mất cập nhật tồn kho nếu đúng lúc này biến thể
                    // đang được bán ở nơi khác (PosOrderService/AdminOrderService).
                    ProductVariant variant = variantRepository.findByIdForUpdate(item.getVariant().getVariantId())
                            .orElseThrow(() -> ApiException.notFound("Không tìm thấy sản phẩm"));
                    int stock = variant.getStockQuantity() == null ? 0 : variant.getStockQuantity();
                    variant.setStockQuantity(stock + item.getQuantity());
                    variantRepository.save(variant);
                }
            }
        }

        // Mã giảm giá đã bị tính dùng ngay lúc checkout (VoucherService.applyVoucher) -- huỷ đơn thì
        // phải trả lại lượt, không thì khách mất 1 lượt dùng cho đơn không hề mua được gì.
        if (order.getVoucherCode() != null && !order.getVoucherCode().isBlank()) {
            voucherService.revertVoucherUsage(order.getVoucherCode());
        }
        // Đơn đã trả tiền thật (chuyển khoản/VNPay) rồi mới huỷ -- đánh dấu REFUNDED để không lẫn với
        // đơn thật sự chưa ai trả tiền (UNPAID); COD ở PENDING/CONFIRMED luôn đang UNPAID nên vô hại.
        if (order.getPaymentStatus() == Order.PaymentStatus.PAID) {
            order.setPaymentStatus(Order.PaymentStatus.REFUNDED);
        }

        order.setStatus(Order.Status.CANCELLED);
        return toResponse(orderRepository.save(order), true);
    }

    /** Khách bấm "Hoàn thành" -- chỉ cho phép chuyển DELIVERED -> COMPLETED. */
    @Transactional
    public OrderResponse completeMyOrder(Long userId, Long orderId) {
        Order order = orderRepository.findByOrderIdAndUser_UserId(orderId, userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));

        if (order.getStatus() != Order.Status.DELIVERED) {
            throw ApiException.badRequest("Đơn hàng chưa được giao, không thể xác nhận hoàn thành");
        }

        order.setStatus(Order.Status.COMPLETED);
        return toResponse(orderRepository.save(order), true);
    }

    /** Yêu cầu trả hàng -- áp dụng khi đơn DELIVERED hoặc COMPLETED, chuyển sang RETURN_REQUESTED chờ admin duyệt. */
    @Transactional
    public OrderResponse requestReturn(Long userId, Long orderId, RequestReturnRequest request) {
        Order order = orderRepository.findByOrderIdAndUser_UserId(orderId, userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));

        if (order.getStatus() != Order.Status.DELIVERED && order.getStatus() != Order.Status.COMPLETED) {
            throw ApiException.badRequest("Chỉ có thể yêu cầu trả hàng với đơn đã được giao");
        }

        order.setStatus(Order.Status.RETURN_REQUESTED);
        order.setReturnReason(request.getReason());
        order.setReturnBankName(request.getBankName());
        order.setReturnAccountNumber(request.getAccountNumber());
        order.setReturnAccountHolder(request.getAccountHolder());
        return toResponse(orderRepository.save(order), true);
    }

    // ----- helper nội bộ -----

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
                ? order.getItems().stream().map(i -> {
                    Long productId = (i.getVariant() != null && i.getVariant().getProduct() != null)
                            ? i.getVariant().getProduct().getProductId()
                            : null;
                    Boolean reviewed = productId != null
                            ? reviewRepository.findByProduct_ProductIdAndUser_UserId(productId, order.getUser().getUserId()).isPresent()
                            : null;
                    return OrderItemResponse.builder()
                        .productId(productId)
                        .productName(i.getProductName())
                        .size(i.getSize())
                        .color(i.getColor())
                        .unitPrice(i.getUnitPrice())
                        .quantity(i.getQuantity())
                        .subtotal(i.getSubtotal())
                        .reviewed(reviewed)
                        .build();
                }).toList()
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
                .shippingFee(order.getShippingFee())
                .voucherCode(order.getVoucherCode())
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .qrCodeUrl(needsQrCode(order) ? vietQrService.buildQrUrl(order.getOrderCode(), order.getTotalAmount()) : null)
                .note(order.getNote())
                .returnReason(order.getReturnReason())
                .returnBankName(order.getReturnBankName())
                .returnAccountNumber(order.getReturnAccountNumber())
                .returnAccountHolder(order.getReturnAccountHolder())
                .createdAt(order.getCreatedAt())
                .items(items)
                .build();
    }

    /** Chỉ đơn chuyển khoản CÒN CHƯA thanh toán mới cần hiện QR -- đã trả tiền hoặc phương thức khác thì không. */
    private boolean needsQrCode(Order order) {
        return order.getPaymentMethod() == Order.PaymentMethod.BANK_TRANSFER
                && order.getPaymentStatus() == Order.PaymentStatus.UNPAID;
    }

    /** Lấy link thanh toán VNPay cho đơn đã đặt (paymentMethod=VNPAY, còn UNPAID), phải thuộc đúng người gọi. */
    public String getVnpayPaymentUrl(Long userId, Long orderId, jakarta.servlet.http.HttpServletRequest request) {
        Order order = orderRepository.findByOrderIdAndUser_UserId(orderId, userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));

        if (order.getPaymentMethod() != Order.PaymentMethod.VNPAY) {
            throw ApiException.badRequest("Đơn hàng này không dùng phương thức thanh toán VNPay");
        }
        if (order.getPaymentStatus() == Order.PaymentStatus.PAID) {
            throw ApiException.badRequest("Đơn hàng đã được thanh toán");
        }
        // Đơn VNPay CHƯA thanh toán thì luôn đang ở PENDING (không thể sang CONFIRMED khi còn UNPAID --
        // xem AdminOrderService.updateStatus) -- mọi trạng thái khác (CANCELLED, RETURN_REQUESTED...) đều
        // là đơn đã "chết", không được sinh URL thanh toán mới cho nó (khách trả tiền xong callback vẫn bị
        // handleVnpayReturn() từ chối vì đơn không còn PENDING, tiền mất mà đơn vẫn huỷ).
        if (order.getStatus() != Order.Status.PENDING) {
            throw ApiException.badRequest("Đơn hàng không còn ở trạng thái chờ thanh toán");
        }
        return vnPayService.buildPaymentUrl(order, request);
    }

    /**
     * Xử lý VNPay redirect sau thanh toán -- chỉ cập nhật paymentStatus khi chữ ký hợp lệ, mã trả về là
     * "00", SỐ TIỀN khớp đúng đơn hàng, và đơn đang ở trạng thái còn hợp lệ để nhận thanh toán. Idempotent:
     * gọi lại nhiều lần (VNPay có thể gửi trùng) không xử lý lại/không lỗi nếu đơn đã PAID rồi.
     */
    @Transactional
    public boolean handleVnpayReturn(java.util.Map<String, String> params) {
        if (!vnPayService.verifyReturn(params)) {
            return false;
        }

        String responseCode = params.get("vnp_ResponseCode");
        String txnRef = params.get("vnp_TxnRef");
        if (txnRef == null) return false;

        Long orderId;
        try {
            orderId = Long.valueOf(txnRef);
        } catch (NumberFormatException e) {
            return false;
        }

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null || order.getPaymentMethod() != Order.PaymentMethod.VNPAY) return false;

        // Đã xử lý PAID trước đó rồi -- coi là thành công, không xử lý lại (VNPay có thể gửi callback trùng).
        if (order.getPaymentStatus() == Order.PaymentStatus.PAID) return true;
        // Đơn đã bị huỷ/trả hàng (vd khách huỷ trong lúc đang thanh toán) -- KHÔNG được set PAID đè lên,
        // tiền thật đã về tài khoản shop nhưng cần admin xử lý hoàn tiền thủ công, không tự động coi là ổn.
        if (order.getStatus() == Order.Status.CANCELLED || order.getStatus() == Order.Status.RETURNED) return false;

        if (!"00".equals(responseCode)) return false;

        // Đối chiếu đúng số tiền VNPay báo về khớp với số tiền đơn hàng thật -- không chỉ tin response
        // code, tránh callback với vnp_Amount sai/cũ (dù chữ ký hợp lệ) vẫn bị tin và set PAID.
        String amountParam = params.get("vnp_Amount");
        BigDecimal expectedAmount = order.getTotalAmount().multiply(BigDecimal.valueOf(100));
        try {
            if (amountParam == null || new BigDecimal(amountParam).compareTo(expectedAmount) != 0) {
                return false;
            }
        } catch (NumberFormatException e) {
            return false;
        }

        order.setPaymentStatus(Order.PaymentStatus.PAID);
        orderRepository.save(order);
        return true;
    }
}