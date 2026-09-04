package com.datn.dto.order;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RequestReturnRequest {

    @NotBlank(message = "Vui lòng nhập lý do trả hàng/hoàn tiền")
    @Size(max = 500, message = "Lý do tối đa 500 ký tự")
    private String reason;

    /*
     * Thông tin nhận tiền hoàn. KHÔNG gắn @NotBlank ở đây mà kiểm trong OrderService, vì bắt buộc hay
     * không còn tuỳ đơn: đơn chuyển khoản/VNPay mà khách chưa từng trả tiền thì chẳng có gì để hoàn.
     * Xem OrderService.requestReturn để biết quy tắc đầy đủ (và vì sao KHÔNG được dựa vào paymentStatus
     * với đơn COD).
     */

    @Size(max = 100, message = "Tên ngân hàng tối đa 100 ký tự")
    private String refundBankName;

    @Size(max = 30, message = "Số tài khoản tối đa 30 ký tự")
    private String refundAccountNumber;

    @Size(max = 100, message = "Tên chủ tài khoản tối đa 100 ký tự")
    private String refundAccountHolder;

    // Cắt khoảng trắng ngay lúc Jackson dựng đối tượng, TRƯỚC khi @Valid chạy -- cùng lý do đã ghi kỹ
    // ở UpdateProfileRequest.setPhone(). Số tài khoản dán từ tin nhắn rất hay dính dấu cách.
    public void setRefundBankName(String v) {
        this.refundBankName = v == null ? null : v.trim();
    }

    public void setRefundAccountNumber(String v) {
        // Bỏ luôn dấu cách Ở GIỮA: ngân hàng thường hiển thị số tài khoản theo nhóm ("1234 5678 9012"),
        // khách dán nguyên vào thì phải hiểu được, chứ không phải báo lỗi bắt tự xoá.
        this.refundAccountNumber = v == null ? null : v.replaceAll("\\s+", "");
    }

    public void setRefundAccountHolder(String v) {
        this.refundAccountHolder = v == null ? null : v.trim();
    }
}
