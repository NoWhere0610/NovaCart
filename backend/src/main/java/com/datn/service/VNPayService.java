package com.datn.service;

import com.datn.entity.Order;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Tích hợp cổng thanh toán VNPay (môi trường sandbox), theo đúng đặc tả tại
 * https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 *
 * Luồng: FE gọi buildPaymentUrl() lấy link -> chuyển hướng khách sang VNPay
 * -> khách thanh toán xong -> VNPay redirect khách VỀ vnp_ReturnUrl kèm tham
 * số đã ký (vnp_SecureHash) -> BE verifyReturn() kiểm tra chữ ký khớp không
 * TRƯỚC KHI tin bất kỳ tham số nào trong đó (KHÔNG được chỉ tin vnp_ResponseCode
 * suông vì query string có thể bị khách tự sửa tay trên trình duyệt).
 */
@Service
@RequiredArgsConstructor
public class VNPayService {

    @Value("${vnpay.tmn-code}")
    private String tmnCode;

    @Value("${vnpay.hash-secret}")
    private String hashSecret;

    @Value("${vnpay.pay-url}")
    private String payUrl;

    @Value("${vnpay.return-url}")
    private String returnUrl;

    public String buildPaymentUrl(Order order, HttpServletRequest request) {
        if (tmnCode == null || tmnCode.isBlank() || hashSecret == null || hashSecret.isBlank()) {
            throw new IllegalStateException(
                    "Chưa cấu hình VNPay (vnpay.tmn-code / vnpay.hash-secret trong application.properties). " +
                            "Đăng ký sandbox tại https://sandbox.vnpayment.vn/devreg/ rồi điền vào.");
        }

        Map<String, String> params = new HashMap<>();
        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", tmnCode);
        // VNPay không nhận số thập phân -> nhân 100 (đơn vị nhỏ nhất là "xu")
        BigDecimal amount = order.getTotalAmount().multiply(BigDecimal.valueOf(100));
        params.put("vnp_Amount", amount.toBigInteger().toString());
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", String.valueOf(order.getOrderId())); // orderId đã unique sẵn -> dùng thẳng
        params.put("vnp_OrderInfo", "Thanh toan don hang " + order.getOrderCode());
        params.put("vnp_OrderType", "other");
        params.put("vnp_Locale", "vn");
        params.put("vnp_ReturnUrl", returnUrl);
        params.put("vnp_IpAddr", clientIp(request));

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        LocalDateTime now = LocalDateTime.now();
        params.put("vnp_CreateDate", now.format(formatter));
        params.put("vnp_ExpireDate", now.plusMinutes(15).format(formatter));

        List<String> fieldNames = new ArrayList<>(params.keySet());
        Collections.sort(fieldNames);

        StringBuilder hashData = new StringBuilder();
        StringBuilder query = new StringBuilder();
        for (Iterator<String> it = fieldNames.iterator(); it.hasNext(); ) {
            String name = it.next();
            String value = params.get(name);
            if (value == null || value.isEmpty()) continue;

            hashData.append(name).append('=').append(urlEncode(value));
            query.append(urlEncode(name)).append('=').append(urlEncode(value));
            if (it.hasNext()) {
                hashData.append('&');
                query.append('&');
            }
        }

        String secureHash = hmacSHA512(hashSecret, hashData.toString());
        query.append("&vnp_SecureHash=").append(secureHash);

        return payUrl + "?" + query;
    }

    /**
     * Kiểm tra chữ ký của tham số VNPay redirect về. TRẢ VỀ FALSE nếu chữ ký
     * không khớp -> tuyệt đối không được cập nhật trạng thái đơn hàng trong
     * trường hợp này (có thể là request giả mạo).
     */
    public boolean verifyReturn(Map<String, String> allParams) {
        if (hashSecret == null || hashSecret.isBlank()) return false;

        Map<String, String> params = new HashMap<>(allParams);
        String receivedHash = params.remove("vnp_SecureHash");
        params.remove("vnp_SecureHashType");
        if (receivedHash == null) return false;

        List<String> fieldNames = new ArrayList<>(params.keySet());
        Collections.sort(fieldNames);

        StringBuilder hashData = new StringBuilder();
        for (Iterator<String> it = fieldNames.iterator(); it.hasNext(); ) {
            String name = it.next();
            String value = params.get(name);
            if (value == null || value.isEmpty()) continue;
            hashData.append(name).append('=').append(urlEncode(value));
            if (it.hasNext()) hashData.append('&');
        }

        // MessageDigest.isEqual thay vì equalsIgnoreCase -> so sánh constant-time cho chữ ký
        // (equalsIgnoreCase thoát sớm ở ký tự sai đầu tiên, có thể lộ thông tin qua thời gian phản hồi).
        String computedHash = hmacSHA512(hashSecret, hashData.toString());
        return MessageDigest.isEqual(
                computedHash.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8),
                receivedHash.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.US_ASCII);
    }

    private String clientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank()) return ip.split(",")[0].trim();
        String remote = request.getRemoteAddr();
        return remote != null ? remote : "127.0.0.1";
    }

    private String hmacSHA512(String key, String data) {
        try {
            Mac hmac512 = Mac.getInstance("HmacSHA512");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
            hmac512.init(secretKey);
            byte[] bytes = hmac512.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(2 * bytes.length);
            for (byte b : bytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) sb.append('0');
                sb.append(hex);
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("Lỗi ký dữ liệu VNPay", e);
        }
    }
}