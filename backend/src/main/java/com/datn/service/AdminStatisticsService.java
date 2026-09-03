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
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Thống kê doanh thu/đơn hàng/sản phẩm bán chạy, gộp cả ONLINE và POS (cùng bảng orders).
 * Doanh thu GỘP = đơn COMPLETED + đơn RETURNED (đơn RETURNED vẫn từng là 1 giao dịch bán thật);
 * Doanh thu THUẦN = Gộp - Hoàn trả = đúng bằng tổng các đơn hiện đang COMPLETED (luôn >= 0) --
 * KHÔNG tính "gộp trừ hoàn trả" theo cách chỉ lấy đơn COMPLETED hiện tại rồi trừ thêm 1 lần nữa,
 * vì như vậy 1 đơn mua-rồi-hoàn sẽ bị trừ khống (không có ở đâu để trừ ra) khiến doanh thu thuần
 * có thể âm dù về bản chất phải triệt tiêu về đúng 0.
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
            LocalDate from, LocalDate to, int topProductLimit, Integer categoryId, Integer brandId,
            Order.OrderType orderType, Order.PaymentMethod paymentMethod) {
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        // findForStatistics -- đơn RETURNED được lọc theo returnedAt (ngày hoàn thật), không phải createdAt
        // như 3 trạng thái còn lại (xem chú thích ở OrderRepository).
        List<Order> orders = orderRepository.findForStatistics(
                List.of(Order.Status.COMPLETED, Order.Status.CANCELLED, Order.Status.RETURN_REQUESTED),
                Order.Status.RETURNED,
                fromDateTime, toDateTime);

        // 4 chiều lọc tuỳ chọn -- áp dụng ở CẤP ĐƠN HÀNG (đơn có >=1 sản phẩm khớp điều kiện thì tính cả
        // đơn, không tách riêng doanh thu từng dòng trong 1 đơn mua nhiều danh mục/thương hiệu khác nhau
        // -- đơn giản hơn và đúng với cách chủ shop thường hình dung "đơn có bán món này").
        if (orderType != null) {
            orders = orders.stream().filter(o -> o.getOrderType() == orderType).toList();
        }
        if (paymentMethod != null) {
            orders = orders.stream().filter(o -> o.getPaymentMethod() == paymentMethod).toList();
        }
        if (categoryId != null) {
            orders = orders.stream().filter(o -> orderHasCategory(o, categoryId)).toList();
        }
        if (brandId != null) {
            orders = orders.stream().filter(o -> orderHasBrand(o, brandId)).toList();
        }

        // isRealizedRevenue() lọc bỏ đúng 1 lỗ hổng: PosOrderService.checkout cho 1 hoá đơn BANK_TRANSFER
        // lên thẳng COMPLETED trong khi paymentStatus vẫn UNPAID (chưa xác nhận thu ngân đã nhận tiền) --
        // không lọc thì hoá đơn đó bị tính vào doanh thu dù tiền chưa chắc đã về.
        List<Order> completed = orders.stream()
                .filter(o -> o.getStatus() == Order.Status.COMPLETED)
                .filter(this::isRealizedRevenue)
                .toList();
        List<Order> returned = orders.stream()
                .filter(o -> o.getStatus() == Order.Status.RETURNED)
                .filter(this::isRealizedRevenue)
                .toList();
        long cancelledCount = orders.stream().filter(o -> o.getStatus() == Order.Status.CANCELLED).count();
        long returnRequestedCount = orders.stream().filter(o -> o.getStatus() == Order.Status.RETURN_REQUESTED).count();

        // completedOnlyRevenue: tổng các đơn ĐANG (hiện tại) ở trạng thái COMPLETED -- đây mới là doanh
        // thu THỰC SỰ còn giữ được.
        // grossRevenue (Doanh thu gộp): completedOnlyRevenue CỘNG THÊM cả đơn đã RETURNED -- vì đơn đó
        // lúc bán vẫn là 1 giao dịch thật, chỉ là sau đó có 1 giao dịch hoàn tiền riêng. Nếu không cộng lại
        // phần này, đơn RETURNED sẽ chỉ còn xuất hiện ở returnedRevenue (bị trừ) mà KHÔNG hề có ở đâu để trừ
        // NÓ RA -- tức bị trừ "khống" 1 lần, khiến netRevenue có thể âm dù về bản chất 1 đơn mua-rồi-hoàn
        // phải triệt tiêu về đúng 0, không phải về số âm.
        BigDecimal completedOnlyRevenue = sumTotal(completed, categoryId, brandId);
        BigDecimal returnedRevenue = sumTotal(returned, categoryId, brandId);
        BigDecimal grossRevenue = completedOnlyRevenue.add(returnedRevenue);
        // netRevenue = grossRevenue - returnedRevenue = completedOnlyRevenue -- luôn >= 0 vì là tổng các
        // đơn COMPLETED (totalAmount không bao giờ âm), không còn kiểu "hoàn 1 đơn kéo cả kỳ xuống âm" nữa.
        BigDecimal netRevenue = completedOnlyRevenue;

        List<Order> onlineCompleted = completed.stream().filter(o -> o.getOrderType() == Order.OrderType.ONLINE).toList();
        List<Order> posCompleted = completed.stream().filter(o -> o.getOrderType() == Order.OrderType.POS).toList();

        // Giá trị đơn TB = doanh thu của các đơn COMPLETED / số đơn COMPLETED -- không liên quan hoàn trả.
        BigDecimal avgOrderValue = completed.isEmpty()
                ? BigDecimal.ZERO
                : completedOnlyRevenue.divide(BigDecimal.valueOf(completed.size()), 0, RoundingMode.HALF_UP);

        StatisticsDto.Summary summary = StatisticsDto.Summary.builder()
                .totalRevenue(netRevenue)
                .completedRevenue(grossRevenue)
                .returnedRevenue(returnedRevenue)
                .totalOrders(completed.size())
                .averageOrderValue(avgOrderValue)
                .onlineOrders(onlineCompleted.size())
                .posOrders(posCompleted.size())
                .onlineRevenue(sumTotal(onlineCompleted, categoryId, brandId))
                .posRevenue(sumTotal(posCompleted, categoryId, brandId))
                .cancelledOrders(cancelledCount)
                .returnedOrders(returned.size() + returnRequestedCount)
                .build();

        StatisticsDto.PeriodComparison periodComparison = computePeriodComparison(
                from, to, categoryId, brandId, orderType, paymentMethod, grossRevenue, completed.size());

        // Tách riêng doanh thu GỘP (completed + returned, khớp đúng ý nghĩa grossRevenue ở trên) và
        // HOÀN TRẢ theo ngày -- để biểu đồ vẽ 2 cột riêng biệt (xanh = doanh thu gộp, đỏ = hoàn trả)
        // thay vì 1 con số âm gây hiểu lầm là "lỗi".
        Map<LocalDate, BigDecimal> revenueByDate = new TreeMap<>();
        Map<LocalDate, BigDecimal> returnedByDate = new TreeMap<>();
        Map<LocalDate, Long> countByDate = new TreeMap<>();
        for (Order o : completed) {
            LocalDate d = o.getCreatedAt().toLocalDate();
            revenueByDate.merge(d, orderRevenue(o, categoryId, brandId), BigDecimal::add);
            countByDate.merge(d, 1L, Long::sum);
        }
        for (Order o : returned) {
            // returnedAt (ngày THỰC SỰ hoàn trả) -- không phải createdAt (ngày TẠO đơn, có thể ở 1 kỳ báo
            // cáo hoàn toàn khác, vd đặt tháng 7 nhưng trả hàng tháng 9). Đơn cũ trước khi có cột này
            // (returnedAt null) fallback về createdAt thay vì NullPointerException.
            LocalDate d = (o.getReturnedAt() != null ? o.getReturnedAt() : o.getCreatedAt()).toLocalDate();
            // Cộng vào revenueByDate (không chỉ returnedByDate) -- đơn này vẫn từng là 1 giao dịch đã bán,
            // khớp đúng định nghĩa "gộp" ở grossRevenue phía trên -- nhưng gộp vào đúng NGÀY HOÀN, không
            // phải ngày bán, vì đó là ngày dòng tiền hoàn thực sự phát sinh.
            BigDecimal amount = orderRevenue(o, categoryId, brandId);
            revenueByDate.merge(d, amount, BigDecimal::add);
            returnedByDate.merge(d, amount, BigDecimal::add);
        }

        List<StatisticsDto.RevenuePoint> revenueByDay = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            revenueByDay.add(StatisticsDto.RevenuePoint.builder()
                    .date(d)
                    .revenue(revenueByDate.getOrDefault(d, BigDecimal.ZERO))
                    .returnedRevenue(returnedByDate.getOrDefault(d, BigDecimal.ZERO))
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
        List<StatisticsDto.PaymentMethodStat> paymentMethodBreakdown = computePaymentMethodBreakdown(completed, categoryId, brandId);
        List<StatisticsDto.LowStockItem> lowStockVariants = computeLowStockVariants();

        return StatisticsDto.StatisticsResponse.builder()
                .summary(summary)
                .periodComparison(periodComparison)
                .revenueByDay(revenueByDay)
                .topProducts(topProducts)
                .revenueByCategory(revenueByCategory)
                .paymentMethodBreakdown(paymentMethodBreakdown)
                .lowStockVariants(lowStockVariants)
                .build();
    }

    /** So sánh doanh thu GỘP (completed + returned, khớp đúng grossRevenue) / số đơn COMPLETED với kỳ
     * liền trước có CÙNG độ dài, cùng bộ lọc danh mục/kênh bán, để %Δ phản ánh đúng xu hướng bán hàng
     * thay vì so lệch kỳ dài/ngắn khác nhau hoặc bị hoàn trả làm méo số liệu. */
    private StatisticsDto.PeriodComparison computePeriodComparison(
            LocalDate from, LocalDate to, Integer categoryId, Integer brandId, Order.OrderType orderType,
            Order.PaymentMethod paymentMethod, BigDecimal currentGrossRevenue, long currentOrderCount) {
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        LocalDate prevTo = from.minusDays(1);
        LocalDate prevFrom = prevTo.minusDays(days - 1);

        List<Order> prevOrders = orderRepository.findForStatistics(
                List.of(Order.Status.COMPLETED), Order.Status.RETURNED,
                prevFrom.atStartOfDay(), prevTo.atTime(LocalTime.MAX));
        if (orderType != null) {
            prevOrders = prevOrders.stream().filter(o -> o.getOrderType() == orderType).toList();
        }
        if (paymentMethod != null) {
            prevOrders = prevOrders.stream().filter(o -> o.getPaymentMethod() == paymentMethod).toList();
        }
        if (categoryId != null) {
            prevOrders = prevOrders.stream().filter(o -> orderHasCategory(o, categoryId)).toList();
        }
        if (brandId != null) {
            prevOrders = prevOrders.stream().filter(o -> orderHasBrand(o, brandId)).toList();
        }
        prevOrders = prevOrders.stream().filter(this::isRealizedRevenue).toList();
        BigDecimal prevGrossRevenue = sumTotal(prevOrders, categoryId, brandId);
        long prevOrderCount = prevOrders.stream().filter(o -> o.getStatus() == Order.Status.COMPLETED).count();

        return StatisticsDto.PeriodComparison.builder()
                .revenueChangePercent(percentChange(prevGrossRevenue, currentGrossRevenue))
                .orderCountChangePercent(percentChange(BigDecimal.valueOf(prevOrderCount), BigDecimal.valueOf(currentOrderCount)))
                .build();
    }

    /** Null nếu kỳ trước = 0 -- không có mẫu số để tính %, tránh chia cho 0 hoặc hiện +∞% vô nghĩa. */
    private BigDecimal percentChange(BigDecimal previous, BigDecimal current) {
        if (previous.compareTo(BigDecimal.ZERO) == 0) return null;
        return current.subtract(previous)
                .divide(previous, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
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

    private List<StatisticsDto.PaymentMethodStat> computePaymentMethodBreakdown(
            List<Order> completed, Integer categoryId, Integer brandId) {
        Map<Order.PaymentMethod, Long> countByMethod = new EnumMap<>(Order.PaymentMethod.class);
        Map<Order.PaymentMethod, BigDecimal> revenueByMethod = new EnumMap<>(Order.PaymentMethod.class);
        for (Order o : completed) {
            if (o.getPaymentMethod() == null) continue;
            countByMethod.merge(o.getPaymentMethod(), 1L, Long::sum);
            revenueByMethod.merge(o.getPaymentMethod(), orderRevenue(o, categoryId, brandId), BigDecimal::add);
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

    /**
     * true nếu đơn thật sự có dòng tiền đứng sau nó -- COD luôn coi là đã thu (tiền mặt/thu hộ khi giao;
     * đơn ONLINE COD cũng không có bước "xác nhận đã thu" riêng nên paymentStatus giữ UNPAID mãi mãi, KHÔNG
     * được lọc theo paymentStatus==PAID cho COD kẻo xoá nhầm gần hết doanh thu COD hợp lệ). BANK_TRANSFER/
     * VNPAY thì tính là thật khi paymentStatus khác UNPAID -- PAID (đã xác nhận) hoặc REFUNDED (đơn từng
     * PAID thật, sau đó mới bị hoàn -- vẫn phải tính, chỉ loại đúng trường hợp CHƯA từng ai xác nhận có
     * tiền về).
     */
    private boolean isRealizedRevenue(Order order) {
        return order.getPaymentMethod() == Order.PaymentMethod.COD
                || order.getPaymentStatus() != Order.PaymentStatus.UNPAID;
    }

    private boolean orderHasCategory(Order order, Integer categoryId) {
        return order.getItems().stream().anyMatch(i ->
                i.getVariant() != null && i.getVariant().getProduct() != null
                        && i.getVariant().getProduct().getCategory() != null
                        && categoryId.equals(i.getVariant().getProduct().getCategory().getCategoryId()));
    }

    private boolean orderHasBrand(Order order, Integer brandId) {
        return order.getItems().stream().anyMatch(i ->
                i.getVariant() != null && i.getVariant().getProduct() != null
                        && i.getVariant().getProduct().getBrand() != null
                        && brandId.equals(i.getVariant().getProduct().getBrand().getBrandId()));
    }

    /**
     * Doanh thu của 1 đơn -- không lọc gì thì lấy nguyên totalAmount (đã gồm shipping fee, trừ discount)
     * như trước giờ. Có lọc danh mục và/hoặc thương hiệu thì CHỈ cộng subtotal của đúng các dòng khớp điều
     * kiện, không phải nguyên totalAmount của cả đơn -- orderHasCategory()/orderHasBrand() chỉ yêu cầu đơn
     * có >=1 sản phẩm khớp, 1 đơn mua lẫn nhiều danh mục/thương hiệu khác nhau (vd áo 100k + quần 900k) nếu
     * cộng nguyên totalAmount sẽ thổi phồng doanh thu bị lọc lên gấp nhiều lần giá trị thật, và shipping
     * fee/giảm giá cấp đơn cũng bị tính lẫn vào doanh thu 1 danh mục/thương hiệu cụ thể một cách vô lý.
     */
    private BigDecimal orderRevenue(Order order, Integer categoryId, Integer brandId) {
        if (categoryId == null && brandId == null) {
            return order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        }
        return order.getItems().stream()
                .filter(i -> i.getVariant() != null && i.getVariant().getProduct() != null
                        && (categoryId == null || (i.getVariant().getProduct().getCategory() != null
                                && categoryId.equals(i.getVariant().getProduct().getCategory().getCategoryId())))
                        && (brandId == null || (i.getVariant().getProduct().getBrand() != null
                                && brandId.equals(i.getVariant().getProduct().getBrand().getBrandId()))))
                .map(OrderItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumTotal(List<Order> orders, Integer categoryId, Integer brandId) {
        return orders.stream().map(o -> orderRevenue(o, categoryId, brandId)).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}