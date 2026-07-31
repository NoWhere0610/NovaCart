package com.datn.controller;

import com.datn.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

/**
 * VNPay redirect TRÌNH DUYỆT của khách (không phải gọi API JSON) về đây sau
 * khi thanh toán xong. Controller này verify chữ ký, cập nhật đơn hàng, rồi
 * redirect (302) tiếp sang trang kết quả bên FE — người dùng không thấy JSON
 * thô, chỉ thấy trang web đẹp như bình thường.
 */
@RestController
@RequestMapping("/api/vnpay")
@RequiredArgsConstructor
public class VNPayReturnController {

    private final OrderService orderService;

    @Value("${vnpay.return-url}")
    private String feResultUrl; // vd http://localhost:5173/vnpay-result

    @GetMapping("/return")
    public void handleReturn(HttpServletRequest request, HttpServletResponse response) throws IOException {
        Map<String, String> params = new HashMap<>();
        Enumeration<String> names = request.getParameterNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            params.put(name, request.getParameter(name));
        }

        boolean success = orderService.handleVnpayReturn(params);
        String orderId = params.getOrDefault("vnp_TxnRef", "");

        String redirectUrl = feResultUrl + "?orderId=" + orderId + "&status=" + (success ? "success" : "failed");
        response.sendRedirect(redirectUrl);
    }
}