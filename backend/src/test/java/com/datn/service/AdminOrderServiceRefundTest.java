package com.datn.service;

import com.datn.entity.Order;
import com.datn.entity.ProductVariant;
import com.datn.exception.ApiException;
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

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Bước "admin xác nhận đã chuyển tiền hoàn lại cho khách".
 *
 * VÌ SAO PHẢI LÀ BƯỚC RIÊNG: trước đây hệ thống đặt paymentStatus = REFUNDED ngay khi admin duyệt trả
 * hàng, tức là báo "đã hoàn tiền" trong khi tiền còn nguyên trong tài khoản shop. Không ai tra được đã
 * chuyển hay chưa; khách gọi lên hỏi thì hệ thống trả lời sai.
 *
 * refundStatus tách hẳn khỏi paymentStatus: paymentStatus trả lời "sổ sách ghi gì", refundStatus trả
 * lời "tiền đã đi chưa". Các test dưới đây khoá đúng ranh giới đó lại.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminOrderServiceRefundTest {

    @Mock
    OrderRepository orderRepository;
    @Mock
    ProductVariantRepository variantRepository;
    @Mock
    VoucherService voucherService;
    @InjectMocks
    AdminOrderService service;

    /** Đơn ONLINE đã khai tài khoản nhận tiền, đang ở trạng thái + tiến độ hoàn tiền cho trước. */
    private Order don(Order.Status status, Order.RefundStatus refundStatus) {
        ProductVariant v = StatsFixtures.variant(1, "Áo thun", null, null);
        v.setStockQuantity(10);
        Order o = StatsFixtures.order(LocalDateTime.of(2026, 9, 1, 8, 0), 200_000L,
                StatsFixtures.item(v, 2, 100_000L));
        o.setOrderId(1L);
        o.setStatus(status);
        o.setOrderType(Order.OrderType.ONLINE);
        o.setPaymentMethod(Order.PaymentMethod.COD);
        o.setRefundStatus(refundStatus);
        o.setRefundBankName("Vietcombank");
        o.setRefundAccountNumber("1234567890");
        o.setRefundAccountHolder("NGUYEN VAN A");
        when(orderRepository.findById(1L)).thenReturn(Optional.of(o));
        when(variantRepository.findByIdForUpdate(anyLong())).thenReturn(Optional.of(v));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
        return o;
    }

    @Test
    @DisplayName("Đã duyệt trả hàng + đang chờ hoàn: xác nhận được, có ghi mốc thời gian")
    void xacNhanDuoc() {
        Order o = don(Order.Status.RETURNED, Order.RefundStatus.PENDING);

        service.confirmRefund(1L);

        assertThat(o.getRefundStatus()).isEqualTo(Order.RefundStatus.COMPLETED);
        // Mốc riêng, KHÔNG dùng chung returnedAt: duyệt trả hàng và chuyển tiền thường cách nhau vài
        // ngày, gộp làm một là mất dấu khoảng chờ mà khách phải chịu.
        assertThat(o.getRefundCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("Chưa duyệt trả hàng: KHÔNG cho xác nhận hoàn tiền")
    void chuaDuyetTraHang_khongChoXacNhan() {
        Order o = don(Order.Status.RETURN_REQUESTED, Order.RefundStatus.PENDING);

        // Cho bấm ở đây thì admin rất dễ chuyển tiền cho một yêu cầu mà sau đó chính mình lại từ chối.
        assertThatThrownBy(() -> service.confirmRefund(1L))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("trước khi xác nhận hoàn tiền");

        assertThat(o.getRefundStatus()).isEqualTo(Order.RefundStatus.PENDING);
        assertThat(o.getRefundCompletedAt()).isNull();
    }

    @Test
    @DisplayName("ADMIN huỷ đơn đã thanh toán: sinh khoản phải hoàn, không để tiền biến mất khỏi mọi danh sách")
    void adminHuyDonDaTra_sinhKhoanPhaiHoan() {
        Order o = don(Order.Status.PENDING, Order.RefundStatus.NONE);
        o.setPaymentMethod(Order.PaymentMethod.VNPAY);
        o.setPaymentStatus(Order.PaymentStatus.PAID);
        // Admin không biết số tài khoản của khách -- khác luồng khách tự huỷ (khai ngay lúc bấm).
        o.setRefundBankName(null);
        o.setRefundAccountNumber(null);
        o.setRefundAccountHolder(null);

        service.updateStatus(1L, Order.Status.CANCELLED);

        // Để NONE thì đơn biến mất khỏi mọi danh sách và số tiền đó không còn ai theo dõi.
        assertThat(o.getRefundStatus()).isEqualTo(Order.RefundStatus.PENDING);
        assertThat(o.getPaymentStatus()).isEqualTo(Order.PaymentStatus.REFUNDED);
    }

    @Test
    @DisplayName("Chưa có tài khoản nhận: KHÔNG cho xác nhận đã hoàn tiền")
    void chuaCoTaiKhoanNhan_khongChoXacNhan() {
        Order o = don(Order.Status.CANCELLED, Order.RefundStatus.PENDING);
        o.setRefundBankName(null);
        o.setRefundAccountNumber(null);
        o.setRefundAccountHolder(null);

        // Không có tài khoản thì không thể đã chuyển được. Cho bấm ở đây là mở đường để một khoản nợ
        // khách bị đánh dấu xong mà thật ra chưa chuyển đi đâu cả.
        assertThatThrownBy(() -> service.confirmRefund(1L))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chưa có tài khoản nhận");

        assertThat(o.getRefundStatus()).isEqualTo(Order.RefundStatus.PENDING);
    }

    @Test
    @DisplayName("Đơn ĐÃ HUỶ có đủ tài khoản: xác nhận hoàn tiền được")
    void donDaHuy_xacNhanDuoc() {
        Order o = don(Order.Status.CANCELLED, Order.RefundStatus.PENDING);

        service.confirmRefund(1L);

        assertThat(o.getRefundStatus()).isEqualTo(Order.RefundStatus.COMPLETED);
        assertThat(o.getRefundCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("Bấm xác nhận lần hai: từ chối, giữ nguyên mốc lần đầu")
    void xacNhanHaiLan_tuChoi() {
        Order o = don(Order.Status.RETURNED, Order.RefundStatus.COMPLETED);
        LocalDateTime mocCu = LocalDateTime.of(2026, 9, 2, 10, 0);
        o.setRefundCompletedAt(mocCu);

        assertThatThrownBy(() -> service.confirmRefund(1L))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("đã được xác nhận hoàn tiền");

        assertThat(o.getRefundCompletedAt()).isEqualTo(mocCu);
    }

    @Test
    @DisplayName("Đơn không có yêu cầu hoàn tiền nào: từ chối")
    void khongCoYeuCau_tuChoi() {
        don(Order.Status.RETURNED, Order.RefundStatus.NONE);

        assertThatThrownBy(() -> service.confirmRefund(1L))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("không có yêu cầu hoàn tiền");
    }

    @Test
    @DisplayName("Admin TỪ CHỐI yêu cầu trả hàng: khoản chờ hoàn bị huỷ theo")
    void tuChoiTraHang_huyKhoanChoHoan() {
        Order o = don(Order.Status.RETURN_REQUESTED, Order.RefundStatus.PENDING);

        service.updateStatus(1L, Order.Status.COMPLETED);

        // Không huỷ thì đơn nằm mãi trong danh sách "chờ chuyển tiền" dù yêu cầu đã bị bác -- sớm muộn
        // cũng có người chuyển nhầm.
        assertThat(o.getRefundStatus()).isEqualTo(Order.RefundStatus.NONE);
        assertThat(o.getStatus()).isEqualTo(Order.Status.COMPLETED);
        // Vẫn giữ thông tin tài khoản để còn truy vết khách đã khai gì.
        assertThat(o.getRefundAccountNumber()).isEqualTo("1234567890");
    }

    // ===================== Từ chối yêu cầu trả hàng =====================

    @Test
    @DisplayName("Từ chối đơn vốn ĐÃ GIAO: trả về DELIVERED, không đẩy lên COMPLETED")
    void tuChoi_donDaGiao_veLaiDaGiao() {
        Order o = don(Order.Status.RETURN_REQUESTED, Order.RefundStatus.PENDING);
        o.setStatusBeforeReturn(Order.Status.DELIVERED);

        service.updateStatus(1L, Order.Status.DELIVERED);

        // Trước đây từ chối luôn đẩy sang COMPLETED: khách yêu cầu trả hàng khi đơn mới DELIVERED, bị
        // từ chối, thế là đơn tự nhảy sang "Hoàn thành" -- mất luôn bước khách tự xác nhận nhận hàng.
        assertThat(o.getStatus()).isEqualTo(Order.Status.DELIVERED);
        assertThat(o.getRefundStatus()).isEqualTo(Order.RefundStatus.NONE);
    }

    @Test
    @DisplayName("Từ chối đơn vốn HOÀN THÀNH: về lại COMPLETED")
    void tuChoi_donHoanThanh_veLaiHoanThanh() {
        Order o = don(Order.Status.RETURN_REQUESTED, Order.RefundStatus.PENDING);
        o.setStatusBeforeReturn(Order.Status.COMPLETED);

        service.updateStatus(1L, Order.Status.COMPLETED);

        assertThat(o.getStatus()).isEqualTo(Order.Status.COMPLETED);
    }

    @Test
    @DisplayName("Không cho từ chối về trạng thái KHÁC với lúc trước khi yêu cầu")
    void tuChoi_veSaiTrangThai_biChan() {
        Order o = don(Order.Status.RETURN_REQUESTED, Order.RefundStatus.PENDING);
        o.setStatusBeforeReturn(Order.Status.COMPLETED);

        // Không chặn thì admin đẩy ngược một đơn đã xong về "chờ khách xác nhận" -- trạng thái chưa
        // từng có thật với đơn đó.
        assertThatThrownBy(() -> service.updateStatus(1L, Order.Status.DELIVERED))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("phải quay về trạng thái COMPLETED");

        assertThat(o.getStatus()).isEqualTo(Order.Status.RETURN_REQUESTED);
    }

    @Test
    @DisplayName("Đơn CŨ chưa có statusBeforeReturn: giữ hành vi cũ, chỉ cho về COMPLETED")
    void tuChoi_donCu_veCompleted() {
        Order o = don(Order.Status.RETURN_REQUESTED, Order.RefundStatus.PENDING);
        o.setStatusBeforeReturn(null); // đơn tạo trước khi có cột này

        assertThatThrownBy(() -> service.updateStatus(1L, Order.Status.DELIVERED))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("phải quay về trạng thái COMPLETED");

        service.updateStatus(1L, Order.Status.COMPLETED);
        assertThat(o.getStatus()).isEqualTo(Order.Status.COMPLETED);
    }

    // ===================== Giao thất bại + điền tài khoản hộ khách =====================

    @Test
    @DisplayName("Giao thất bại: huỷ được từ SHIPPING, hoàn kho, KHÔNG ghi mốc đã giao")
    void giaoThatBai_huyDuocVaHoanKho() {
        Order o = don(Order.Status.SHIPPING, Order.RefundStatus.NONE);
        o.setPaymentMethod(Order.PaymentMethod.COD);
        o.setPaymentStatus(Order.PaymentStatus.UNPAID);

        service.updateStatus(1L, Order.Status.CANCELLED);

        assertThat(o.getStatus()).isEqualTo(Order.Status.CANCELLED);
        // Thiếu lối ra này thì nhân viên buộc phải bấm "Đã giao hàng" cho một đơn giao hỏng -- và với
        // COD, "đã giao" chính là căn cứ duy nhất để hệ thống tin khách đã trả tiền, nên khách chưa trả
        // đồng nào vẫn đòi hoàn tiền được.
        assertThat(o.getDeliveredAt()).as("Giao hỏng thì không được ghi mốc đã giao").isNull();
        // SHIPPING đã qua bước trừ kho ở PENDING -> CONFIRMED nên phải hoàn lại.
        assertThat(o.getItems().get(0).getVariant().getStockQuantity()).isEqualTo(12);
    }

    @Test
    @DisplayName("Admin điền hộ tài khoản nhận cho khoản hoàn không hỏi được khách")
    void adminDienHoTaiKhoanNhan() {
        Order o = don(Order.Status.CANCELLED, Order.RefundStatus.PENDING);
        o.setRefundBankName(null);
        o.setRefundAccountNumber(null);
        o.setRefundAccountHolder(null);

        var r = new com.datn.dto.admin.UpdateRefundAccountRequest();
        r.setRefundBankName("Vietcombank (Ngoại thương)");
        r.setRefundAccountNumber("1234 5678 9012"); // cố tình dán kèm dấu cách
        r.setRefundAccountHolder("  NGUYEN VAN A  ");
        service.updateRefundAccount(1L, r);

        // Không có đường này thì khoản hoàn kẹt vĩnh viễn: confirmRefund đòi có số tài khoản, mà API
        // của khách lại từ chối đơn đã CANCELLED nên khách cũng không tự khai lại được.
        assertThat(o.getRefundAccountNumber()).isEqualTo("123456789012");
        assertThat(o.getRefundAccountHolder()).isEqualTo("NGUYEN VAN A");
        assertThat(o.getRefundBankName()).isEqualTo("Vietcombank (Ngoại thương)");

        // Điền xong thì xác nhận hoàn tiền được ngay.
        service.confirmRefund(1L);
        assertThat(o.getRefundStatus()).isEqualTo(Order.RefundStatus.COMPLETED);
    }

    @Test
    @DisplayName("Số tài khoản admin gõ sai định dạng: từ chối, dùng chung quy tắc với đường khách khai")
    void adminGoSaiDinhDang_biTuChoi() {
        don(Order.Status.CANCELLED, Order.RefundStatus.PENDING);

        var r = new com.datn.dto.admin.UpdateRefundAccountRequest();
        r.setRefundBankName("ACB");
        r.setRefundAccountNumber("12AB");
        r.setRefundAccountHolder("A");

        assertThatThrownBy(() -> service.updateRefundAccount(1L, r))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chỉ gồm chữ số");
    }

    @Test
    @DisplayName("Đơn đã hoàn tiền xong: không cho sửa tài khoản nhận nữa")
    void daHoanXong_khongChoSuaTaiKhoan() {
        don(Order.Status.CANCELLED, Order.RefundStatus.COMPLETED);

        var r = new com.datn.dto.admin.UpdateRefundAccountRequest();
        r.setRefundBankName("ACB");
        r.setRefundAccountNumber("1234567890");
        r.setRefundAccountHolder("A");

        assertThatThrownBy(() -> service.updateRefundAccount(1L, r))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("đã hoàn tiền xong");
    }

    @Test
    @DisplayName("Duyệt trả hàng: khoản chờ hoàn VẪN chờ, không tự nhảy sang đã hoàn")
    void duyetTraHang_vanConCho() {
        Order o = don(Order.Status.RETURN_REQUESTED, Order.RefundStatus.PENDING);

        service.updateStatus(1L, Order.Status.RETURNED);

        // Đây chính là lỗi cũ được khoá lại: duyệt trả hàng KHÔNG đồng nghĩa với đã chuyển tiền.
        assertThat(o.getRefundStatus()).isEqualTo(Order.RefundStatus.PENDING);
        assertThat(o.getRefundCompletedAt()).isNull();
    }
}
