package com.datn.service;

import com.datn.dto.statistics.StatisticsDto;
import com.datn.entity.Brand;
import com.datn.entity.Category;
import com.datn.entity.Order;
import com.datn.entity.OrderItem;
import com.datn.entity.ProductVariant;
import com.datn.exception.ApiException;
import com.datn.repository.CategoryRepository;
import com.datn.repository.OrderRepository;
import com.datn.repository.ProductVariantRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

/**
 * Trang Thống kê là nơi đã sai nhiều lần nhất của dự án, và mỗi lần sai đều là sai TIỀN. Mỗi test dưới
 * đây khoá lại đúng một lỗi đã từng xảy ra thật, để không tái phạm.
 *
 * Không cần Spring context cũng không cần cơ sở dữ liệu: AdminStatisticsService chỉ chạm repository ở 3
 * chỗ (findForStatistics, categoryRepository.findAll, findTop10ByProduct_Status...), toàn bộ phần tính
 * tiền là hàm thuần trên danh sách Order trong bộ nhớ.
 *
 * LƯU Ý cho người viết thêm test ở lớp này: findForStatistics được gọi HAI lần cho mỗi lượt getStatistics
 * (kỳ hiện tại + kỳ liền trước để so sánh), nên phải stub bằng any() -- stub theo tham số cụ thể sẽ khiến
 * lần gọi thứ hai trả null và service ném NullPointerException.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT) // findTop10/findAll không phải ca nào cũng gọi tới
class AdminStatisticsServiceTest {

    @Mock
    OrderRepository orderRepository;
    @Mock
    ProductVariantRepository productVariantRepository;
    @Mock
    CategoryRepository categoryRepository;
    @InjectMocks
    AdminStatisticsService service;

    private static final LocalDate FROM = LocalDate.of(2026, 9, 1);
    private static final LocalDate TO = LocalDate.of(2026, 9, 30);

    private void givenOrders(List<Order> orders) {
        when(orderRepository.findForStatistics(any(), any(), any(), any())).thenReturn(orders);
        when(productVariantRepository
                .findTop10ByProduct_StatusAndStockQuantityLessThanEqualOrderByStockQuantityAsc(any(), anyInt()))
                .thenReturn(List.of());
    }

    private StatisticsDto.StatisticsResponse statistics(Integer categoryId, Integer brandId) {
        return service.getStatistics(FROM, TO, 5, categoryId, brandId, null, null);
    }

    // ----- Lỗi #5a: hoá đơn POS chuyển khoản chưa thu tiền vẫn bị tính là doanh thu -----

    @Test
    @DisplayName("Hoá đơn chuyển khoản chưa xác nhận nhận tiền KHÔNG được tính vào doanh thu")
    void khongTinhDoanhThuHoaDonChuyenKhoanChuaThuTien() {
        Order cod = StatsFixtures.order(LocalDateTime.of(2026, 9, 5, 9, 0), 100_000L);

        Order ckChuaThu = StatsFixtures.order(LocalDateTime.of(2026, 9, 6, 9, 0), 500_000L);
        ckChuaThu.setPaymentMethod(Order.PaymentMethod.BANK_TRANSFER);
        ckChuaThu.setPaymentStatus(Order.PaymentStatus.UNPAID);

        Order ckDaThu = StatsFixtures.order(LocalDateTime.of(2026, 9, 7, 9, 0), 200_000L);
        ckDaThu.setPaymentMethod(Order.PaymentMethod.BANK_TRANSFER);
        ckDaThu.setPaymentStatus(Order.PaymentStatus.PAID);

        givenOrders(List.of(cod, ckChuaThu, ckDaThu));

        var summary = statistics(null, null).getSummary();

        assertThat(summary.getTotalRevenue())
                .as("Chỉ COD (100k) + chuyển khoản ĐÃ xác nhận (200k) mới là tiền thật")
                .isEqualByComparingTo("300000");
        assertThat(summary.getTotalOrders())
                .as("Hoá đơn chuyển khoản chưa thu tiền cũng không được tính là đơn đã bán")
                .isEqualTo(2);
    }

    // ----- Lỗi #5b: lọc theo danh mục cộng cả tổng đơn thay vì cộng dòng hàng khớp -----

    @Test
    @DisplayName("Lọc danh mục chỉ cộng DÒNG HÀNG khớp, không cộng tổng cả đơn")
    void locDanhMucChiCongDongHangKhop() {
        Category ao = StatsFixtures.cat(1, "Áo", null);
        Category quan = StatsFixtures.cat(2, "Quần", null);

        Order don = StatsFixtures.order(LocalDateTime.of(2026, 9, 10, 10, 0), 1_000_000L,
                StatsFixtures.item(StatsFixtures.variant(1, "Áo thun", ao, null), 1, 100_000L),
                StatsFixtures.item(StatsFixtures.variant(2, "Quần jean", quan, null), 1, 900_000L));

        givenOrders(List.of(don));
        when(categoryRepository.findAll()).thenReturn(List.of(ao, quan));

        assertThat(statistics(1, null).getSummary().getTotalRevenue())
                .as("Lọc danh mục Áo phải ra 100k (đúng dòng áo), không phải 1.000k (tổng cả đơn)")
                .isEqualByComparingTo("100000");
    }

    @Test
    @DisplayName("Lọc thương hiệu cũng chỉ cộng dòng hàng khớp")
    void locThuongHieuChiCongDongHangKhop() {
        Brand nova = StatsFixtures.brand(7, "Nova");
        Brand khac = StatsFixtures.brand(8, "Khác");
        Category ao = StatsFixtures.cat(1, "Áo", null);

        Order don = StatsFixtures.order(LocalDateTime.of(2026, 9, 11, 10, 0), 800_000L,
                StatsFixtures.item(StatsFixtures.variant(1, "Áo Nova", ao, nova), 1, 300_000L),
                StatsFixtures.item(StatsFixtures.variant(2, "Áo khác", ao, khac), 1, 500_000L));

        givenOrders(List.of(don));

        assertThat(statistics(null, 7).getSummary().getTotalRevenue())
                .isEqualByComparingTo("300000");
    }

    // ----- Lỗi #5c: đơn trả hàng bị tính theo ngày tạo đơn thay vì ngày hoàn -----

    @Test
    @DisplayName("Doanh thu vào ngày BÁN, khoản hoàn vào ngày HOÀN -- hai sự kiện khác ngày")
    void hoanTraGhiNhanTheoNgayHoan() {
        Order don = StatsFixtures.order(LocalDateTime.of(2026, 9, 2, 8, 0), 400_000L);
        don.setStatus(Order.Status.RETURNED);
        don.setReturnedAt(LocalDateTime.of(2026, 9, 20, 15, 0));

        givenOrders(List.of(don));

        List<StatisticsDto.RevenuePoint> theoNgay = statistics(null, null).getRevenueByDay();
        var ngayBan = theoNgay.stream().filter(p -> p.getDate().equals(LocalDate.of(2026, 9, 2))).findFirst().orElseThrow();
        var ngayHoan = theoNgay.stream().filter(p -> p.getDate().equals(LocalDate.of(2026, 9, 20))).findFirst().orElseThrow();

        assertThat(ngayBan.getRevenue()).as("Ngày bán 02/09 phải ghi nhận doanh thu").isEqualByComparingTo("400000");
        assertThat(ngayBan.getReturnedRevenue()).as("Ngày bán KHÔNG được có khoản hoàn").isEqualByComparingTo("0");
        assertThat(ngayHoan.getReturnedRevenue()).as("Ngày hoàn 20/09 mới là ngày phát sinh khoản hoàn").isEqualByComparingTo("400000");
        assertThat(ngayHoan.getRevenue()).as("Ngày hoàn KHÔNG được ghi thêm doanh thu bán").isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("Đơn RETURNED cũ chưa có returnedAt thì lùi về ngày tạo, không văng lỗi")
    void donCuKhongCoReturnedAtVanTinhDuoc() {
        Order don = StatsFixtures.order(LocalDateTime.of(2026, 9, 3, 8, 0), 150_000L);
        don.setStatus(Order.Status.RETURNED);
        don.setReturnedAt(null);

        givenOrders(List.of(don));

        var diem = statistics(null, null).getRevenueByDay().stream()
                .filter(p -> p.getDate().equals(LocalDate.of(2026, 9, 3))).findFirst().orElseThrow();
        assertThat(diem.getReturnedRevenue()).isEqualByComparingTo("150000");
    }

    // ----- Bất biến kế toán: mua rồi trả trong cùng kỳ phải triệt tiêu về 0 -----

    @Test
    @DisplayName("Mua rồi trả trong cùng kỳ: doanh thu thuần về 0 và KHÔNG âm")
    void muaRoiTraTrietTieuVeKhong() {
        Order don = StatsFixtures.order(LocalDateTime.of(2026, 9, 4, 8, 0), 250_000L);
        don.setStatus(Order.Status.RETURNED);
        don.setReturnedAt(LocalDateTime.of(2026, 9, 8, 8, 0));

        givenOrders(List.of(don));
        var s = statistics(null, null).getSummary();

        assertThat(s.getTotalRevenue()).as("Doanh thu thuần").isEqualByComparingTo("0");
        assertThat(s.getCompletedRevenue()).as("Doanh thu gộp vẫn ghi nhận giao dịch bán đã xảy ra")
                .isEqualByComparingTo("250000");
        assertThat(s.getReturnedRevenue()).isEqualByComparingTo("250000");
        assertThat(s.getTotalRevenue().signum()).as("Không bao giờ được âm").isNotNegative();
    }

    @Test
    @DisplayName("Đơn đang chờ duyệt trả hàng vẫn tính doanh thu (tiền còn ở shop)")
    void donChoDuyetTraHangVanTinhDoanhThu() {
        Order don = StatsFixtures.order(LocalDateTime.of(2026, 9, 9, 8, 0), 320_000L);
        don.setStatus(Order.Status.RETURN_REQUESTED);

        givenOrders(List.of(don));
        var s = statistics(null, null).getSummary();

        assertThat(s.getTotalRevenue())
                .as("Doanh thu không được tụt ngay lúc khách bấm yêu cầu trả hàng")
                .isEqualByComparingTo("320000");
        assertThat(s.getReturnedRevenue()).as("Chưa duyệt thì chưa có khoản hoàn nào").isEqualByComparingTo("0");
    }

    // ----- Danh mục cha gộp con-cháu -----

    @Test
    @DisplayName("Chọn danh mục CHA gộp doanh thu của toàn bộ con và cháu")
    void danhMucChaGopConChau() {
        Category ao = StatsFixtures.cat(1, "Áo", null);
        Category aoThun = StatsFixtures.cat(2, "Áo thun", ao);
        Category aoPolo = StatsFixtures.cat(3, "Áo polo", aoThun); // cháu, để kiểm cây nhiều tầng
        Category quan = StatsFixtures.cat(4, "Quần", null);

        Order don = StatsFixtures.order(LocalDateTime.of(2026, 9, 12, 8, 0), 600_000L,
                StatsFixtures.item(StatsFixtures.variant(1, "Áo thun A", aoThun, null), 1, 100_000L),
                StatsFixtures.item(StatsFixtures.variant(2, "Áo polo B", aoPolo, null), 1, 200_000L),
                StatsFixtures.item(StatsFixtures.variant(3, "Quần C", quan, null), 1, 300_000L));

        givenOrders(List.of(don));
        when(categoryRepository.findAll()).thenReturn(List.of(ao, aoThun, aoPolo, quan));

        assertThat(statistics(1, null).getSummary().getTotalRevenue())
                .as("Áo (cha) = Áo thun 100k + Áo polo 200k, không gồm Quần")
                .isEqualByComparingTo("300000");
    }

    @Test
    @DisplayName("Dữ liệu danh mục bị vòng cha-con thì không treo vô hạn")
    void cayDanhMucBiVongThiKhongTreo() {
        Category a = StatsFixtures.cat(1, "A", null);
        Category b = StatsFixtures.cat(2, "B", a);
        a.setParent(b); // vòng: A -> B -> A

        Order don = StatsFixtures.order(LocalDateTime.of(2026, 9, 13, 8, 0), 100_000L,
                StatsFixtures.item(StatsFixtures.variant(1, "SP", a, null), 1, 100_000L));

        givenOrders(List.of(don));
        when(categoryRepository.findAll()).thenReturn(List.of(a, b));

        assertThat(statistics(1, null).getSummary().getTotalRevenue()).isEqualByComparingTo("100000");
    }

    // ----- Ràng buộc đầu vào -----

    @Test
    @DisplayName("Từ ngày sau Đến ngày thì báo lỗi rõ ràng, không trả kỳ rỗng")
    void tuNgaySauDenNgayThiBaoLoi() {
        assertThatThrownBy(() -> service.getStatistics(TO, FROM, 5, null, null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Từ ngày");
    }

    // ----- Đơn huỷ không phải doanh thu -----

    @Test
    @DisplayName("Đơn đã huỷ không tính doanh thu nhưng vẫn được đếm riêng")
    void donHuyKhongTinhDoanhThu() {
        Order huy = StatsFixtures.order(LocalDateTime.of(2026, 9, 14, 8, 0), 900_000L);
        huy.setStatus(Order.Status.CANCELLED);
        Order ban = StatsFixtures.order(LocalDateTime.of(2026, 9, 14, 9, 0), 100_000L);

        givenOrders(List.of(huy, ban));
        var s = statistics(null, null).getSummary();

        assertThat(s.getTotalRevenue()).isEqualByComparingTo("100000");
        assertThat(s.getCancelledOrders()).isEqualTo(1);
        assertThat(s.getTotalOrders()).isEqualTo(1);
    }

    // ----- Dòng hàng không còn variant (sản phẩm đã bị xoá) không được làm vỡ thống kê -----

    @Test
    @DisplayName("Dòng hàng mất variant không làm vỡ bộ lọc danh mục")
    void dongHangMatVariantKhongLamVoLoc() {
        Category ao = StatsFixtures.cat(1, "Áo", null);
        OrderItem mocCoi = new OrderItem();
        mocCoi.setProductName("Sản phẩm đã xoá");
        mocCoi.setQuantity(1);
        mocCoi.setSubtotal(java.math.BigDecimal.valueOf(50_000L));

        ProductVariant v = StatsFixtures.variant(1, "Áo thun", ao, null);
        Order don = StatsFixtures.order(LocalDateTime.of(2026, 9, 15, 8, 0), 150_000L,
                StatsFixtures.item(v, 1, 100_000L));
        don.getItems().add(mocCoi);
        mocCoi.setOrder(don);

        givenOrders(List.of(don));
        when(categoryRepository.findAll()).thenReturn(List.of(ao));

        assertThat(statistics(1, null).getSummary().getTotalRevenue())
                .as("Chỉ cộng dòng còn variant và khớp danh mục")
                .isEqualByComparingTo("100000");
    }
}
