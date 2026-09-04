package com.datn.dto.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * Body của PATCH /api/admin/orders/{orderId}/refund-account.
 *
 * VÌ SAO CẦN: có những khoản phải hoàn phát sinh mà KHÔNG ai hỏi khách được số tài khoản -- admin tự
 * huỷ đơn đã thanh toán, hoặc tiền VNPay về sau khi đơn đã bị huỷ. Trước đây những đơn ấy nằm vĩnh
 * viễn trong hàng chờ chuyển tiền với dòng "chưa có tài khoản nhận": confirmRefund từ chối vì thiếu số
 * tài khoản, mà không có màn hình nào để điền vào -- thông tin nhận tiền chỉ ghi được qua API của
 * KHÁCH (huỷ đơn / yêu cầu trả hàng), và cả hai đều từ chối đơn đã CANCELLED.
 */
@Getter
@Setter
public class UpdateRefundAccountRequest {

    @NotBlank(message = "Vui lòng nhập tên ngân hàng")
    @Size(max = 100, message = "Tên ngân hàng tối đa 100 ký tự")
    private String refundBankName;

    @NotBlank(message = "Vui lòng nhập số tài khoản")
    @Size(max = 30, message = "Số tài khoản tối đa 30 ký tự")
    private String refundAccountNumber;

    @NotBlank(message = "Vui lòng nhập tên chủ tài khoản")
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
