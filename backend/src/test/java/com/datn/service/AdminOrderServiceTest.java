package com.datn.service;

import com.datn.entity.Order;
import com.datn.entity.ProductVariant;
import com.datn.exception.ApiException;
import com.datn.repository.OrderRepository;
import com.datn.repository.ProductVariantRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Máy trạng thái đơn hàng + cơ chế trừ/hoàn kho đi kèm. Đây là luồng nghiệp vụ trung tâm của hệ thống:
 * chuyển sai một mũi tên là hoặc bán vượt kho, hoặc kho phình khống, hoặc tiền không khớp sổ.
 *
 * Test thuần Mockito, không cơ sở dữ liệu. Cần nói rõ giới hạn: các test này chứng minh LOGIC quyết định
 * (chuyển trạng thái nào hợp lệ, khi nào trừ/hoàn kho, khi nào đánh dấu REFUNDED) là đúng. Chúng KHÔNG
 * chứng minh khoá bi quan findByIdForUpdate thật sự khoá được row -- đó là hành vi của SQL Server, xem
 * kịch bản kiểm thử tay ĐT-01/ĐT-02 và thí nghiệm bắn request song song.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminOrderServiceTest {

    @Mock
    OrderRepository orderRepository;
    @Mock
    ProductVariantRepository variantRepository;
    @Mock
    VoucherService voucherService;
    @InjectMocks
    AdminOrderService service;

    /** Đơn ONLINE 1 dòng hàng, số lượng 2, gắn sẵn variant có tồn kho `stock`. */
    private Order donOnline(Order.Status status, int stock) {
        ProductVariant v = StatsFixtures.variant(1, "Áo thun", null, null);
        v.setStockQuantity(stock);
        Order o = StatsFixtures.order(LocalDateTime.of(2026, 9, 1, 8, 0), 200_000L,
                StatsFixtures.item(v, 2, 100_000L));
        o.setOrderId(1L);
        o.setStatus(status);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(o));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(variantRepository.findByIdForUpdate(anyLong())).thenReturn(Optional.of(v));
        return o;
    }

    private ProductVariant variantCua(Order o) {
        return o.getItems().get(0).getVariant();
    }

    // ----- Sơ đồ trạng thái -----

    @ParameterizedTest(name = "{0} -> {1} phải bị chặn")
    @CsvSource({
            "COMPLETED,   SHIPPING",
            "COMPLETED,   CANCELLED",
            "DELIVERED,   CANCELLED",
            "PENDING,     SHIPPING",     // nhảy cóc, bỏ qua bước xác nhận
            "SHIPPING,    PENDING",      // đi ngược
            "CANCELLED,   CONFIRMED",    // hồi sinh đơn đã huỷ
            "RETURNED,    COMPLETED",    // RETURNED là điểm cuối
    })
    @DisplayName("Chuyển trạng thái không hợp lệ bị chặn kèm thông báo nêu rõ 2 trạng thái")
    void chanChuyenTrangThaiKhongHopLe(Order.Status tu, Order.Status den) {
        donOnline(tu, 10);

        assertThatThrownBy(() -> service.updateStatus(1L, den))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining(tu.name())
                .hasMessageContaining(den.name());
    }

    @ParameterizedTest(name = "{0} -> {1} phải đi qua được")
    @CsvSource({
            "PENDING,          CONFIRMED",
            "PENDING,          CANCELLED",
            "CONFIRMED,        SHIPPING",
            "SHIPPING,         DELIVERED",
            "DELIVERED,        COMPLETED",
            "RETURN_REQUESTED, RETURNED",
            "RETURN_REQUESTED, COMPLETED", // admin từ chối yêu cầu trả hàng
    })
    @DisplayName("Các bước hợp lệ trong sơ đồ đều đi qua được")
    void chuyenTrangThaiHopLe(Order.Status tu, Order.Status den) {
        Order o = donOnline(tu, 10);

        service.updateStatus(1L, den);

        assertThat(o.getStatus()).isEqualTo(den);
    }

    // ----- Trừ kho khi xác nhận đơn -----

    @Test
    @DisplayName("PENDING -> CONFIRMED trừ kho đúng số lượng, đúng một lần")
    void xacNhanDonTruKhoDungSoLuong() {
        Order o = donOnline(Order.Status.PENDING, 10);

        service.updateStatus(1L, Order.Status.CONFIRMED);

        assertThat(variantCua(o).getStockQuantity()).as("10 - 2").isEqualTo(8);
    }

    @Test
    @DisplayName("Kho không đủ thì chặn xác nhận và KHÔNG đụng vào tồn kho")
    void khoKhongDuThiChanXacNhan() {
        Order o = donOnline(Order.Status.PENDING, 1); // đơn cần 2

        assertThatThrownBy(() -> service.updateStatus(1L, Order.Status.CONFIRMED))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chỉ còn 1");

        assertThat(variantCua(o).getStockQuantity()).as("Tồn kho phải nguyên vẹn").isEqualTo(1);
        assertThat(o.getStatus()).as("Đơn không được đổi trạng thái").isEqualTo(Order.Status.PENDING);
    }

    @Test
    @DisplayName("Đơn chuyển khoản chưa thanh toán thì không xác nhận được, kho không bị trừ")
    void donChuyenKhoanChuaThanhToanThiKhongXacNhanDuoc() {
        Order o = donOnline(Order.Status.PENDING, 10);
        o.setPaymentMethod(Order.PaymentMethod.BANK_TRANSFER);
        o.setPaymentStatus(Order.PaymentStatus.UNPAID);

        assertThatThrownBy(() -> service.updateStatus(1L, Order.Status.CONFIRMED))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chưa được xác nhận thanh toán");

        assertThat(variantCua(o).getStockQuantity()).isEqualTo(10);
    }

    @Test
    @DisplayName("Đơn COD vẫn xác nhận được dù chưa thanh toán (trả tiền khi nhận hàng)")
    void donCodVanXacNhanDuocKhiChuaThanhToan() {
        Order o = donOnline(Order.Status.PENDING, 10);
        o.setPaymentMethod(Order.PaymentMethod.COD);
        o.setPaymentStatus(Order.PaymentStatus.UNPAID);

        service.updateStatus(1L, Order.Status.CONFIRMED);

        assertThat(o.getStatus()).isEqualTo(Order.Status.CONFIRMED);
        assertThat(variantCua(o).getStockQuantity()).isEqualTo(8);
    }

    // ----- Hoàn kho -----

    @Test
    @DisplayName("Huỷ đơn từ PENDING KHÔNG hoàn kho (chưa từng bị trừ)")
    void huyDonTuPendingKhongHoanKho() {
        Order o = donOnline(Order.Status.PENDING, 10);

        service.updateStatus(1L, Order.Status.CANCELLED);

        assertThat(variantCua(o).getStockQuantity())
                .as("Hoàn kho ở đây sẽ tạo ra 2 sản phẩm không tồn tại")
                .isEqualTo(10);
        verify(variantRepository, never()).save(any());
    }

    @Test
    @DisplayName("Huỷ đơn từ CONFIRMED hoàn lại đúng số đã trừ")
    void huyDonTuConfirmedHoanKho() {
        Order o = donOnline(Order.Status.CONFIRMED, 8);

        service.updateStatus(1L, Order.Status.CANCELLED);

        assertThat(variantCua(o).getStockQuantity()).as("8 + 2").isEqualTo(10);
    }

    @Test
    @DisplayName("Duyệt trả hàng: hoàn kho, ghi returnedAt, đơn PAID chuyển thành REFUNDED")
    void duyetTraHangHoanKhoVaGhiNhanHoanTien() {
        Order o = donOnline(Order.Status.RETURN_REQUESTED, 8);
        o.setPaymentStatus(Order.PaymentStatus.PAID);

        service.updateStatus(1L, Order.Status.RETURNED);

        assertThat(o.getStatus()).isEqualTo(Order.Status.RETURNED);
        assertThat(variantCua(o).getStockQuantity()).isEqualTo(10);
        assertThat(o.getPaymentStatus()).isEqualTo(Order.PaymentStatus.REFUNDED);
        assertThat(o.getReturnedAt())
                .as("Thống kê hoàn trả nhóm theo cột này, thiếu nó thì khoản hoàn rơi nhầm về ngày tạo đơn")
                .isNotNull();
    }

    @Test
    @DisplayName("Đơn chưa từng thanh toán thì trả hàng không bị đánh dấu REFUNDED")
    void donChuaThanhToanThiKhongDanhDauHoanTien() {
        Order o = donOnline(Order.Status.RETURN_REQUESTED, 8);
        o.setPaymentStatus(Order.PaymentStatus.UNPAID);

        service.updateStatus(1L, Order.Status.RETURNED);

        assertThat(o.getPaymentStatus())
                .as("Không có tiền nào để hoàn thì không được ghi là đã hoàn tiền")
                .isEqualTo(Order.PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("Từ chối yêu cầu trả hàng: về lại COMPLETED, không hoàn kho, không ghi returnedAt")
    void tuChoiTraHangThiKhongHoanKho() {
        Order o = donOnline(Order.Status.RETURN_REQUESTED, 8);

        service.updateStatus(1L, Order.Status.COMPLETED);

        assertThat(o.getStatus()).isEqualTo(Order.Status.COMPLETED);
        assertThat(variantCua(o).getStockQuantity()).isEqualTo(8);
        assertThat(o.getReturnedAt()).isNull();
    }

    // ----- Mã giảm giá -----

    @Test
    @DisplayName("Huỷ/trả đơn có mã giảm giá thì trả lại lượt dùng cho khách")
    void huyDonCoVoucherThiTraLaiLuotDung() {
        Order o = donOnline(Order.Status.CONFIRMED, 8);
        o.setVoucherCode("SALE50");

        service.updateStatus(1L, Order.Status.CANCELLED);

        verify(voucherService).revertVoucherUsage("SALE50");
    }

    @Test
    @DisplayName("Đơn không có mã giảm giá thì không gọi hoàn lượt dùng")
    void donKhongCoVoucherThiKhongGoiHoanLuot() {
        donOnline(Order.Status.CONFIRMED, 8);

        service.updateStatus(1L, Order.Status.CANCELLED);

        verify(voucherService, never()).revertVoucherUsage(any());
    }

    // ----- Đơn POS không đi qua màn quản lý đơn online -----

    @Test
    @DisplayName("Đơn POS bị từ chối ở màn Quản lý đơn hàng (luồng riêng, tránh trừ kho lần 2)")
    void donPosBiTuChoiOManQuanLyDonHang() {
        Order o = donOnline(Order.Status.PENDING, 10);
        o.setOrderType(Order.OrderType.POS);

        assertThatThrownBy(() -> service.updateStatus(1L, Order.Status.CONFIRMED))
                .isInstanceOf(ApiException.class);

        assertThat(variantCua(o).getStockQuantity()).isEqualTo(10);
    }
}
