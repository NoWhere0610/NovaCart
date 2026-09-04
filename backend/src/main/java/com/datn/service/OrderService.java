package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.order.CheckoutRequest;
import com.datn.dto.order.OrderItemResponse;
import com.datn.dto.order.OrderResponse;
import com.datn.dto.order.RequestReturnRequest;
import com.datn.dto.order.VnpayIpnResult;
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
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(OrderService.class);

    /** Hạn đổi trả, tính từ ngày nhận hàng. Phải khớp Chính sách đổi trả công bố trên website
     *  (frontend ReturnPolicyPage) và tài liệu chính sách nạp cho chatbot (chatbot/kb-files/seed). */
    private static final int RETURN_WINDOW_DAYS = 7;

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

    /**
     * Yêu cầu trả hàng -- áp dụng khi đơn DELIVERED hoặc COMPLETED, chuyển sang RETURN_REQUESTED chờ
     * admin duyệt, VÀ phải còn trong hạn đổi trả.
     */
    @Transactional
    public OrderResponse requestReturn(Long userId, Long orderId, RequestReturnRequest request) {
        Order order = orderRepository.findByOrderIdAndUser_UserId(orderId, userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));

        if (order.getStatus() != Order.Status.DELIVERED && order.getStatus() != Order.Status.COMPLETED) {
            throw ApiException.badRequest("Chỉ có thể yêu cầu trả hàng với đơn đã được giao");
        }

        // Hạn đổi trả theo đúng Chính sách đổi trả đang công bố trên website (ReturnPolicyPage): "trong
        // vòng 7 ngày kể từ ngày nhận hàng". Trước đây hệ thống KHÔNG thực thi hạn này -- khách yêu cầu
        // trả hàng sau vài tháng vẫn qua, tức hệ thống không tuân thủ chính sách của chính nó.
        //
        // Đơn cũ chưa có deliveredAt (tạo trước khi thêm cột này) thì CỐ Ý không chặn: không có mốc để
        // đếm, chặn đại sẽ từ chối oan khách đang trong hạn thật. Admin vẫn duyệt/từ chối thủ công được.
        if (order.getDeliveredAt() != null) {
            LocalDateTime hanCuoi = order.getDeliveredAt().plusDays(RETURN_WINDOW_DAYS);
            if (LocalDateTime.now().isAfter(hanCuoi)) {
                throw ApiException.badRequest("Đã quá hạn đổi trả " + RETURN_WINDOW_DAYS
                        + " ngày kể từ ngày nhận hàng (nhận hàng ngày "
                        + order.getDeliveredAt().toLocalDate() + "), không thể yêu cầu trả hàng.");
            }
        }

        order.setStatus(Order.Status.RETURN_REQUESTED);
        order.setReturnReason(request.getReason());
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
     * Xử lý VNPay redirect về TRÌNH DUYỆT của khách -- chỉ để biết nên hiện trang "thành công" hay
     * "thất bại". Việc cập nhật trạng thái thật do handleVnpayCallback() làm, và đường xác nhận CHÍNH
     * THỨC là IPN (xem VNPayIpnController), không phải đường này.
     */
    @Transactional
    public boolean handleVnpayReturn(java.util.Map<String, String> params) {
        return handleVnpayCallback(params, "ReturnUrl").laThanhToanThanhCong();
    }

    /**
     * LÕI xử lý mọi thông báo thanh toán từ VNPay -- dùng chung cho cả IPN (server-to-server) lẫn
     * ReturnUrl (redirect trình duyệt).
     *
     * VÌ SAO PHẢI CÓ IPN, KHÔNG THỂ CHỈ DỰA VÀO ReturnUrl: VNPay quy định rõ việc cập nhật trạng thái
     * đơn hàng phải thực hiện ở IPN URL; ReturnUrl chỉ để hiển thị kết quả cho khách xem. Lý do là
     * ReturnUrl chạy ở phía trình duyệt nên KHÔNG ĐẢM BẢO xảy ra: khách thanh toán xong rồi đóng trình
     * duyệt, rớt mạng, hoặc điện thoại hết pin thì tiền đã trừ mà đơn vẫn nằm ở UNPAID vĩnh viễn -- và
     * hệ thống này không có đường thủ công nào cứu được (confirmPayment chỉ nhận BANK_TRANSFER, còn
     * updateStatus lại đòi đơn VNPay phải PAID mới cho xác nhận). IPN là kênh server-to-server, VNPay
     * tự thử lại tối đa 10 lần mỗi 5 phút cho tới khi mình xác nhận đã nhận.
     *
     * Thứ tự kiểm tra bám đúng bảng RspCode của VNPay: chữ ký -> đơn tồn tại -> số tiền -> trạng thái.
     * Idempotent: gọi lại nhiều lần không xử lý lại và không báo lỗi.
     *
     * LƯU Ý TRIỂN KHAI: URL của IPN phải được khai trong cổng quản trị VNPay (sandbox:
     * Terminal configuration), KHÔNG gửi kèm theo tham số request -- nên buildPaymentUrl() không đụng gì.
     */
    @Transactional
    public VnpayIpnResult handleVnpayCallback(java.util.Map<String, String> params, String nguon) {
        if (!vnPayService.verifyReturn(params)) {
            log.warn("[vnpay/{}] chữ ký không hợp lệ, bỏ qua toàn bộ tham số", nguon);
            return VnpayIpnResult.INVALID_SIGNATURE;
        }

        String txnRef = params.get("vnp_TxnRef");
        Long orderId = null;
        if (txnRef != null) {
            try {
                orderId = Long.valueOf(txnRef);
            } catch (NumberFormatException ignored) {
                // rơi xuống nhánh ORDER_NOT_FOUND bên dưới
            }
        }
        if (orderId == null) return VnpayIpnResult.ORDER_NOT_FOUND;

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null || order.getPaymentMethod() != Order.PaymentMethod.VNPAY) {
            log.warn("[vnpay/{}] không tìm thấy đơn VNPay cho vnp_TxnRef={}", nguon, txnRef);
            return VnpayIpnResult.ORDER_NOT_FOUND;
        }

        // Đối chiếu SỐ TIỀN trước khi xét trạng thái -- không chỉ tin vnp_ResponseCode. Chữ ký hợp lệ
        // vẫn có thể đi kèm vnp_Amount của một giao dịch khác/cũ.
        BigDecimal expectedAmount = order.getTotalAmount().multiply(BigDecimal.valueOf(100));
        String amountParam = params.get("vnp_Amount");
        try {
            if (amountParam == null || new BigDecimal(amountParam).compareTo(expectedAmount) != 0) {
                log.warn("[vnpay/{}] số tiền không khớp: nhận {} nhưng đơn {} cần {}",
                        nguon, amountParam, orderId, expectedAmount);
                return VnpayIpnResult.INVALID_AMOUNT;
            }
        } catch (NumberFormatException e) {
            return VnpayIpnResult.INVALID_AMOUNT;
        }

        // Đã ghi nhận thanh toán trước đó -- VNPay gửi trùng là chuyện bình thường (IPN có cơ chế thử
        // lại). Trả 02 để VNPay DỪNG gửi lại, không phải lỗi.
        if (order.getPaymentStatus() == Order.PaymentStatus.PAID) {
            return VnpayIpnResult.ALREADY_CONFIRMED;
        }

        // Đơn đã bị huỷ/trả hàng (vd khách tự huỷ trong lúc đang ở cổng thanh toán) -- KHÔNG set PAID đè
        // lên. Tiền thật đã về tài khoản shop nên phải ghi log ở mức ERROR để còn đối soát và hoàn tiền
        // thủ công; trả 02 để VNPay dừng thử lại (thử lại cũng không đổi được gì).
        if (order.getStatus() == Order.Status.CANCELLED || order.getStatus() == Order.Status.RETURNED) {
            log.error("[vnpay/{}] CẦN ĐỐI SOÁT THỦ CÔNG: đơn {} đã ở trạng thái {} nhưng VNPay báo giao dịch "
                            + "{} với số tiền {}. Kiểm tra cổng VNPay và hoàn tiền cho khách nếu tiền đã về.",
                    nguon, orderId, order.getStatus(), params.get("vnp_ResponseCode"), amountParam);
            return VnpayIpnResult.ALREADY_CONFIRMED;
        }

        // Giao dịch THẤT BẠI (khách bấm huỷ ở cổng, thẻ không đủ tiền...): vẫn là một thông báo đã được
        // xử lý xong -- trả 00 để VNPay dừng gửi lại. Đơn giữ nguyên UNPAID, khách trả lại được.
        if (!"00".equals(params.get("vnp_ResponseCode"))) {
            log.info("[vnpay/{}] đơn {} thanh toán không thành công, mã {}",
                    nguon, orderId, params.get("vnp_ResponseCode"));
            return VnpayIpnResult.SUCCESS;
        }

        order.setPaymentStatus(Order.PaymentStatus.PAID);
        orderRepository.save(order);
        log.info("[vnpay/{}] đơn {} đã ghi nhận THANH TOÁN THÀNH CÔNG", nguon, orderId);
        return VnpayIpnResult.SUCCESS;
    }
}