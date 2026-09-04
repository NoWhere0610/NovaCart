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

    /** Đã ghi nhận THANH TOÁN THÀNH CÔNG -- đơn chuyển sang PAID. */
    SUCCESS("00", "Confirm Success"),

    /**
     * Đã xử lý xong thông báo, nhưng GIAO DỊCH THẤT BẠI (khách bấm huỷ ở cổng, thẻ không đủ tiền...).
     *
     * Vẫn trả RspCode "00" cho VNPay vì với VNPay thì "00" nghĩa là "bên bán đã nhận và xử lý xong
     * thông báo, đừng gửi lại nữa" -- không phải "khách đã trả tiền". Nhưng laThanhToanThanhCong() trả
     * FALSE, để trang kết quả nói đúng sự thật với khách.
     *
     * VÌ SAO PHẢI TÁCH RA THÀNH GIÁ TRỊ RIÊNG: bản trước dùng chung SUCCESS cho cả hai nghĩa, nên khách
     * huỷ giao dịch ở cổng thanh toán vẫn được redirect về trang "Thanh toán thành công" trong khi thẻ
     * chưa hề bị trừ. Khách ngồi đợi hàng, còn admin thì không xác nhận đơn được vì đơn vẫn UNPAID.
     */
    PROCESSED_BUT_FAILED("00", "Confirm Success"),

    /** vnp_TxnRef không ứng với đơn hàng nào. */
    ORDER_NOT_FOUND("01", "Order not found"),

    /** Đơn ĐÃ được ghi nhận thanh toán từ trước -- VNPay gửi trùng, không phải lỗi. */
    ALREADY_CONFIRMED("02", "Order already confirmed"),

    /**
     * Tiền về NHƯNG đơn đã bị huỷ/trả hàng từ trước (khách thanh toán trong lúc đơn vừa bị huỷ).
     *
     * Cũng trả "02" để VNPay dừng gửi lại, nhưng KHÁC ALREADY_CONFIRMED ở chỗ: đây là một khoản shop
     * đang NỢ khách, không phải một đơn đã thanh toán xong. laThanhToanThanhCong() trả FALSE.
     */
    PAID_ON_DEAD_ORDER("02", "Order already confirmed"),

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

    /**
     * Đơn hàng của khách CÓ được ghi nhận là đã thanh toán hay không.
     *
     * KHÁC HẲN với việc RspCode là "00": "00" nói với VNPay rằng bên bán đã xử lý xong thông báo, kể
     * cả khi thông báo đó là "giao dịch thất bại". Trộn hai nghĩa vào một là nguồn gốc của lỗi trang
     * kết quả báo "Thanh toán thành công" cho giao dịch khách vừa huỷ -- xem PROCESSED_BUT_FAILED.
     */
    public boolean laThanhToanThanhCong() {
        return this == SUCCESS || this == ALREADY_CONFIRMED;
    }
}
