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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Các lỗi do bản soát mã độc lập chỉ ra, khoá lại bằng test.
 *
 * Điểm chung của cả ba: mã CŨ đều "chạy đúng" theo nghĩa không ném lỗi, không hỏng dữ liệu rõ ràng --
 * nên không có test nào đỏ. Cái sai nằm ở chỗ hệ thống KHẲNG ĐỊNH một điều không đúng sự thật với
 * người dùng, hoặc lặng lẽ đánh rơi một khoản tiền có thật.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServiceReviewFixesTest {

    @Mock OrderRepository orderRepository;
    @Mock VNPayService vnPayService;
    @InjectMocks OrderService service;

    private Order don;

    @BeforeEach
    void setUp() {
        don = new Order();
        don.setOrderId(5L);
        don.setStatus(Order.Status.PENDING);
        don.setPaymentMethod(Order.PaymentMethod.VNPAY);
        don.setPaymentStatus(Order.PaymentStatus.UNPAID);
        don.setRefundStatus(Order.RefundStatus.NONE);
        don.setTotalAmount(BigDecimal.valueOf(900_000));
        don.setItems(new ArrayList<>());

        when(vnPayService.verifyReturn(any())).thenReturn(true);
        when(orderRepository.findById(anyLong())).thenReturn(Optional.of(don));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
    }

    /** Tham số VNPay gửi về, số tiền đã nhân 100 theo đúng quy ước của cổng. */
    private Map<String, String> thamSo(String responseCode) {
        Map<String, String> p = new HashMap<>();
        p.put("vnp_TxnRef", "5");
        p.put("vnp_Amount", "90000000");
        p.put("vnp_ResponseCode", responseCode);
        return p;
    }

    // ===================== Trang kết quả nói đúng sự thật =====================

    @Test
    @DisplayName("Khách HUỶ giao dịch ở cổng: trang kết quả KHÔNG được báo thanh toán thành công")
    void giaoDichThatBai_khongBaoThanhCong() {
        // Mã 24 = khách bấm huỷ ở cổng VNPay. Thẻ chưa hề bị trừ.
        boolean thanhCong = service.handleVnpayReturn(thamSo("24"));

        // Bản cũ trả về true (dùng chung VnpayIpnResult.SUCCESS cho cả "đã xử lý xong thông báo" lẫn
        // "khách đã trả tiền"), nên khách thấy dấu tích xanh "Thanh toán thành công" rồi ngồi đợi hàng,
        // trong khi đơn vẫn UNPAID và admin không xác nhận được.
        assertThat(thanhCong).isFalse();
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("Thanh toán thật thành công: vẫn báo thành công và đơn sang PAID")
    void giaoDichThanhCong_vanBaoDung() {
        assertThat(service.handleVnpayReturn(thamSo("00"))).isTrue();
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.PAID);
    }

    @Test
    @DisplayName("VNPay gửi lại thông báo của đơn đã PAID: vẫn tính là thành công")
    void guiTrung_vanTinhLaThanhCong() {
        don.setPaymentStatus(Order.PaymentStatus.PAID);
        assertThat(service.handleVnpayReturn(thamSo("00"))).isTrue();
    }

    // ===================== Tiền về trên đơn đã chết =====================

    @Test
    @DisplayName("Tiền về sau khi đơn đã huỷ: sinh khoản phải hoàn, không chỉ ghi log rồi bỏ đi")
    void tienVeTrenDonDaHuy_sinhKhoanPhaiHoan() {
        don.setStatus(Order.Status.CANCELLED);

        VnpayIpnResult kq = service.handleVnpayCallback(thamSo("00"), "IPN");

        // Bản cũ chỉ log.error rồi trả 02: đơn mang CANCELLED/UNPAID/refundStatus=NONE nên KHÔNG lọt vào
        // hàng chờ chuyển tiền, không vào thống kê, không có nút nào thao tác. Dấu vết duy nhất là một
        // dòng log trên đĩa mà không ai đọc hằng ngày để đối soát ngân hàng.
        assertThat(don.getRefundStatus()).isEqualTo(Order.RefundStatus.PENDING);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.REFUNDED);
        // Vẫn trả mã 02 để VNPay dừng gửi lại -- đơn đã chết, thử lại không đổi được gì.
        assertThat(kq.getRspCode()).isEqualTo("02");
        // Nhưng KHÔNG được coi là "khách đã thanh toán xong" khi hiển thị cho khách.
        assertThat(kq.laThanhToanThanhCong()).isFalse();
    }

    @Test
    @DisplayName("Giao dịch HỎNG trên đơn đã huỷ: không có đồng nào về, không sinh khoản phải hoàn")
    void giaoDichHongTrenDonDaHuy_khongSinhGi() {
        don.setStatus(Order.Status.CANCELLED);

        service.handleVnpayCallback(thamSo("24"), "IPN");

        // Ca này phải phân biệt được với ca trên: sinh khoản phải hoàn ở đây là bịa ra một khoản nợ
        // không tồn tại, và admin sẽ chuyển tiền cho người chưa trả đồng nào.
        assertThat(don.getRefundStatus()).isEqualTo(Order.RefundStatus.NONE);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("Đơn đã hoàn tiền xong rồi: không kéo ngược về đang chờ")
    void daHoanTienXong_khongKeoNguoc() {
        don.setStatus(Order.Status.CANCELLED);
        don.setRefundStatus(Order.RefundStatus.COMPLETED);

        service.handleVnpayCallback(thamSo("00"), "IPN");

        assertThat(don.getRefundStatus()).isEqualTo(Order.RefundStatus.COMPLETED);
    }
}
