package com.datn.service;

import com.datn.dto.PageResponse;
import com.datn.dto.admin.AdminOrderResponse;
import com.datn.dto.admin.UpdateRefundAccountRequest;
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
        // SHIPPING phải có lối ra cho GIAO THẤT BẠI (khách từ chối nhận, không có nhà, hàng quay về
        // shop). Thiếu mũi tên này thì nhân viên muốn đóng đơn chỉ còn đúng một nút "Đã giao hàng", tức
        // là buộc phải ghi nhận sai sự thật -- và với đơn COD, "đã giao" chính là căn cứ duy nhất để hệ
        // thống tin rằng khách đã trả tiền, nên khách chưa trả đồng nào vẫn đòi hoàn tiền được.
        ALLOWED_TRANSITIONS.put(Order.Status.SHIPPING,
                EnumSet.of(Order.Status.DELIVERED, Order.Status.CANCELLED));
        // DELIVERED -> COMPLETED thường do khách tự bấm (OrderService.completeMyOrder), nhưng admin có thể đóng hộ.
        ALLOWED_TRANSITIONS.put(Order.Status.DELIVERED, EnumSet.of(Order.Status.COMPLETED));
        // COMPLETED là điểm cuối với admin -- khách vẫn có thể tự chuyển sang RETURN_REQUESTED
        // (OrderService.requestReturn), không qua sơ đồ này.
        ALLOWED_TRANSITIONS.put(Order.Status.COMPLETED, EnumSet.noneOf(Order.Status.class));
        ALLOWED_TRANSITIONS.put(Order.Status.CANCELLED, EnumSet.noneOf(Order.Status.class));
        // Khách yêu cầu trả hàng -> admin duyệt (RETURNED, hoàn kho) hoặc TỪ CHỐI. Từ chối thì trả đơn
        // về đúng trạng thái nó đang đứng trước khi khách gửi yêu cầu -- có thể là DELIVERED (khách chưa
        // bấm xác nhận nhận hàng) hoặc COMPLETED. Cả hai đều hợp lệ ở đây, nhưng chọn cái nào thì bị
        // ràng buộc bởi statusBeforeReturn (xem phần kiểm bên dưới), admin không tự ý đổi được.
        ALLOWED_TRANSITIONS.put(Order.Status.RETURN_REQUESTED,
                EnumSet.of(Order.Status.RETURNED, Order.Status.COMPLETED, Order.Status.DELIVERED));
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

        // TỪ CHỐI yêu cầu trả hàng: đơn phải quay về ĐÚNG chỗ nó đang đứng lúc khách gửi yêu cầu.
        // Không ràng buộc thì admin từ chối một đơn COMPLETED lại có thể đẩy ngược nó về DELIVERED,
        // biến đơn đã xong thành đơn "chờ khách xác nhận" -- một trạng thái chưa từng có thật.
        // Đơn cũ chưa có statusBeforeReturn (null) thì giữ hành vi cũ: chỉ cho về COMPLETED.
        if (oldStatus == Order.Status.RETURN_REQUESTED && newStatus != Order.Status.RETURNED) {
            Order.Status phaiVe = order.getStatusBeforeReturn() != null
                    ? order.getStatusBeforeReturn() : Order.Status.COMPLETED;
            if (newStatus != phaiVe) {
                throw ApiException.badRequest("Từ chối yêu cầu trả hàng thì đơn phải quay về trạng thái "
                        + phaiVe + " (trạng thái trước khi khách gửi yêu cầu), không phải " + newStatus);
            }
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
        // Huỷ từ CONFIRMED hoặc SHIPPING đều phải hoàn kho -- cả hai trạng thái đó đều đã qua bước trừ
        // kho ở PENDING -> CONFIRMED. Huỷ từ PENDING thì chưa đụng kho.
        boolean shouldRestoreStock = (newStatus == Order.Status.CANCELLED
                        && (oldStatus == Order.Status.CONFIRMED || oldStatus == Order.Status.SHIPPING))
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
            // Lấy chủ đơn để trả đúng lượt cho người đã dùng. Đơn POS không có chủ (khách vãng lai)
            // -> null, VoucherService bỏ qua bước xoá dấu.
            voucherService.revertVoucherUsage(order.getVoucherCode(),
                    order.getUser() != null ? order.getUser().getUserId() : null);
        }
        // Đơn đã trả tiền thật rồi mới bị huỷ/duyệt trả hàng -- đánh dấu REFUNDED, không để lẫn với
        // UNPAID (chưa ai trả tiền). Đây chỉ là BÚT TOÁN ĐẢO KHOẢN, không có nghĩa tiền đã về tay khách;
        // việc đó do refundStatus theo dõi.
        boolean daTraTien = order.getPaymentStatus() == Order.PaymentStatus.PAID;
        if ((newStatus == Order.Status.CANCELLED || newStatus == Order.Status.RETURNED) && daTraTien) {
            order.setPaymentStatus(Order.PaymentStatus.REFUNDED);
        }

        // ADMIN huỷ một đơn đã thanh toán: vẫn phải sinh khoản phải hoàn, dù chưa có tài khoản nhận.
        // Admin không thể tự biết số tài khoản của khách (khác luồng khách tự huỷ -- khách khai ngay
        // lúc bấm huỷ). Để refundStatus = NONE thì đơn biến mất khỏi mọi danh sách và số tiền đó không
        // còn ai theo dõi; đưa vào PENDING với thông tin trống thì ít nhất nó nằm trong hàng chờ và
        // giao diện quản trị hiện rõ "chưa có tài khoản nhận -- cần liên hệ khách".
        if (newStatus == Order.Status.CANCELLED && daTraTien
                && order.getRefundStatus() != Order.RefundStatus.COMPLETED) {
            order.setRefundStatus(Order.RefundStatus.PENDING);
        }

        // Mốc giao hàng -- hạn đổi trả 7 ngày đếm từ đây (OrderService.requestReturn). Chỉ ghi lần đầu
        // để không bị đẩy lùi nếu sau này có thao tác nào đưa đơn về DELIVERED lần nữa.
        if (newStatus == Order.Status.DELIVERED && order.getDeliveredAt() == null) {
            order.setDeliveredAt(java.time.LocalDateTime.now());
        }
        if (newStatus == Order.Status.RETURNED) {
            order.setReturnedAt(java.time.LocalDateTime.now());
        }

        // Admin TỪ CHỐI yêu cầu trả hàng (RETURN_REQUESTED -> COMPLETED): huỷ luôn khoản hoàn đang chờ.
        // Không huỷ thì đơn nằm mãi trong danh sách "chờ chuyển tiền" của admin dù yêu cầu đã bị bác --
        // sớm muộn cũng có người chuyển nhầm. Giữ lại thông tin tài khoản để còn truy vết.
        // newStatus != RETURNED nghĩa là TỪ CHỐI (về DELIVERED hoặc COMPLETED tuỳ statusBeforeReturn).
        if (oldStatus == Order.Status.RETURN_REQUESTED && newStatus != Order.Status.RETURNED
                && order.getRefundStatus() == Order.RefundStatus.PENDING) {
            order.setRefundStatus(Order.RefundStatus.NONE);
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

        // VNPay có cổng thanh toán tự báo về (IPN) nên KHÔNG được xác nhận tay -- làm thế là mở đường
        // đánh dấu đã thu tiền cho đơn chưa hề qua cổng.
        if (order.getPaymentMethod() == Order.PaymentMethod.VNPAY) {
            throw ApiException.badRequest(
                    "Đơn VNPay được cổng thanh toán tự xác nhận, không xác nhận thủ công được");
        }
        // COD: tiền chỉ đổi tay lúc shipper giao hàng, nên chưa giao thì chưa có gì để xác nhận. Cho bấm
        // sớm là đánh dấu đã thu tiền cho đơn còn nằm trong kho.
        if (order.getPaymentMethod() == Order.PaymentMethod.COD
                && order.getStatus() != Order.Status.DELIVERED
                && order.getStatus() != Order.Status.COMPLETED) {
            throw ApiException.badRequest(
                    "Đơn COD chỉ xác nhận đã thu tiền sau khi đã giao hàng (đơn đang ở trạng thái "
                            + order.getStatus() + ")");
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

    /**
     * Admin xác nhận ĐÃ chuyển tiền hoàn lại cho khách.
     *
     * Bước riêng chứ không gộp vào lúc duyệt trả hàng, vì hai việc đó cách nhau thật: duyệt xong còn
     * phải nhận hàng về, kiểm hàng, rồi mới ra ngân hàng chuyển. Gộp làm một là hệ thống báo "đã hoàn
     * tiền" trong khi tiền còn nguyên trong tài khoản shop -- khách gọi lên hỏi thì không ai tra được
     * đã chuyển hay chưa.
     */
    @Transactional
    public AdminOrderResponse confirmRefund(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));
        // CỐ Ý không gọi requireOnlineOrder: hoá đơn POS thanh toán bằng chuyển khoản rồi bị huỷ cũng
        // sinh ra khoản phải hoàn thật (tiền đã nằm trong tài khoản ngân hàng của shop, không trả tay
        // tại quầy được). Chặn POS ở đây thì khoản đó không bao giờ tất toán được trong hệ thống.

        if (order.getRefundStatus() == Order.RefundStatus.COMPLETED) {
            throw ApiException.badRequest("Đơn hàng này đã được xác nhận hoàn tiền trước đó");
        }
        if (order.getRefundStatus() != Order.RefundStatus.PENDING) {
            throw ApiException.badRequest("Đơn hàng này không có yêu cầu hoàn tiền nào đang chờ xử lý");
        }
        // Hai đường hợp lệ dẫn tới khoản phải hoàn: đơn đã DUYỆT TRẢ HÀNG, hoặc đơn ĐÃ HUỶ sau khi
        // khách thanh toán. Trạng thái khác nghĩa là hàng chưa về hoặc yêu cầu chưa được duyệt --
        // cho bấm ở đó thì admin rất dễ chuyển tiền cho một yêu cầu mà sau đó chính mình lại từ chối.
        if (order.getStatus() != Order.Status.RETURNED && order.getStatus() != Order.Status.CANCELLED) {
            throw ApiException.badRequest(
                    "Phải duyệt trả hàng (hoặc huỷ đơn) trước khi xác nhận hoàn tiền -- đơn đang ở trạng thái "
                            + order.getStatus());
        }
        // Không có tài khoản nhận thì không thể đã chuyển được. Ca này xảy ra khi ADMIN huỷ đơn đã
        // thanh toán: khoản phải hoàn được ghi nhận nhưng thông tin nhận tiền còn trống, phải liên hệ
        // khách lấy trước đã.
        if (order.getRefundAccountNumber() == null || order.getRefundAccountNumber().isBlank()) {
            throw ApiException.badRequest(
                    "Đơn này chưa có tài khoản nhận tiền hoàn. Liên hệ khách để lấy thông tin rồi cập nhật trước khi xác nhận.");
        }

        order.setRefundStatus(Order.RefundStatus.COMPLETED);
        order.setRefundCompletedAt(java.time.LocalDateTime.now());
        return toResponse(orderRepository.save(order), true);
    }

    /**
     * Admin điền/sửa tài khoản nhận tiền hoàn cho một khoản đang chờ chuyển.
     *
     * Dành cho những khoản phải hoàn phát sinh mà KHÔNG hỏi khách được: admin tự huỷ đơn đã thanh
     * toán, hoặc tiền VNPay về sau khi đơn đã bị huỷ. Không có endpoint này thì những đơn ấy kẹt vĩnh
     * viễn trong hàng chờ -- confirmRefund từ chối vì thiếu số tài khoản, mà API của khách lại từ chối
     * đơn đã CANCELLED nên khách cũng không tự khai lại được.
     *
     * Dùng chung OrderService.ghiThongTinHoanTien để quy tắc kiểm định dạng không lệch với đường khách
     * tự khai.
     */
    @Transactional
    public AdminOrderResponse updateRefundAccount(Long orderId, UpdateRefundAccountRequest request) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));

        if (order.getRefundStatus() == Order.RefundStatus.COMPLETED) {
            throw ApiException.badRequest("Đơn hàng này đã hoàn tiền xong, không sửa được tài khoản nhận nữa");
        }
        if (order.getRefundStatus() != Order.RefundStatus.PENDING) {
            throw ApiException.badRequest("Đơn hàng này không có khoản hoàn tiền nào đang chờ xử lý");
        }

        OrderService.ghiThongTinHoanTien(order, request.getRefundBankName(),
                request.getRefundAccountNumber(), request.getRefundAccountHolder());
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
                .statusBeforeReturn(order.getStatusBeforeReturn())
                // Đơn cũ có refund_status NULL trong cơ sở dữ liệu (LegacyDataFixer lấp lúc khởi động,
                // nhưng vẫn quy null về NONE ở đây để frontend không phải xử lý thêm một trạng thái nữa).
                .refundStatus(order.getRefundStatus() == null ? Order.RefundStatus.NONE : order.getRefundStatus())
                .refundBankName(order.getRefundBankName())
                .refundAccountNumber(order.getRefundAccountNumber())
                .refundAccountHolder(order.getRefundAccountHolder())
                .refundCompletedAt(order.getRefundCompletedAt())
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