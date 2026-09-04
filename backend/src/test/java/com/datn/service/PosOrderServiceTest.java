package com.datn.service;

import com.datn.dto.pos.PosDto;
import com.datn.entity.Order;
import com.datn.entity.Product;
import com.datn.entity.ProductVariant;
import com.datn.exception.ApiException;
import com.datn.repository.OrderItemRepository;
import com.datn.repository.OrderRepository;
import com.datn.repository.ProductImageRepository;
import com.datn.repository.ProductVariantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Bán hàng tại quầy. Khác đơn online ở chỗ trừ kho NGAY lúc thêm hàng vào hoá đơn, nên mọi lỗi ở đây
 * đều tác động thẳng vào tồn kho thật.
 *
 * Hai lỗi đã xảy ra thật được khoá lại tại đây: bán được sản phẩm đã ngừng kinh doanh, và hoá đơn
 * chuyển khoản tự nhảy sang "đã thanh toán" khi chưa ai kiểm tra tiền về.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PosOrderServiceTest {

    @Mock
    OrderRepository orderRepository;
    @Mock
    OrderItemRepository orderItemRepository;
    @Mock
    ProductVariantRepository variantRepository;
    @Mock
    ProductImageRepository productImageRepository;
    @Mock
    VoucherService voucherService;
    @InjectMocks
    PosOrderService service;

    private Order hoaDon;
    private ProductVariant bienThe;

    @BeforeEach
    void setUp() {
        bienThe = StatsFixtures.variant(1, "Áo thun", null, null);
        bienThe.setStockQuantity(10);

        hoaDon = new Order();
        hoaDon.setOrderId(1L);
        hoaDon.setOrderType(Order.OrderType.POS);
        hoaDon.setStatus(Order.Status.PENDING);
        hoaDon.setCreatedAt(LocalDateTime.now());
        hoaDon.setItems(new java.util.ArrayList<>());
        hoaDon.setSubtotalAmount(java.math.BigDecimal.ZERO);
        hoaDon.setDiscountAmount(java.math.BigDecimal.ZERO);
        hoaDon.setTotalAmount(java.math.BigDecimal.ZERO);

        when(orderRepository.findByOrderIdAndOrderType(1L, Order.OrderType.POS)).thenReturn(Optional.of(hoaDon));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(variantRepository.findByIdForUpdate(anyLong())).thenReturn(Optional.of(bienThe));
        when(productImageRepository.findByProduct_ProductIdInOrderByDisplayOrderAsc(any())).thenReturn(List.of());
    }

    private PosDto.AddItemRequest themHang(int soLuong) {
        PosDto.AddItemRequest r = new PosDto.AddItemRequest();
        r.setVariantId(bienThe.getVariantId());
        r.setQuantity(soLuong);
        return r;
    }

    private PosDto.CheckoutRequest thanhToan(Order.PaymentMethod phuongThuc) {
        PosDto.CheckoutRequest r = new PosDto.CheckoutRequest();
        r.setPaymentMethod(phuongThuc);
        r.setCustomerName("Khách lẻ");
        return r;
    }

    // ----- Sản phẩm đã ngừng kinh doanh -----

    @Test
    @DisplayName("Không bán được sản phẩm đã ẩn tại quầy (khách online đã bị chặn, quầy phải chặn theo)")
    void khongBanDuocSanPhamDaAn() {
        bienThe.getProduct().setStatus(Product.Status.INACTIVE);

        assertThatThrownBy(() -> service.addItem(1L, themHang(1)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ngừng kinh doanh");

        assertThat(bienThe.getStockQuantity()).as("Tồn kho không được đụng tới").isEqualTo(10);
        assertThat(hoaDon.getItems()).isEmpty();
    }

    // ----- Trừ kho -----

    @Test
    @DisplayName("Thêm hàng vào hoá đơn trừ kho NGAY, không đợi tới lúc thanh toán")
    void themHangTruKhoNgay() {
        service.addItem(1L, themHang(3));

        assertThat(bienThe.getStockQuantity()).isEqualTo(7);
        assertThat(hoaDon.getItems()).hasSize(1);
    }

    @Test
    @DisplayName("Thêm quá tồn kho bị chặn, kho giữ nguyên")
    void themQuaTonKhoBiChan() {
        bienThe.setStockQuantity(3);

        assertThatThrownBy(() -> service.addItem(1L, themHang(5)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chỉ còn 3");

        assertThat(bienThe.getStockQuantity()).isEqualTo(3);
        assertThat(hoaDon.getItems()).isEmpty();
    }

    @Test
    @DisplayName("Thêm cùng một phân loại 2 lần thì cộng dồn dòng hàng, không tạo dòng thứ hai")
    void themTrungPhanLoaiThiCongDon() {
        service.addItem(1L, themHang(2));
        service.addItem(1L, themHang(3));

        assertThat(hoaDon.getItems()).hasSize(1);
        assertThat(hoaDon.getItems().get(0).getQuantity()).isEqualTo(5);
        assertThat(bienThe.getStockQuantity()).isEqualTo(5);
    }

    // ----- Thanh toán -----

    @Test
    @DisplayName("Tiền mặt: hoá đơn hoàn tất và ghi nhận ĐÃ thanh toán")
    void tienMatThiDanhDauDaThanhToan() {
        service.addItem(1L, themHang(1));

        service.checkout(1L, thanhToan(Order.PaymentMethod.COD));

        assertThat(hoaDon.getStatus()).isEqualTo(Order.Status.COMPLETED);
        assertThat(hoaDon.getPaymentStatus()).isEqualTo(Order.PaymentStatus.PAID);
    }

    @Test
    @DisplayName("Chuyển khoản: hoàn tất nhưng VẪN chưa thanh toán cho tới khi thu ngân xác nhận")
    void chuyenKhoanThiVanChuaThanhToan() {
        service.addItem(1L, themHang(1));

        service.checkout(1L, thanhToan(Order.PaymentMethod.BANK_TRANSFER));

        assertThat(hoaDon.getStatus()).isEqualTo(Order.Status.COMPLETED);
        assertThat(hoaDon.getPaymentStatus())
                .as("Đây chính là hoá đơn mà thống kê phải LOẠI khỏi doanh thu cho tới khi xác nhận tiền về")
                .isEqualTo(Order.PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("VNPay không dùng được tại quầy (không có cổng nào chạy, sẽ thành PAID khống)")
    void vnpayKhongDungDuocTaiQuay() {
        service.addItem(1L, themHang(1));

        assertThatThrownBy(() -> service.checkout(1L, thanhToan(Order.PaymentMethod.VNPAY)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Tiền mặt hoặc Chuyển khoản");

        assertThat(hoaDon.getStatus()).isEqualTo(Order.Status.PENDING);
    }

    @Test
    @DisplayName("Hoá đơn rỗng không thanh toán được")
    void hoaDonRongKhongThanhToanDuoc() {
        assertThatThrownBy(() -> service.checkout(1L, thanhToan(Order.PaymentMethod.COD)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chưa có sản phẩm");
    }

    @Test
    @DisplayName("Hoá đơn đã thanh toán thì không thêm hàng được nữa")
    void hoaDonDaThanhToanThiKhoaLai() {
        hoaDon.setStatus(Order.Status.COMPLETED);

        assertThatThrownBy(() -> service.addItem(1L, themHang(1)))
                .isInstanceOf(ApiException.class);

        assertThat(bienThe.getStockQuantity()).isEqualTo(10);
    }

    // ----- Huỷ / hoàn -----

    @Test
    @DisplayName("Huỷ hoá đơn đang tạo dở thì hoàn lại đúng số đã trừ")
    void huyHoaDonDangTaoThiHoanKho() {
        service.addItem(1L, themHang(4));
        assertThat(bienThe.getStockQuantity()).isEqualTo(6);

        service.cancelInvoice(1L);

        assertThat(hoaDon.getStatus()).isEqualTo(Order.Status.CANCELLED);
        assertThat(bienThe.getStockQuantity()).isEqualTo(10);
    }

    @Test
    @DisplayName("Hoàn hoá đơn đã thanh toán: hoàn kho, ghi returnedAt, đánh dấu đã hoàn tiền")
    void hoanHoaDonDaThanhToan() {
        service.addItem(1L, themHang(2));
        service.checkout(1L, thanhToan(Order.PaymentMethod.COD));

        service.voidCompletedInvoice(1L);

        assertThat(hoaDon.getStatus()).isEqualTo(Order.Status.RETURNED);
        assertThat(hoaDon.getPaymentStatus()).isEqualTo(Order.PaymentStatus.REFUNDED);
        assertThat(hoaDon.getReturnedAt()).isNotNull();
        assertThat(bienThe.getStockQuantity()).isEqualTo(10);
    }

    @Test
    @DisplayName("Hoàn hoá đơn chuyển khoản CHƯA thu tiền thì không đánh dấu đã hoàn tiền")
    void hoanHoaDonChuaThuTienThiKhongDanhDauHoanTien() {
        service.addItem(1L, themHang(2));
        service.checkout(1L, thanhToan(Order.PaymentMethod.BANK_TRANSFER));

        service.voidCompletedInvoice(1L);

        assertThat(hoaDon.getPaymentStatus())
                .as("Chưa nhận tiền thì không có gì để hoàn")
                .isEqualTo(Order.PaymentStatus.UNPAID);
        assertThat(bienThe.getStockQuantity()).isEqualTo(10);
    }
}
