package com.datn.service;

import com.datn.dto.statistics.StatisticsDto;
import com.datn.entity.Order;
import com.datn.entity.OrderItem;
import com.datn.repository.OrderRepository;
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

    private final OrderRepository orderRepository;

    public StatisticsDto.StatisticsResponse getStatistics(LocalDate from, LocalDate to, int topProductLimit) {
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        List<Order> orders = orderRepository.findByStatusInAndCreatedAtBetween(
                List.of(Order.Status.COMPLETED, Order.Status.RETURNED, Order.Status.CANCELLED,
                        Order.Status.RETURN_REQUESTED),
                fromDateTime, toDateTime);

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

        return StatisticsDto.StatisticsResponse.builder()
                .summary(summary)
                .revenueByDay(revenueByDay)
                .topProducts(topProducts)
                .build();
    }

    private BigDecimal sumTotal(List<Order> orders) {
        return orders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}