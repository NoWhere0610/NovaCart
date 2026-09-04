package com.datn.dto.order;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * Body của POST /api/orders/{id}/cancel.
 *
 * Toàn bộ các trường đều tuỳ chọn vì phần lớn đơn bị huỷ là đơn COD chưa thanh toán -- chẳng có gì để
 * hoàn. OrderService.cancelMyOrder mới là nơi quyết định khi nào bắt buộc: chỉ khi khách ĐÃ thực sự
 * trả tiền (chuyển khoản/VNPay đã ghi nhận).
 *
 * Cho phép body rỗng để lời gọi cũ (POST không kèm body) vẫn chạy được với đơn chưa thanh toán.
 */
@Getter
@Setter
public class CancelOrderRequest {

    @Size(max = 100, message = "Tên ngân hàng tối đa 100 ký tự")
    private String refundBankName;

    @Size(max = 30, message = "Số tài khoản tối đa 30 ký tự")
    private String refundAccountNumber;

    @Size(max = 100, message = "Tên chủ tài khoản tối đa 100 ký tự")
    private String refundAccountHolder;

    // Cắt khoảng trắng ngay lúc Jackson dựng đối tượng -- xem chú thích ở RequestReturnRequest.
    public void setRefundBankName(String v) {
        this.refundBankName = v == null ? null : v.trim();
    }

    public void setRefundAccountNumber(String v) {
        this.refundAccountNumber = v == null ? null : v.replaceAll("\\s+", "");
    }

    public void setRefundAccountHolder(String v) {
        this.refundAccountHolder = v == null ? null : v.trim();
    }
}
