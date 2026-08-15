package com.datn.dto.statistics;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class StatisticsDto {

    @Getter
    @Builder
    public static class Summary {
        private BigDecimal totalRevenue;      // doanh thu (COMPLETED trừ đi RETURNED)
        private long totalOrders;             // tổng số đơn COMPLETED trong kỳ
        private BigDecimal averageOrderValue;
        private long onlineOrders;
        private long posOrders;
        private BigDecimal onlineRevenue;
        private BigDecimal posRevenue;
        private long cancelledOrders;
        private long returnedOrders;
    }

    @Getter
    @Builder
    public static class RevenuePoint {
        private LocalDate date;
        private BigDecimal revenue;
        private long orderCount;
    }

    @Getter
    @Builder
    public static class TopProduct {
        private String productName;
        private long quantitySold;
        private BigDecimal revenue;
    }

    @Getter
    @Builder
    public static class CategoryRevenue {
        private String categoryName;
        private BigDecimal revenue;
        private long quantitySold;
    }

    @Getter
    @Builder
    public static class PaymentMethodStat {
        private String paymentMethod;
        private long orderCount;
        private BigDecimal revenue;
    }

    @Getter
    @Builder
    public static class LowStockItem {
        private String productName;
        private String size;
        private String color;
        private Integer stockQuantity;
    }

    @Getter
    @Builder
    public static class StatisticsResponse {
        private Summary summary;
        private List<RevenuePoint> revenueByDay;
        private List<TopProduct> topProducts;
        private List<CategoryRevenue> revenueByCategory;
        private List<PaymentMethodStat> paymentMethodBreakdown;
        private List<LowStockItem> lowStockVariants;
    }
}