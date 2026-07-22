package com.datn.dto.admin;

import com.datn.entity.Voucher;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

public class AdminVoucherDto {

    @Getter
    @Setter
    public static class Request {
        @NotBlank(message = "Mã giảm giá không được để trống")
        private String code;

        @NotNull(message = "Vui lòng chọn loại giảm giá")
        private Voucher.DiscountType discountType;

        @NotNull(message = "Giá trị giảm không được để trống")
        @DecimalMin(value = "0", message = "Giá trị giảm phải >= 0")
        private BigDecimal discountValue;

        private BigDecimal minOrderValue;
        private BigDecimal maxDiscountAmount;
        private LocalDate startDate;
        private LocalDate endDate;
        private Integer usageLimit;
        private Boolean isActive;
    }

    @Getter
    @Builder
    public static class Response {
        private Integer voucherId;
        private String code;
        private Voucher.DiscountType discountType;
        private BigDecimal discountValue;
        private BigDecimal minOrderValue;
        private BigDecimal maxDiscountAmount;
        private LocalDate startDate;
        private LocalDate endDate;
        private Integer usageLimit;
        private Integer usedCount;
        private Boolean isActive;
    }
}