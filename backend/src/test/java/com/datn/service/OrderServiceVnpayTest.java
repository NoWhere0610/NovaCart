package com.datn.service;

import com.datn.dto.order.VnpayIpnResult;
import com.datn.entity.Order;
import com.datn.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Xử lý thông báo thanh toán từ VNPay.
 *
 * Đây là chỗ test tự động có giá trị cao nhất trong toàn dự án, vì luồng thật KHÔNG kiểm tay được đầy
 * đủ: muốn VNPay gửi được IPN vào máy thì cần tunnel ra ngoài và khai URL trong cổng quản trị, còn các
 * ca hiểm (chữ ký giả, số tiền lệch, gửi trùng, đơn đã bị huỷ giữa chừng) thì không có cách nào bắt
 * cổng thanh toán thật tạo ra theo ý mình.
 *
 * Mã trả về (RspCode) không phải chuyện hình thức: VNPay DỪNG gửi lại khi nhận 00/02, và THỬ LẠI tới
 * 10 lần với 01/04/97/99. Trả nhầm mã nghĩa là hoặc mất thông báo thanh toán, hoặc bị gọi lại vô ích.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServiceVnpayTest {

    @Mock
    OrderRepository orderRepository;
    @Mock
    VNPayService vnPayService;
    @InjectMocks
    OrderService service;

    private Order don;

    @BeforeEach
    void setUp() {
        don = new Order();
        don.setOrderId(77L);
        don.setOrderCode("DH77");
        don.setPaymentMethod(Order.PaymentMethod.VNPAY);
        don.setPaymentStatus(Order.PaymentStatus.UNPAID);
        don.setStatus(Order.Status.PENDING);
        don.setTotalAmount(BigDecimal.valueOf(350_000));

        when(vnPayService.verifyReturn(any())).thenReturn(true);
        when(orderRepository.findById(77L)).thenReturn(Optional.of(don));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
    }

    /** Tham số VNPay gửi về: số tiền nhân 100 vì cổng không nhận số thập phân. */
    private Map<String, String> thamSo(String responseCode, long soTienDong) {
        Map<String, String> p = new HashMap<>();
        p.put("vnp_TxnRef", "77");
        p.put("vnp_ResponseCode", responseCode);
        p.put("vnp_Amount", String.valueOf(soTienDong * 100));
        return p;
    }

    private VnpayIpnResult ipn(Map<String, String> p) {
        return service.handleVnpayCallback(p, "IPN");
    }

    // ----- Đường thành công -----

    @Test
    @DisplayName("Thanh toán thành công: ghi nhận PAID và trả 00 để VNPay dừng gửi lại")
    void thanhToanThanhCong() {
        assertThat(ipn(thamSo("00", 350_000))).isEqualTo(VnpayIpnResult.SUCCESS);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.PAID);
    }

    @Test
    @DisplayName("VNPay gửi trùng: lần sau trả 02, không xử lý lại")
    void guiTrungThiTra02() {
        ipn(thamSo("00", 350_000));
        assertThat(ipn(thamSo("00", 350_000)))
                .as("02 = đã xác nhận rồi; VNPay dừng gửi lại thay vì thử tiếp 10 lần")
                .isEqualTo(VnpayIpnResult.ALREADY_CONFIRMED);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.PAID);
    }

    // ----- Các ca phải TỪ CHỐI -----

    @Test
    @DisplayName("Chữ ký không hợp lệ: trả 97 và KHÔNG đọc tham số nào")
    void chuKySaiThiTuChoi() {
        when(vnPayService.verifyReturn(any())).thenReturn(false);

        assertThat(ipn(thamSo("00", 350_000))).isEqualTo(VnpayIpnResult.INVALID_SIGNATURE);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.UNPAID);
        verify(orderRepository, never()).findById(any());
    }

    @Test
    @DisplayName("Số tiền không khớp đơn: trả 04, không ghi PAID dù chữ ký hợp lệ")
    void soTienKhongKhopThiTuChoi() {
        assertThat(ipn(thamSo("00", 1_000)))
                .as("Chữ ký hợp lệ vẫn có thể đi kèm số tiền của giao dịch khác/cũ")
                .isEqualTo(VnpayIpnResult.INVALID_AMOUNT);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("vnp_TxnRef không phải số / không có đơn: trả 01")
    void khongTimThayDon() {
        Map<String, String> p = thamSo("00", 350_000);
        p.put("vnp_TxnRef", "khong-phai-so");
        assertThat(ipn(p)).isEqualTo(VnpayIpnResult.ORDER_NOT_FOUND);

        when(orderRepository.findById(77L)).thenReturn(Optional.empty());
        assertThat(ipn(thamSo("00", 350_000))).isEqualTo(VnpayIpnResult.ORDER_NOT_FOUND);
    }

    @Test
    @DisplayName("Đơn không dùng VNPay: trả 01, không đánh dấu thanh toán hộ phương thức khác")
    void donKhongPhaiVnpay() {
        don.setPaymentMethod(Order.PaymentMethod.COD);
        assertThat(ipn(thamSo("00", 350_000))).isEqualTo(VnpayIpnResult.ORDER_NOT_FOUND);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("Khách huỷ ở cổng thanh toán: trả 00 (đã ghi nhận) nhưng đơn giữ nguyên UNPAID")
    void thanhToanThatBaiVanTra00() {
        assertThat(ipn(thamSo("24", 350_000)))
                .as("Đây là thông báo đã xử lý xong -- trả mã lỗi sẽ khiến VNPay gọi lại 10 lần vô ích")
                .isEqualTo(VnpayIpnResult.SUCCESS);
        assertThat(don.getPaymentStatus())
                .as("Thanh toán hỏng thì đơn phải còn UNPAID để khách trả lại được")
                .isEqualTo(Order.PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("Đơn đã bị huỷ giữa lúc thanh toán: KHÔNG set PAID đè lên, trả 02")
    void donDaHuyThiKhongSetPaid() {
        don.setStatus(Order.Status.CANCELLED);

        assertThat(ipn(thamSo("00", 350_000))).isEqualTo(VnpayIpnResult.ALREADY_CONFIRMED);
        assertThat(don.getPaymentStatus())
                .as("Tiền đã về shop nhưng đơn đã chết -- phải đối soát tay, không tự coi là ổn")
                .isEqualTo(Order.PaymentStatus.UNPAID);
    }

    // ----- ReturnUrl (redirect trình duyệt) dùng chung lõi -----

    @Test
    @DisplayName("ReturnUrl dùng chung lõi xử lý: thành công -> true, chữ ký sai -> false")
    void returnUrlDungChungLoi() {
        assertThat(service.handleVnpayReturn(thamSo("00", 350_000))).isTrue();

        don.setPaymentStatus(Order.PaymentStatus.UNPAID);
        when(vnPayService.verifyReturn(any())).thenReturn(false);
        assertThat(service.handleVnpayReturn(thamSo("00", 350_000))).isFalse();
    }

    @Test
    @DisplayName("Khách mất mạng, chỉ IPN tới: đơn vẫn được ghi nhận đã thanh toán")
    void chiCoIpnToiThiVanGhiNhanDuoc() {
        // Đây chính là ca mà trước khi có IPN thì đơn kẹt UNPAID vĩnh viễn: khách trả tiền xong đóng
        // trình duyệt nên ReturnUrl không bao giờ chạy.
        assertThat(ipn(thamSo("00", 350_000))).isEqualTo(VnpayIpnResult.SUCCESS);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.PAID);
    }

    // ----- Bảng mã phải khớp đặc tả VNPay -----

    @Test
    @DisplayName("Mã RspCode khớp đúng bảng VNPay quy định")
    void maRspCodeKhopDacTa() {
        assertThat(VnpayIpnResult.SUCCESS.getRspCode()).isEqualTo("00");
        assertThat(VnpayIpnResult.ORDER_NOT_FOUND.getRspCode()).isEqualTo("01");
        assertThat(VnpayIpnResult.ALREADY_CONFIRMED.getRspCode()).isEqualTo("02");
        assertThat(VnpayIpnResult.INVALID_AMOUNT.getRspCode()).isEqualTo("04");
        assertThat(VnpayIpnResult.INVALID_SIGNATURE.getRspCode()).isEqualTo("97");
        assertThat(VnpayIpnResult.UNKNOWN_ERROR.getRspCode()).isEqualTo("99");
    }
}
