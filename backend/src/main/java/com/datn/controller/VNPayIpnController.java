package com.datn.controller;

import com.datn.dto.order.VnpayIpnResult;
import com.datn.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

/**
 * IPN (Instant Payment Notification) — kênh SERVER-TO-SERVER mà VNPay dùng để báo kết quả thanh toán.
 *
 * ĐÂY LÀ ĐƯỜNG XÁC NHẬN CHÍNH THỨC, không phải VNPayReturnController. Theo tài liệu VNPay, việc cập
 * nhật trạng thái đơn hàng phải thực hiện tại IPN URL; ReturnUrl chỉ để hiển thị kết quả cho khách xem.
 * Lý do: ReturnUrl chạy ở phía trình duyệt nên không đảm bảo xảy ra — khách thanh toán xong rồi đóng
 * trình duyệt / rớt mạng / hết pin thì tiền đã trừ mà đơn vẫn UNPAID vĩnh viễn. IPN thì VNPay tự gửi
 * lại tối đa 10 lần, mỗi 5 phút, cho tới khi nhận được xác nhận.
 *
 * TRIỂN KHAI:
 *   1. URL này phải khai trong cổng quản trị VNPay (sandbox: Terminal configuration), KHÔNG gửi kèm
 *      tham số request — nên VNPayService.buildPaymentUrl() không cần đổi gì.
 *   2. VNPay phải GỌI VÀO ĐƯỢC máy chủ, nên chạy trên localhost thì cần tunnel (ngrok...) hoặc IP công
 *      khai. Không có bước này thì IPN không bao giờ tới, hệ thống lùi về đúng hành vi cũ (chỉ dựa vào
 *      ReturnUrl) chứ không hỏng thêm gì.
 *
 * Endpoint để PUBLIC trong SecurityConfig (/api/vnpay/**) vì VNPay gọi vào không có JWT — an toàn nhờ
 * OrderService.handleVnpayCallback() luôn verify chữ ký HMAC-SHA512 trước khi tin bất kỳ tham số nào.
 *
 * Tài liệu: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 */
@RestController
@RequestMapping("/api/vnpay")
@RequiredArgsConstructor
public class VNPayIpnController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(VNPayIpnController.class);

    private final OrderService orderService;

    /**
     * VNPay gọi bằng GET (query string) theo đặc tả v2.1.0; vẫn nhận cả POST cho chắc.
     *
     * PHẢI trả JSON {"RspCode": "...", "Message": "..."} với HTTP 200 — mã lỗi nằm trong thân JSON, không
     * phải ở HTTP status. Trả 4xx/5xx thì VNPay coi là không nhận được và thử lại tới 10 lần.
     */
    @GetMapping("/ipn")
    public ResponseEntity<Map<String, String>> handleIpnGet(HttpServletRequest request) {
        return xuLy(request);
    }

    @PostMapping("/ipn")
    public ResponseEntity<Map<String, String>> handleIpnPost(HttpServletRequest request) {
        return xuLy(request);
    }

    private ResponseEntity<Map<String, String>> xuLy(HttpServletRequest request) {
        VnpayIpnResult ketQua;
        try {
            ketQua = orderService.handleVnpayCallback(docThamSo(request), "IPN");
        } catch (Exception e) {
            // Lỗi ngoài dự kiến ở phía mình -> trả 99 để VNPay THỬ LẠI, thay vì nuốt mất thông báo
            // thanh toán. Đây là lý do phải bắt Exception ở đây chứ không để rơi vào handler chung
            // (handler đó trả HTTP 500, VNPay cũng thử lại nhưng không đọc được mã lỗi có ý nghĩa).
            //
            // BẮT BUỘC ghi log: nuốt lặng exception ở đây thì mọi lỗi đều hiện ra ngoài là "99 Unknow
            // error" và không ai lần được nguyên nhân -- kể cả khi giao dịch thật ra đã ghi nhận xong
            // rồi mới hỏng ở bước commit.
            log.error("[vnpay/IPN] lỗi ngoài dự kiến khi xử lý thông báo thanh toán", e);
            ketQua = VnpayIpnResult.UNKNOWN_ERROR;
        }
        return ResponseEntity.ok(Map.of(
                "RspCode", ketQua.getRspCode(),
                "Message", ketQua.getMessage()));
    }

    private Map<String, String> docThamSo(HttpServletRequest request) {
        Map<String, String> params = new HashMap<>();
        Enumeration<String> names = request.getParameterNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            params.put(name, request.getParameter(name));
        }
        return params;
    }
}
