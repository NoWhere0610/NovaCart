package com.datn.service;

import com.datn.dto.order.RequestReturnRequest;
import com.datn.entity.Order;
import com.datn.exception.ApiException;
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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Thông tin tài khoản nhận tiền hoàn, khai lúc khách gửi yêu cầu trả hàng.
 *
 * CA QUAN TRỌNG NHẤT nằm ở đơn COD. Hệ thống KHÔNG có bước "xác nhận đã thu tiền mặt" riêng cho COD,
 * nên đơn COD giữ paymentStatus = UNPAID VĨNH VIỄN kể cả sau khi khách đã đưa tiền tận tay shipper
 * (xem chú thích trong AdminStatisticsService.laDonThuTienThat). Viết điều kiện thành
 * `paymentStatus == PAID` cho gọn thì toàn bộ khách COD -- nhóm đông nhất -- sẽ không bao giờ được hỏi
 * số tài khoản, tức là không bao giờ nhận lại được tiền. Lỗi đó chạy tay gần như không lộ ra: màn hình
 * vẫn gửi yêu cầu thành công, chỉ là thiếu mất phần thông tin, và mãi tới lúc admin định chuyển khoản
 * mới phát hiện không biết chuyển cho ai.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServiceRefundInfoTest {

    @Mock
    OrderRepository orderRepository;
    @InjectMocks
    OrderService service;

    private Order don;

    @BeforeEach
    void setUp() {
        don = new Order();
        don.setOrderId(5L);
        don.setStatus(Order.Status.DELIVERED);
        don.setDeliveredAt(LocalDateTime.now().minusDays(2)); // còn trong hạn 7 ngày
        don.setTotalAmount(BigDecimal.valueOf(500_000));
        don.setItems(new ArrayList<>());

        when(orderRepository.findByOrderIdAndUser_UserId(anyLong(), anyLong())).thenReturn(Optional.of(don));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
    }

    private RequestReturnRequest yeuCau(String bank, String stk, String chuTk) {
        RequestReturnRequest r = new RequestReturnRequest();
        r.setReason("Sản phẩm bị lỗi đường may");
        r.setRefundBankName(bank);
        r.setRefundAccountNumber(stk);
        r.setRefundAccountHolder(chuTk);
        return r;
    }

    private RequestReturnRequest yeuCauDayDu() {
        return yeuCau("Vietcombank", "1234567890", "NGUYEN VAN A");
    }

    // ===================== COD: đã giao là đã thu tiền =====================

    @Test
    @DisplayName("COD đã giao: BẮT BUỘC khai tài khoản, dù paymentStatus vẫn là UNPAID")
    void codDaGiao_batBuocKhaiTaiKhoan() {
        don.setPaymentMethod(Order.PaymentMethod.COD);
        don.setPaymentStatus(Order.PaymentStatus.UNPAID); // đúng trạng thái thật của mọi đơn COD

        // Nếu ai đó "đơn giản hoá" điều kiện thành paymentStatus == PAID thì ca này lặng lẽ đi qua,
        // đơn chuyển sang RETURN_REQUESTED mà không có thông tin nhận tiền nào.
        assertThatThrownBy(() -> service.requestReturn(1L, 5L, yeuCau(null, null, null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ngân hàng");

        assertThat(don.getStatus())
                .as("Yêu cầu bị từ chối thì đơn phải giữ nguyên trạng thái cũ")
                .isEqualTo(Order.Status.DELIVERED);
    }

    @Test
    @DisplayName("COD đã giao + khai đủ: lưu thông tin và chuyển sang chờ hoàn tiền")
    void codDaGiao_khaiDu() {
        don.setPaymentMethod(Order.PaymentMethod.COD);
        don.setPaymentStatus(Order.PaymentStatus.UNPAID);

        service.requestReturn(1L, 5L, yeuCauDayDu());

        assertThat(don.getStatus()).isEqualTo(Order.Status.RETURN_REQUESTED);
        assertThat(don.getRefundStatus()).isEqualTo(Order.RefundStatus.PENDING);
        assertThat(don.getRefundBankName()).isEqualTo("Vietcombank");
        assertThat(don.getRefundAccountNumber()).isEqualTo("1234567890");
        assertThat(don.getRefundAccountHolder()).isEqualTo("NGUYEN VAN A");
        assertThat(don.getRefundCompletedAt())
                .as("Chưa ai chuyển tiền thì chưa được có mốc hoàn tiền")
                .isNull();
    }

    // ===================== Đơn chưa từng trả tiền =====================

    @Test
    @DisplayName("VNPay chưa thanh toán: không đòi tài khoản, vì không có gì để hoàn")
    void vnpayChuaTra_khongDoiTaiKhoan() {
        don.setPaymentMethod(Order.PaymentMethod.VNPAY);
        don.setPaymentStatus(Order.PaymentStatus.UNPAID);

        assertThatCode(() -> service.requestReturn(1L, 5L, yeuCau(null, null, null)))
                .doesNotThrowAnyException();

        assertThat(don.getStatus()).isEqualTo(Order.Status.RETURN_REQUESTED);
        // NONE chứ không phải PENDING: đơn này không được xuất hiện trong danh sách chờ chuyển tiền
        // của admin, nếu không sớm muộn cũng có người chuyển cho một khách chưa từng trả đồng nào.
        assertThat(don.getRefundStatus()).isEqualTo(Order.RefundStatus.NONE);
    }

    @Test
    @DisplayName("VNPay đã thanh toán: bắt buộc khai tài khoản")
    void vnpayDaTra_batBuoc() {
        don.setPaymentMethod(Order.PaymentMethod.VNPAY);
        don.setPaymentStatus(Order.PaymentStatus.PAID);

        assertThatThrownBy(() -> service.requestReturn(1L, 5L, yeuCau("Techcombank", null, "A")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("số tài khoản");
    }

    @Test
    @DisplayName("Đơn từng PAID rồi bị đánh dấu REFUNDED: vẫn tính là đã trả tiền")
    void daDanhDauRefunded_vanTinhLaDaTra() {
        // paymentStatus.REFUNDED nghĩa là "khoản thu đã bị đảo trên sổ", KHÔNG có nghĩa là khách chưa
        // từng trả -- gom nhầm nó vào nhóm UNPAID thì khách mất luôn quyền được hỏi số tài khoản.
        don.setPaymentMethod(Order.PaymentMethod.VNPAY);
        don.setPaymentStatus(Order.PaymentStatus.REFUNDED);

        assertThatThrownBy(() -> service.requestReturn(1L, 5L, yeuCau(null, null, null)))
                .isInstanceOf(ApiException.class);
    }

    // ===================== Kiểm định dạng =====================

    @Test
    @DisplayName("Số tài khoản có chữ hoặc quá ngắn: từ chối")
    void soTaiKhoanSaiDinhDang() {
        don.setPaymentMethod(Order.PaymentMethod.COD);

        assertThatThrownBy(() -> service.requestReturn(1L, 5L, yeuCau("ACB", "12AB567890", "A")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chỉ gồm chữ số");

        assertThatThrownBy(() -> service.requestReturn(1L, 5L, yeuCau("ACB", "123", "A")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("6-20");
    }

    @Test
    @DisplayName("Số tài khoản dán kèm dấu cách theo nhóm: tự dọn, không báo lỗi")
    void soTaiKhoanCoDauCach_tuDon() {
        don.setPaymentMethod(Order.PaymentMethod.COD);

        // Ngân hàng hay hiển thị số tài khoản tách nhóm ("1234 5678 9012"). Khách dán nguyên vào mà bị
        // báo sai định dạng thì rất khó hiểu -- họ nhìn vào ô thấy đúng y số của mình.
        service.requestReturn(1L, 5L, yeuCau("BIDV", "1234 5678 9012", "  Trần Thị B  "));

        assertThat(don.getRefundAccountNumber()).isEqualTo("123456789012");
        assertThat(don.getRefundAccountHolder()).isEqualTo("Trần Thị B");
    }

    @Test
    @DisplayName("Chỉ toàn khoảng trắng cũng là bỏ trống")
    void toanKhoangTrangLaBoTrong() {
        don.setPaymentMethod(Order.PaymentMethod.COD);

        assertThatThrownBy(() -> service.requestReturn(1L, 5L, yeuCau("   ", "1234567890", "A")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ngân hàng");
    }
}
