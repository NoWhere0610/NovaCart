package com.datn.dto.order;

import com.datn.entity.Order;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class CheckoutRequest {

    // Checkout dựa trên 1 địa chỉ ĐÃ LƯU SẴN trong Sổ địa chỉ (Sprint 1) —
    // đơn giản hoá cho đồ án, không cho nhập địa chỉ tự do ở bước này
    @NotNull(message = "Vui lòng chọn địa chỉ giao hàng")
    private Long addressId;

    @NotNull(message = "Vui lòng chọn phương thức thanh toán")
    private Order.PaymentMethod paymentMethod;

    private String note;

    private String voucherCode;

    // null = checkout CẢ giỏ hàng (hành vi cũ, giữ nguyên); có giá trị = chỉ checkout đúng các dòng
    // cartItemId này, giữ lại các dòng còn lại trong giỏ -- cho phép "mua đơn lẻ" 1 phần giỏ hàng.
    private List<Long> cartItemIds;
}