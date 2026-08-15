package com.datn.service;

import com.datn.dto.statistics.StatisticsDto;
import com.datn.entity.Order;
import com.datn.entity.OrderItem;
import com.datn.entity.ProductVariant;
import com.datn.repository.OrderRepository;
import com.datn.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Thống kê doanh thu/đơn hàng/sản phẩm bán chạy, gộp cả ONLINE và POS (cùng bảng orders).
 * Doanh thu chỉ tính đơn COMPLETED; RETURNED bị trừ lại; các trạng thái khác không tính.
 */
@Service
@RequiredArgsConstructor
public class AdminStatisticsService {

    // Khớp đúng AdminInventoryService.LOW_STOCK_THRESHOLD -- cùng 1 định nghĩa "sắp hết hàng" cho cả
    // trang Kho tồn hàng lẫn cảnh báo ở đây, không lệch số giữa 2 nơi.
    private static final int LOW_STOCK_THRESHOLD = 5;

    private final OrderRepository orderRepository;
    private final ProductVariantRepository productVariantRepository;

    public StatisticsDto.StatisticsResponse getStatistics(
            LocalDate from, LocalDate to, int topProductLimit, Integer categoryId, Order.OrderType orderType) {
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        List<Order> orders = orderRepository.findByStatusInAndCreatedAtBetween(
                List.of(Order.Status.COMPLETED, Order.Status.RETURNED, Order.Status.CANCELLED,
                        Order.Status.RETURN_REQUESTED),
                fromDateTime, toDateTime);

        // 2 chiều lọc tuỳ chọn -- áp dụng ở CẤP ĐƠN HÀNG (đơn có >=1 sản phẩm thuộc đúng danh mục thì
        // tính cả đơn, không tách riêng doanh thu từng dòng trong 1 đơn mua nhiều danh mục khác nhau --
        // đơn giản hơn và đúng với cách chủ shop thường hình dung "đơn có bán món này").
        if (orderType != null) {
            orders = orders.stream().filter(o -> o.getOrderType() == orderType).toList();
        }
        if (categoryId != null) {
            orders = orders.stream().filter(o -> orderHasCategory(o, categoryId)).toList();
        }

        List<Order> completed = orders.stream().filter(o -> o.getStatus() == Order.Status.COMPLETED).toList();
        List<Order> returned = orders.stream().filter(o -> o.getStatus() == Order.Status.RETURNED).toList();
        long cancelledCount = orders.stream().filter(o -> o.getStatus() == Order.Status.CANCELLED).count();
        long returnRequestedCount = orders.stream().filter(o -> o.getStatus() == Order.Status.RETURN_REQUESTED).count();

        BigDecimal completedRevenue = sumTotal(completed);
        BigDecimal returnedRevenue = sumTotal(returned);
        BigDecimal netRevenue = completedRevenue.subtract(returnedRevenue);

        List<Order> onlineCompleted = completed.stream().filter(o -> o.getOrderType() == Order.OrderType.ONLINE).toList();
        List<Order> posCompleted = completed.stream().filter(o -> o.getOrderType() == Order.OrderType.POS).toList();

        BigDecimal avgOrderValue = completed.isEmpty()
                ? BigDecimal.ZERO
                : netRevenue.divide(BigDecimal.valueOf(completed.size()), 0, java.math.RoundingMode.HALF_UP);

        StatisticsDto.Summary summary = StatisticsDto.Summary.builder()
                .totalRevenue(netRevenue)
                .totalOrders(completed.size())
                .averageOrderValue(avgOrderValue)
                .onlineOrders(onlineCompleted.size())
                .posOrders(posCompleted.size())
                .onlineRevenue(sumTotal(onlineCompleted))
                .posRevenue(sumTotal(posCompleted))
                .cancelledOrders(cancelledCount)
                .returnedOrders(returned.size() + returnRequestedCount)
                .build();

        Map<LocalDate, BigDecimal> revenueByDate = new TreeMap<>();
        Map<LocalDate, Long> countByDate = new TreeMap<>();
        for (Order o : completed) {
            LocalDate d = o.getCreatedAt().toLocalDate();
            revenueByDate.merge(d, o.getTotalAmount(), BigDecimal::add);
            countByDate.merge(d, 1L, Long::sum);
        }
        for (Order o : returned) {
            LocalDate d = o.getCreatedAt().toLocalDate();
            revenueByDate.merge(d, o.getTotalAmount().negate(), BigDecimal::add);
        }

        List<StatisticsDto.RevenuePoint> revenueByDay = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            revenueByDay.add(StatisticsDto.RevenuePoint.builder()
                    .date(d)
                    .revenue(revenueByDate.getOrDefault(d, BigDecimal.ZERO))
                    .orderCount(countByDate.getOrDefault(d, 0L))
                    .build());
        }

        Map<String, Long> qtyByProduct = new HashMap<>();
        Map<String, BigDecimal> revenueByProduct = new HashMap<>();
        for (Order o : completed) {
            for (OrderItem item : o.getItems()) {
                String key = item.getProductName();
                qtyByProduct.merge(key, (long) item.getQuantity(), Long::sum);
                revenueByProduct.merge(key, item.getSubtotal(), BigDecimal::add);
            }
        }
        List<StatisticsDto.TopProduct> topProducts = qtyByProduct.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(topProductLimit)
                .map(e -> StatisticsDto.TopProduct.builder()
                        .productName(e.getKey())
                        .quantitySold(e.getValue())
                        .revenue(revenueByProduct.getOrDefault(e.getKey(), BigDecimal.ZERO))
                        .build())
                .collect(Collectors.toList());

        List<StatisticsDto.CategoryRevenue> revenueByCategory = computeRevenueByCategory(completed);
        List<StatisticsDto.PaymentMethodStat> paymentMethodBreakdown = computePaymentMethodBreakdown(completed);
        List<StatisticsDto.LowStockItem> lowStockVariants = computeLowStockVariants();

        return StatisticsDto.StatisticsResponse.builder()
                .summary(summary)
                .revenueByDay(revenueByDay)
                .topProducts(topProducts)
                .revenueByCategory(revenueByCategory)
                .paymentMethodBreakdown(paymentMethodBreakdown)
                .lowStockVariants(lowStockVariants)
                .build();
    }

    /** Gộp doanh thu theo danh mục (Áo/Quần/...) -- item không còn variant (hiếm, xem OrderItem.variant)
     * bị bỏ qua vì không truy được category. */
    private List<StatisticsDto.CategoryRevenue> computeRevenueByCategory(List<Order> completed) {
        Map<String, Long> qtyByCategory = new HashMap<>();
        Map<String, BigDecimal> revenueByCategory = new HashMap<>();
        for (Order o : completed) {
            for (OrderItem item : o.getItems()) {
                if (item.getVariant() == null || item.getVariant().getProduct() == null
                        || item.getVariant().getProduct().getCategory() == null) continue;
                String key = item.getVariant().getProduct().getCategory().getCategoryName();
                qtyByCategory.merge(key, (long) item.getQuantity(), Long::sum);
                revenueByCategory.merge(key, item.getSubtotal(), BigDecimal::add);
            }
        }
        return revenueByCategory.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .map(e -> StatisticsDto.CategoryRevenue.builder()
                        .categoryName(e.getKey())
                        .revenue(e.getValue())
                        .quantitySold(qtyByCategory.getOrDefault(e.getKey(), 0L))
                        .build())
                .collect(Collectors.toList());
    }

    private List<StatisticsDto.PaymentMethodStat> computePaymentMethodBreakdown(List<Order> completed) {
        Map<Order.PaymentMethod, Long> countByMethod = new EnumMap<>(Order.PaymentMethod.class);
        Map<Order.PaymentMethod, BigDecimal> revenueByMethod = new EnumMap<>(Order.PaymentMethod.class);
        for (Order o : completed) {
            if (o.getPaymentMethod() == null) continue;
            countByMethod.merge(o.getPaymentMethod(), 1L, Long::sum);
            revenueByMethod.merge(o.getPaymentMethod(), o.getTotalAmount(), BigDecimal::add);
        }
        return countByMethod.entrySet().stream()
                .sorted((a, b) -> revenueByMethod.get(b.getKey()).compareTo(revenueByMethod.get(a.getKey())))
                .map(e -> StatisticsDto.PaymentMethodStat.builder()
                        .paymentMethod(e.getKey().name())
                        .orderCount(e.getValue())
                        .revenue(revenueByMethod.getOrDefault(e.getKey(), BigDecimal.ZERO))
                        .build())
                .collect(Collectors.toList());
    }

    /** Không phụ thuộc khoảng ngày đang xem -- luôn là tình trạng tồn kho HIỆN TẠI, không phải lịch sử. */
    private List<StatisticsDto.LowStockItem> computeLowStockVariants() {
        List<ProductVariant> variants =
                productVariantRepository.findTop10ByStockQuantityLessThanEqualOrderByStockQuantityAsc(LOW_STOCK_THRESHOLD);
        return variants.stream()
                .map(v -> StatisticsDto.LowStockItem.builder()
                        .productName(v.getProduct().getProductName())
                        .size(v.getSize())
                        .color(v.getColor())
                        .stockQuantity(v.getStockQuantity())
                        .build())
                .collect(Collectors.toList());
    }

    private boolean orderHasCategory(Order order, Integer categoryId) {
        return order.getItems().stream().anyMatch(i ->
                i.getVariant() != null && i.getVariant().getProduct() != null
                        && i.getVariant().getProduct().getCategory() != null
                        && categoryId.equals(i.getVariant().getProduct().getCategory().getCategoryId()));
    }

    private BigDecimal sumTotal(List<Order> orders) {
        return orders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}