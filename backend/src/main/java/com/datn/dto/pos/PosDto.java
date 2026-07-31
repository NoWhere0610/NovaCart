package com.datn.dto.pos;

import com.datn.entity.Order;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import com.datn.dto.order.OrderItemResponse;

public class PosDto {

    @Getter
    @Setter
    public static class AddItemRequest {
        @NotNull(message = "Vui lòng chọn sản phẩm")
        private Long variantId;

        @NotNull(message = "Vui lòng nhập số lượng")
        @Min(value = 1, message = "Số lượng phải lớn hơn 0")
        private Integer quantity;
    }

    @Getter
    @Setter
    public static class UpdateItemQuantityRequest {
        @NotNull(message = "Vui lòng nhập số lượng")
        @Min(value = 1, message = "Số lượng phải lớn hơn 0")
        private Integer quantity;
    }

    @Getter
    @Setter
    public static class VoucherRequest {
        @NotNull(message = "Vui lòng nhập mã giảm giá")
        private String voucherCode;
    }

    @Getter
    @Setter
    public static class CheckoutRequest {
        @NotNull(message = "Vui lòng chọn phương thức thanh toán")
        private Order.PaymentMethod paymentMethod; // COD (tiền mặt) hoặc BANK_TRANSFER

        private String customerName;
        private String customerPhone;
        private String note;
    }

    @Getter
    @Builder
    public static class InvoiceResponse {
        private Long orderId;
        private String orderCode;
        private Order.Status status;
        private Order.PaymentMethod paymentMethod;
        private Order.PaymentStatus paymentStatus;
        private String customerName;
        private String customerPhone;
        private BigDecimal subtotalAmount;
        private BigDecimal discountAmount;
        private String voucherCode;
        private BigDecimal totalAmount;
        private String cashierUsername;
        private LocalDateTime createdAt;
        private List<OrderItemResponse> items;
    }
}