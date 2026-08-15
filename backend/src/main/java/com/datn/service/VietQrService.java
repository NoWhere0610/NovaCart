package com.datn.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Dựng URL ảnh mã QR chuyển khoản theo chuẩn VietQR (img.vietqr.io) -- dịch vụ công khai, không cần
 * đăng ký/API key, chỉ cần đúng BIN ngân hàng + số tài khoản. Quét QR này trên app ngân hàng bất kỳ sẽ
 * tự điền sẵn số tiền + nội dung chuyển khoản, khách không phải tự gõ tay.
 */
@Service
public class VietQrService {

    @Value("${shop.bank.bin}")
    private String bankBin;

    @Value("${shop.bank.account-number}")
    private String accountNumber;

    @Value("${shop.bank.account-name}")
    private String accountName;

    /** `addInfo` (nội dung chuyển khoản) LUÔN là mã đơn hàng -- để đối soát khi admin xác nhận thanh toán. */
    public String buildQrUrl(String orderCode, BigDecimal amount) {
        String addInfo = URLEncoder.encode(orderCode, StandardCharsets.UTF_8);
        String name = URLEncoder.encode(accountName, StandardCharsets.UTF_8);
        long amountVnd = amount.longValue(); // VNĐ không có phần thập phân
        return "https://img.vietqr.io/image/" + bankBin + "-" + accountNumber + "-compact2.png"
                + "?amount=" + amountVnd + "&addInfo=" + addInfo + "&accountName=" + name;
    }
}
