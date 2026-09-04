package com.datn.dto.order;

import lombok.Getter;

/**
 * Kết quả xử lý một thông báo thanh toán từ VNPay, kèm sẵn mã trả về theo đúng bảng RspCode mà VNPay
 * quy định cho endpoint IPN.
 *
 * Ý nghĩa của mã đối với VNPay -- quan trọng, không đặt tuỳ tiện:
 *   - 00 và 02 : VNPay coi là ĐÃ XỬ LÝ XONG và DỪNG gửi lại.
 *   - 01/04/97/99 hoặc hết thời gian chờ: VNPay THỬ LẠI, tối đa 10 lần, mỗi 5 phút.
 * Trả nhầm mã lỗi cho một giao dịch thật ra đã xử lý xong sẽ khiến VNPay gọi lại 10 lần vô ích; ngược
 * lại, trả 00 cho một giao dịch chưa xử lý được sẽ mất luôn cơ hội thử lại.
 *
 * Tài liệu: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 */
@Getter
public enum VnpayIpnResult {

    /** Đã ghi nhận kết quả (kể cả kết quả THẤT BẠI do khách huỷ ở cổng thanh toán) -- VNPay dừng gửi lại. */
    SUCCESS("00", "Confirm Success"),

    /** vnp_TxnRef không ứng với đơn hàng nào. */
    ORDER_NOT_FOUND("01", "Order not found"),

    /** Đơn không còn ở trạng thái chờ thanh toán (đã ghi nhận trước đó, hoặc đã bị huỷ/trả hàng). */
    ALREADY_CONFIRMED("02", "Order already confirmed"),

    /** vnp_Amount không khớp số tiền đơn hàng trong cơ sở dữ liệu. */
    INVALID_AMOUNT("04", "Invalid amount"),

    /** Chữ ký HMAC-SHA512 không hợp lệ -- KHÔNG được tin bất kỳ tham số nào trong request. */
    INVALID_SIGNATURE("97", "Invalid signature"),

    /** Lỗi ngoài dự kiến ở phía mình -- để VNPay thử lại. */
    UNKNOWN_ERROR("99", "Unknow error");

    private final String rspCode;
    private final String message;

    VnpayIpnResult(String rspCode, String message) {
        this.rspCode = rspCode;
        this.message = message;
    }

    /** Giao dịch có thật sự được ghi nhận là ĐÃ THANH TOÁN hay không -- dùng cho trang kết quả hiển thị
     *  cho khách (khác với việc IPN có xử lý xong hay không). */
    public boolean laThanhToanThanhCong() {
        return this == SUCCESS || this == ALREADY_CONFIRMED;
    }
}
