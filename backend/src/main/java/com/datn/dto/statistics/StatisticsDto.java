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
        private BigDecimal totalRevenue;      // doanh thu THUẦN = completedRevenue (gộp) - returnedRevenue -- luôn >= 0, đúng bằng tổng các đơn hiện đang COMPLETED
        private BigDecimal completedRevenue;  // doanh thu GỘP -- gồm cả đơn COMPLETED lẫn đơn đã RETURNED (đơn RETURNED vẫn từng là 1 giao dịch bán thật)
        private BigDecimal returnedRevenue;   // tổng giá trị đơn đã HOÀN TRẢ trong kỳ (luôn >= 0)
        private long totalOrders;             // tổng số đơn COMPLETED trong kỳ
        private BigDecimal averageOrderValue; // = completedRevenue / totalOrders -- KHÔNG trừ hoàn trả nên không thể âm
        private long onlineOrders;
        private long posOrders;
        private BigDecimal onlineRevenue;
        private BigDecimal posRevenue;
        private long cancelledOrders;
        private long returnedOrders;
    }

    /** So sánh với kỳ liền trước (cùng độ dài) -- null nếu kỳ trước không có dữ liệu để so sánh (completedRevenue = 0). */
    @Getter
    @Builder
    public static class PeriodComparison {
        private BigDecimal revenueChangePercent;
        private BigDecimal orderCountChangePercent;
    }

    @Getter
    @Builder
    public static class RevenuePoint {
        private LocalDate date;
        private BigDecimal revenue;         // doanh thu GỘP trong ngày (đơn COMPLETED + đơn RETURNED tạo trong ngày này)
        private BigDecimal returnedRevenue; // giá trị hoàn trả trong ngày (luôn >= 0)
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
        private PeriodComparison periodComparison;
        private List<RevenuePoint> revenueByDay;
        private List<TopProduct> topProducts;
        private List<CategoryRevenue> revenueByCategory;
        private List<PaymentMethodStat> paymentMethodBreakdown;
        private List<LowStockItem> lowStockVariants;
    }
}