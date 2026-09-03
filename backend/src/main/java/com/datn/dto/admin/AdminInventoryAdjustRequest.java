package com.datn.dto.admin;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/**
 * Điều chỉnh nhanh tồn kho theo MỨC THAY ĐỔI (+1/-1...), không phải theo số tuyệt đối.
 *
 * Nút +/- ở trang Sản phẩm trước đây tự cộng trên state của trình duyệt rồi gửi lên số cuối cùng. Số đó
 * tính từ dữ liệu đọc lúc mở trang, nên mọi giao dịch xảy ra sau đó (POS bán, khách đặt hàng, admin khác
 * nhập kho) đều bị con số cũ ghi đè -- khoá bi quan ở DB không cứu được, vì request đã mang sẵn kết quả.
 * Gửi delta thì phép cộng chạy trong transaction đã khoá row, không mất cập nhật nào.
 */
@Getter
@Setter
public class AdminInventoryAdjustRequest {

    @NotNull(message = "Mức điều chỉnh không được để trống")
    private Integer delta;
}
