package com.datn.service;

import com.datn.dto.statistics.StatisticsDto;
import com.datn.entity.Category;
import com.datn.entity.Order;
import com.datn.entity.OrderItem;
import com.datn.entity.Product;
import com.datn.entity.ProductVariant;
import com.datn.exception.ApiException;
import com.datn.repository.CategoryRepository;
import com.datn.repository.OrderRepository;
import com.datn.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
// readOnly = true -- toàn bộ service chỉ đọc. Quan trọng hơn: mở sẵn 1 transaction/session cho cả lượt
// tính, để việc duyệt variant/product/category/brand (LAZY) không phụ thuộc vào spring.jpa.open-in-view
// (mặc định đang bật) -- tắt cấu hình đó đi thì trang này sẽ ném LazyInitializationException.
@Transactional(readOnly = true)
public class AdminStatisticsService {

    // Khớp đúng AdminInventoryService.LOW_STOCK_THRESHOLD -- cùng 1 định nghĩa "sắp hết hàng" cho cả
    // trang Kho tồn hàng lẫn cảnh báo ở đây, không lệch số giữa 2 nơi.
    private static final int LOW_STOCK_THRESHOLD = 5;

    private final OrderRepository orderRepository;
    private final ProductVariantRepository productVariantRepository;
    private final CategoryRepository categoryRepository;

    /**
     * Danh mục được chọn CỘNG toàn bộ danh mục con-cháu của nó -- chọn "Áo" (danh mục cha, không sản phẩm
     * nào gắn trực tiếp) phải ra tổng của Áo thun + Áo sơ mi + Áo khoác..., không phải 0₫. Duyệt theo tầng
     * nên cây sâu bao nhiêu cấp cũng đúng; null = không lọc danh mục.
     */
    private Set<Integer> resolveCategoryIds(Integer categoryId) {
        if (categoryId == null) return null;
        Map<Integer, List<Integer>> childrenByParent = new HashMap<>();
        for (Category c : categoryRepository.findAll()) {
            Integer parentId = c.getParent() != null ? c.getParent().getCategoryId() : null;
            if (parentId != null) {
                childrenByParent.computeIfAbsent(parentId, k -> new ArrayList<>()).add(c.getCategoryId());
            }
        }
        Set<Integer> result = new HashSet<>();
        Deque<Integer> stack = new ArrayDeque<>();
        stack.push(categoryId);
        while (!stack.isEmpty()) {
            Integer current = stack.pop();
            // add() trả false nếu đã thăm -- chặn luôn trường hợp dữ liệu lỗi tạo vòng lặp cha-con.
            if (!result.add(current)) continue;
            childrenByParent.getOrDefault(current, List.of()).forEach(stack::push);
        }
        return result;
    }

    public StatisticsDto.StatisticsResponse getStatistics(
            LocalDate from, LocalDate to, int topProductLimit, Integer categoryId, Integer brandId,
            Order.OrderType orderType, Order.PaymentMethod paymentMethod) {
        if (from.isAfter(to)) {
            throw ApiException.badRequest("\"Từ ngày\" phải trước hoặc trùng \"Đến ngày\"");
        }
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);
        // Chọn 1 danh mục CHA thì gộp luôn mọi danh mục con của nó (xem resolveCategoryIds).
        Set<Integer> categoryIds = resolveCategoryIds(categoryId);

        // findForStatistics -- đơn RETURNED được lọc theo returnedAt (ngày hoàn thật), không phải createdAt
        // như 3 trạng thái còn lại (xem chú thích ở OrderRepository).
        List<Order> orders = orderRepository.findForStatistics(
                List.of(Order.Status.COMPLETED, Order.Status.CANCELLED, Order.Status.RETURN_REQUESTED),
                Order.Status.RETURNED,
                fromDateTime, toDateTime);

        if (orderType != null) {
            orders = orders.stream().filter(o -> o.getOrderType() == orderType).toList();
        }
        if (paymentMethod != null) {
            orders = orders.stream().filter(o -> o.getPaymentMethod() == paymentMethod).toList();
        }
        // Lọc danh mục/thương hiệu -- giữ đơn có ÍT NHẤT 1 DÒNG khớp ĐỒNG THỜI cả 2 điều kiện, đúng bằng
        // tập dòng mà orderRevenue() dùng để tính tiền. KHÔNG kiểm tra 2 điều kiện độc lập nhau: 1 đơn có
        // áo (đúng danh mục, khác thương hiệu) + quần (đúng thương hiệu, khác danh mục) sẽ qua được cả 2
        // phép kiểm riêng lẻ nhưng không có dòng nào khớp cả hai -> bị đếm là 1 đơn mà doanh thu bằng 0.
        if (categoryIds != null || brandId != null) {
            orders = orders.stream()
                    .filter(o -> o.getItems().stream().anyMatch(i -> itemMatchesFilters(i, categoryIds, brandId)))
                    .toList();
        }

        // isRealizedRevenue() lọc bỏ đúng 1 lỗ hổng: PosOrderService.checkout cho 1 hoá đơn BANK_TRANSFER
        // lên thẳng COMPLETED trong khi paymentStatus vẫn UNPAID (chưa xác nhận thu ngân đã nhận tiền) --
        // không lọc thì hoá đơn đó bị tính vào doanh thu dù tiền chưa chắc đã về.
        List<Order> completed = orders.stream()
                .filter(o -> o.getStatus() == Order.Status.COMPLETED)
                .filter(this::isRealizedRevenue)
                .toList();
        // Đơn khách VỪA yêu cầu trả hàng nhưng admin CHƯA duyệt -- vẫn là 1 giao dịch bán đã hoàn tất, tiền
        // vẫn đang ở shop. Không gộp vào đây thì doanh thu tụt ngay lúc khách bấm "yêu cầu trả hàng" mà
        // KHÔNG có khoản hoàn trả nào bù lại -> số tiền "bốc hơi" không giải thích được trên báo cáo.
        List<Order> returnPending = orders.stream()
                .filter(o -> o.getStatus() == Order.Status.RETURN_REQUESTED)
                .filter(this::isRealizedRevenue)
                .toList();
        List<Order> returned = orders.stream()
                .filter(o -> o.getStatus() == Order.Status.RETURNED)
                .filter(this::isRealizedRevenue)
                .toList();
        // Các đơn đã bán thành công và tiền còn đang ở shop (chưa hoàn) -- dùng cho mọi số liệu doanh thu.
        List<Order> soldOrders = new ArrayList<>(completed);
        soldOrders.addAll(returnPending);

        long cancelledCount = orders.stream().filter(o -> o.getStatus() == Order.Status.CANCELLED).count();
        // Số LƯỢT trả hàng là chỉ số vận hành, không phải chỉ số dòng tiền -- KHÔNG lọc theo
        // isRealizedRevenue (1 hoá đơn chuyển khoản chưa xác nhận mà bị trả hàng thì lượt trả vẫn xảy ra
        // thật), nếu không 2 nửa của cùng 1 con số sẽ dùng 2 tiêu chuẩn khác nhau.
        long returnedCount = orders.stream().filter(o -> o.getStatus() == Order.Status.RETURNED).count();
        long returnRequestedCount = orders.stream().filter(o -> o.getStatus() == Order.Status.RETURN_REQUESTED).count();

        // heldRevenue: tiền của các đơn đã bán mà shop VẪN ĐANG GIỮ (COMPLETED + đang chờ duyệt trả hàng).
        // grossRevenue (Doanh thu gộp): heldRevenue CỘNG THÊM cả đơn đã RETURNED -- vì đơn đó lúc bán vẫn là
        // 1 giao dịch thật, chỉ là sau đó có 1 giao dịch hoàn tiền riêng. Nếu không cộng lại phần này, đơn
        // RETURNED sẽ chỉ còn xuất hiện ở returnedRevenue (bị trừ) mà KHÔNG hề có ở đâu để trừ NÓ RA -- tức
        // bị trừ "khống" 1 lần, khiến netRevenue có thể âm dù 1 đơn mua-rồi-hoàn phải triệt tiêu về đúng 0.
        BigDecimal heldRevenue = sumTotal(soldOrders, categoryIds, brandId);
        BigDecimal returnedRevenue = sumTotal(returned, categoryIds, brandId);
        BigDecimal grossRevenue = heldRevenue.add(returnedRevenue);
        BigDecimal netRevenue = heldRevenue;

        List<Order> onlineSold = soldOrders.stream().filter(o -> o.getOrderType() == Order.OrderType.ONLINE).toList();
        List<Order> posSold = soldOrders.stream().filter(o -> o.getOrderType() == Order.OrderType.POS).toList();

        // Giá trị đơn TB = doanh thu đang giữ / số đơn đã bán -- không liên quan hoàn trả.
        BigDecimal avgOrderValue = soldOrders.isEmpty()
                ? BigDecimal.ZERO
                : heldRevenue.divide(BigDecimal.valueOf(soldOrders.size()), 0, RoundingMode.HALF_UP);

        StatisticsDto.Summary summary = StatisticsDto.Summary.builder()
                .totalRevenue(netRevenue)
                .completedRevenue(grossRevenue)
                .returnedRevenue(returnedRevenue)
                .totalOrders(soldOrders.size())
                .averageOrderValue(avgOrderValue)
                .onlineOrders(onlineSold.size())
                .posOrders(posSold.size())
                .onlineRevenue(sumTotal(onlineSold, categoryIds, brandId))
                .posRevenue(sumTotal(posSold, categoryIds, brandId))
                .cancelledOrders(cancelledCount)
                .returnedOrders(returnedCount + returnRequestedCount)
                .build();

        StatisticsDto.PeriodComparison periodComparison = computePeriodComparison(
                from, to, categoryIds, brandId, orderType, paymentMethod, grossRevenue, soldOrders.size());

        // Tách riêng doanh thu GỘP (completed + returned, khớp đúng ý nghĩa grossRevenue ở trên) và
        // HOÀN TRẢ theo ngày -- để biểu đồ vẽ 2 cột riêng biệt (xanh = doanh thu gộp, đỏ = hoàn trả)
        // thay vì 1 con số âm gây hiểu lầm là "lỗi".
        Map<LocalDate, BigDecimal> revenueByDate = new TreeMap<>();
        Map<LocalDate, BigDecimal> returnedByDate = new TreeMap<>();
        Map<LocalDate, Long> countByDate = new TreeMap<>();
        for (Order o : soldOrders) {
            LocalDate d = o.getCreatedAt().toLocalDate();
            revenueByDate.merge(d, orderRevenue(o, categoryIds, brandId), BigDecimal::add);
            countByDate.merge(d, 1L, Long::sum);
        }
        for (Order o : returned) {
            BigDecimal amount = orderRevenue(o, categoryIds, brandId);
            // Doanh thu vào NGÀY BÁN (createdAt) còn khoản hoàn vào NGÀY HOÀN (returnedAt) -- 2 sự kiện
            // khác nhau, xảy ra ở 2 thời điểm khác nhau. Nếu cộng cả doanh thu vào ngày hoàn thì biểu đồ
            // hiện "bán được 500k" đúng vào hôm shop không bán gì mà còn phải trả tiền lại cho khách.
            // Đơn cũ chưa có returnedAt (tạo trước khi thêm cột) fallback về createdAt thay vì NPE.
            // KẸP ngày bán vào trong kỳ đang xem. Đơn bán tháng 7, trả hàng tháng 9: xem báo cáo tháng 9
            // thì findForStatistics vẫn lấy đơn này vào (lọc RETURNED theo returnedAt), và ô "Doanh thu
            // gộp" CÓ cộng phần doanh thu của nó. Nhưng ngày bán 10/07 nằm ngoài vòng lặp vẽ biểu đồ nên
            // phần doanh thu ấy rơi mất khỏi các cột -- tổng cột doanh thu nhỏ hơn ô "Doanh thu gộp" mà
            // không có gì giải thích chênh lệch. Kẹp về ngày đầu kỳ để hai con số dùng chung một định
            // nghĩa; đây là cách ghi nhận "mang sang từ kỳ trước" quen thuộc trong báo cáo.
            LocalDate ngayGhiDoanhThu = o.getCreatedAt().toLocalDate();
            if (ngayGhiDoanhThu.isBefore(from)) ngayGhiDoanhThu = from;
            revenueByDate.merge(ngayGhiDoanhThu, amount, BigDecimal::add);
            LocalDate refundDate = (o.getReturnedAt() != null ? o.getReturnedAt() : o.getCreatedAt()).toLocalDate();
            returnedByDate.merge(refundDate, amount, BigDecimal::add);
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

        // Gộp theo productId, KHÔNG theo productName: productName là chuỗi snapshot lúc đặt hàng, dữ liệu
        // thật đang có nhiều sản phẩm khác nhau (khác thương hiệu, khác giá) trùng y hệt tên -- gộp theo tên
        // sẽ cộng dồn doanh số của 2 mẫu khác nhau thành 1 dòng, chủ shop không biết mẫu nào thật sự bán chạy.
        // Dòng hàng cũ không còn variant (sản phẩm đã bị xoá cứng) mới fallback về tên.
        Map<String, Long> qtyByProduct = new HashMap<>();
        Map<String, BigDecimal> revenueByProduct = new HashMap<>();
        Map<String, String> nameByProduct = new HashMap<>();
        for (Order o : soldOrders) {
            for (OrderItem item : o.getItems()) {
                // Chỉ tính các dòng khớp bộ lọc danh mục/thương hiệu đang chọn -- không lọc thì bảng "bán
                // chạy" liệt kê cả sản phẩm thuộc danh mục khác nằm chung đơn, mâu thuẫn với ô doanh thu.
                if (!itemMatchesFilters(item, categoryIds, brandId)) continue;
                String key = productKey(item);
                qtyByProduct.merge(key, (long) item.getQuantity(), Long::sum);
                revenueByProduct.merge(key, item.getSubtotal(), BigDecimal::add);
                nameByProduct.putIfAbsent(key, item.getProductName());
            }
        }
        List<StatisticsDto.TopProduct> topProducts = qtyByProduct.entrySet().stream()
                // Bán bằng nhau thì xếp theo doanh thu rồi tên -- HashMap không có thứ tự ổn định, thiếu
                // tiêu chí phụ sẽ khiến 2 lần tải cùng 1 bộ lọc cho ra thứ tự khác nhau.
                .sorted(Comparator.comparingLong((Map.Entry<String, Long> e) -> e.getValue()).reversed()
                        .thenComparing(e -> revenueByProduct.getOrDefault(e.getKey(), BigDecimal.ZERO), Comparator.reverseOrder())
                        .thenComparing(e -> nameByProduct.getOrDefault(e.getKey(), "")))
                .limit(topProductLimit)
                .map(e -> StatisticsDto.TopProduct.builder()
                        .productName(nameByProduct.getOrDefault(e.getKey(), e.getKey()))
                        .quantitySold(e.getValue())
                        .revenue(revenueByProduct.getOrDefault(e.getKey(), BigDecimal.ZERO))
                        .build())
                .collect(Collectors.toList());

        List<StatisticsDto.CategoryRevenue> revenueByCategory =
                computeRevenueByCategory(soldOrders, categoryIds, brandId);
        List<StatisticsDto.PaymentMethodStat> paymentMethodBreakdown =
                computePaymentMethodBreakdown(soldOrders, categoryIds, brandId);
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
            LocalDate from, LocalDate to, Set<Integer> categoryIds, Integer brandId, Order.OrderType orderType,
            Order.PaymentMethod paymentMethod, BigDecimal currentGrossRevenue, long currentOrderCount) {
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        LocalDate prevTo = from.minusDays(1);
        LocalDate prevFrom = prevTo.minusDays(days - 1);

        // Cùng tập trạng thái với kỳ hiện tại (kèm RETURN_REQUESTED) để 2 kỳ so sánh cùng 1 định nghĩa.
        List<Order> prevOrders = orderRepository.findForStatistics(
                List.of(Order.Status.COMPLETED, Order.Status.RETURN_REQUESTED), Order.Status.RETURNED,
                prevFrom.atStartOfDay(), prevTo.atTime(LocalTime.MAX));
        if (orderType != null) {
            prevOrders = prevOrders.stream().filter(o -> o.getOrderType() == orderType).toList();
        }
        if (paymentMethod != null) {
            prevOrders = prevOrders.stream().filter(o -> o.getPaymentMethod() == paymentMethod).toList();
        }
        if (categoryIds != null || brandId != null) {
            prevOrders = prevOrders.stream()
                    .filter(o -> o.getItems().stream().anyMatch(i -> itemMatchesFilters(i, categoryIds, brandId)))
                    .toList();
        }
        prevOrders = prevOrders.stream().filter(this::isRealizedRevenue).toList();
        BigDecimal prevGrossRevenue = sumTotal(prevOrders, categoryIds, brandId);
        long prevOrderCount = prevOrders.stream()
                .filter(o -> o.getStatus() == Order.Status.COMPLETED || o.getStatus() == Order.Status.RETURN_REQUESTED)
                .count();

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
     * bị bỏ qua vì không truy được category. Có bộ lọc danh mục/thương hiệu thì chỉ tính các dòng khớp,
     * không thì biểu đồ này hiện cả danh mục khác nằm chung đơn và tổng các cột sẽ LỚN HƠN ô "Doanh thu
     * gộp" ngay phía trên -- 2 con số mâu thuẫn nhau trên cùng 1 màn hình. */
    private List<StatisticsDto.CategoryRevenue> computeRevenueByCategory(
            List<Order> soldOrders, Set<Integer> categoryIds, Integer brandId) {
        Map<String, Long> qtyByCategory = new HashMap<>();
        Map<String, BigDecimal> revenueByCategory = new HashMap<>();
        for (Order o : soldOrders) {
            for (OrderItem item : o.getItems()) {
                if (item.getVariant() == null || item.getVariant().getProduct() == null
                        || item.getVariant().getProduct().getCategory() == null) continue;
                if (!itemMatchesFilters(item, categoryIds, brandId)) continue;
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
            List<Order> completed, Set<Integer> categoryIds, Integer brandId) {
        Map<Order.PaymentMethod, Long> countByMethod = new EnumMap<>(Order.PaymentMethod.class);
        Map<Order.PaymentMethod, BigDecimal> revenueByMethod = new EnumMap<>(Order.PaymentMethod.class);
        for (Order o : completed) {
            if (o.getPaymentMethod() == null) continue;
            countByMethod.merge(o.getPaymentMethod(), 1L, Long::sum);
            revenueByMethod.merge(o.getPaymentMethod(), orderRevenue(o, categoryIds, brandId), BigDecimal::add);
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

    /** Không phụ thuộc khoảng ngày đang xem -- luôn là tình trạng tồn kho HIỆN TẠI, không phải lịch sử.
     *  Chỉ tính sản phẩm CÒN kinh doanh: đây là cảnh báo để đi nhập thêm hàng, sản phẩm đã ẩn/ngừng bán mà
     *  tồn kho gần 0 sẽ chiếm chỗ vĩnh viễn trong top 10 (do sắp xếp tồn kho tăng dần) và đẩy đúng những
     *  mẫu đang bán thật sự sắp hết ra khỏi danh sách. */
    private List<StatisticsDto.LowStockItem> computeLowStockVariants() {
        List<ProductVariant> variants = productVariantRepository
                .findTop10ByProduct_StatusAndStockQuantityLessThanEqualOrderByStockQuantityAsc(
                        Product.Status.ACTIVE, LOW_STOCK_THRESHOLD);
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
     * true nếu đơn thật sự có dòng tiền đứng sau nó.
     *
     * MỘT quy tắc cho mọi phương thức: paymentStatus khác UNPAID -- PAID (đã xác nhận thu được tiền)
     * hoặc REFUNDED (đơn TỪNG thu được tiền thật, sau đó mới hoàn -- vẫn phải tính, chỉ loại đúng
     * trường hợp CHƯA từng ai xác nhận có tiền về).
     *
     * Trước đây phải mở ngoại lệ "COD thì luôn tính" vì hệ thống không có bước xác nhận đã thu tiền mặt
     * nên đơn COD giữ UNPAID vĩnh viễn -- lọc theo paymentStatus sẽ xoá nhầm gần hết doanh thu COD hợp
     * lệ. Nay admin xác nhận tay được (AdminOrderService.confirmPayment) và LegacyDataFixer đã lấp cho
     * đơn COD cũ, nên ngoại lệ đó không còn cần -- và bỏ nó đi thì đơn COD giao hỏng, chưa thu được
     * đồng nào, không còn bị tính vào doanh thu nữa.
     */
    private boolean isRealizedRevenue(Order order) {
        return order.getPaymentStatus() != Order.PaymentStatus.UNPAID;
    }

    /**
     * 1 DÒNG hàng có khớp bộ lọc danh mục/thương hiệu đang chọn hay không -- nguồn xác định DUY NHẤT cho cả
     * việc lọc đơn, tính doanh thu, gộp theo danh mục lẫn bảng bán chạy, để 4 chỗ này không bao giờ hiểu
     * "khớp bộ lọc" theo 2 nghĩa khác nhau. Bộ lọc để trống = không ràng buộc chiều đó.
     */
    private boolean itemMatchesFilters(OrderItem item, Set<Integer> categoryIds, Integer brandId) {
        if (item.getVariant() == null || item.getVariant().getProduct() == null) return false;
        var product = item.getVariant().getProduct();
        if (categoryIds != null && (product.getCategory() == null
                || !categoryIds.contains(product.getCategory().getCategoryId()))) {
            return false;
        }
        return brandId == null || (product.getBrand() != null
                && brandId.equals(product.getBrand().getBrandId()));
    }

    /** Khoá gộp bảng "bán chạy": ưu tiên productId, chỉ fallback về tên khi dòng hàng không còn variant. */
    private String productKey(OrderItem item) {
        if (item.getVariant() != null && item.getVariant().getProduct() != null) {
            return "P" + item.getVariant().getProduct().getProductId();
        }
        return "N" + item.getProductName();
    }

    /**
     * Doanh thu của 1 đơn -- không lọc gì thì lấy nguyên totalAmount (đã gồm shipping fee, trừ discount)
     * như trước giờ. Có lọc danh mục và/hoặc thương hiệu thì CHỈ cộng subtotal của đúng các dòng khớp điều
     * kiện, không phải nguyên totalAmount của cả đơn -- bộ lọc chỉ yêu cầu đơn có >=1 sản phẩm khớp, 1 đơn
     * mua lẫn nhiều danh mục/thương hiệu khác nhau (vd áo 100k + quần 900k) nếu cộng nguyên totalAmount sẽ
     * thổi phồng doanh thu bị lọc lên gấp nhiều lần giá trị thật, và shipping fee/giảm giá cấp đơn cũng bị
     * tính lẫn vào doanh thu 1 danh mục/thương hiệu cụ thể một cách vô lý.
     */
    private BigDecimal orderRevenue(Order order, Set<Integer> categoryIds, Integer brandId) {
        if (categoryIds == null && brandId == null) {
            return order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        }
        return order.getItems().stream()
                .filter(i -> itemMatchesFilters(i, categoryIds, brandId))
                .map(OrderItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumTotal(List<Order> orders, Set<Integer> categoryIds, Integer brandId) {
        return orders.stream().map(o -> orderRevenue(o, categoryIds, brandId)).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}