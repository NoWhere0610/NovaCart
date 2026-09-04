package com.datn.service;

import com.datn.dto.order.CancelOrderRequest;
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
import java.util.ArrayList;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Huỷ đơn ĐÃ THANH TOÁN thì tiền đi đâu.
 *
 * LỖI ĐÃ ĐO ĐƯỢC TRƯỚC KHI SỬA: khách thanh toán VNPay 900.000đ rồi bấm huỷ. Hệ thống đặt
 * paymentStatus = REFUNDED -- tức ghi nhận "đã hoàn tiền" -- nhưng KHÔNG hỏi số tài khoản, KHÔNG đưa
 * đơn vào hàng chờ chuyển tiền nào (đếm trong cơ sở dữ liệu: 0 dòng). Tiền nằm im ở shop và không còn
 * ai biết là đang nợ khách.
 *
 * Đây là cùng một lớp lỗi với luồng trả hàng, nhưng ở nhánh dễ xảy ra hơn nhiều trong thực tế: thanh
 * toán xong rồi đổi ý ngay, đơn còn chưa ai xác nhận.
 *
 * Nhìn màn hình thì không phân biệt được: cả hai trường hợp đơn đều hiện "Đã huỷ".
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServiceCancelRefundTest {

    @Mock
    OrderRepository orderRepository;
    @Mock
    VoucherService voucherService;
    @InjectMocks
    OrderService service;

    private Order don;

    @BeforeEach
    void setUp() {
        don = new Order();
        don.setOrderId(9L);
        don.setStatus(Order.Status.PENDING);
        don.setTotalAmount(BigDecimal.valueOf(900_000));
        don.setItems(new ArrayList<>());
        don.setRefundStatus(Order.RefundStatus.NONE);

        when(orderRepository.findByOrderIdAndUser_UserId(anyLong(), anyLong())).thenReturn(Optional.of(don));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
    }

    private CancelOrderRequest taiKhoan(String bank, String stk, String chu) {
        CancelOrderRequest r = new CancelOrderRequest();
        r.setRefundBankName(bank);
        r.setRefundAccountNumber(stk);
        r.setRefundAccountHolder(chu);
        return r;
    }

    // ===================== Đơn đã thanh toán =====================

    @Test
    @DisplayName("VNPay ĐÃ trả tiền, huỷ mà không khai tài khoản -> từ chối")
    void daTraTien_khongKhaiTaiKhoan_tuChoi() {
        don.setPaymentMethod(Order.PaymentMethod.VNPAY);
        don.setPaymentStatus(Order.PaymentStatus.PAID);

        assertThatThrownBy(() -> service.cancelMyOrder(1L, 9L, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ngân hàng");

        // Yêu cầu bị từ chối thì đơn phải nguyên vẹn -- không được huỷ nửa vời.
        assertThat(don.getStatus()).isEqualTo(Order.Status.PENDING);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.PAID);
    }

    @Test
    @DisplayName("Khai đủ -> đơn huỷ VÀ vào hàng chờ chuyển tiền, có đủ thông tin nhận")
    void daTraTien_khaiDu_vaoHangCho() {
        don.setPaymentMethod(Order.PaymentMethod.VNPAY);
        don.setPaymentStatus(Order.PaymentStatus.PAID);

        service.cancelMyOrder(1L, 9L, taiKhoan("Vietcombank", "1234567890", "NGUYEN VAN A"));

        assertThat(don.getStatus()).isEqualTo(Order.Status.CANCELLED);
        // ĐÂY là điều bản cũ thiếu: chỉ có paymentStatus đổi, còn khoản phải hoàn thì không tồn tại.
        assertThat(don.getRefundStatus()).isEqualTo(Order.RefundStatus.PENDING);
        assertThat(don.getRefundAccountNumber()).isEqualTo("1234567890");
        assertThat(don.getRefundBankName()).isEqualTo("Vietcombank");
        assertThat(don.getRefundCompletedAt())
                .as("Chưa ai chuyển tiền thì chưa được có mốc hoàn tiền")
                .isNull();
        // Bút toán đảo khoản vẫn giữ nguyên như cũ (thống kê đang dựa vào nó).
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.REFUNDED);
    }

    @Test
    @DisplayName("Số tài khoản sai định dạng -> từ chối, đơn nguyên vẹn")
    void soTaiKhoanSai_tuChoi() {
        don.setPaymentMethod(Order.PaymentMethod.BANK_TRANSFER);
        don.setPaymentStatus(Order.PaymentStatus.PAID);

        assertThatThrownBy(() -> service.cancelMyOrder(1L, 9L, taiKhoan("ACB", "12AB", "A")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chỉ gồm chữ số");

        assertThat(don.getStatus()).isEqualTo(Order.Status.PENDING);
    }

    // ===================== Đơn chưa thanh toán =====================

    @Test
    @DisplayName("COD chưa giao: huỷ bình thường, KHÔNG đòi số tài khoản")
    void codChuaGiao_khongDoiTaiKhoan() {
        don.setPaymentMethod(Order.PaymentMethod.COD);
        don.setPaymentStatus(Order.PaymentStatus.UNPAID);

        // Ca hồi quy quan trọng: khachDaTraTien() với COD từng trả về true VÔ ĐIỀU KIỆN (đúng cho luồng
        // trả hàng, nơi đơn chắc chắn đã giao). Bê nguyên sang luồng huỷ thì mọi khách COD huỷ đơn --
        // trường hợp thường gặp nhất -- đều bị đòi số tài khoản dù chưa trả đồng nào.
        assertThatCode(() -> service.cancelMyOrder(1L, 9L, null)).doesNotThrowAnyException();

        assertThat(don.getStatus()).isEqualTo(Order.Status.CANCELLED);
        assertThat(don.getRefundStatus()).isEqualTo(Order.RefundStatus.NONE);
        assertThat(don.getPaymentStatus()).isEqualTo(Order.PaymentStatus.UNPAID);
    }

    @Test
    @DisplayName("VNPay CHƯA thanh toán (bỏ dở giữa chừng): huỷ bình thường, không có gì để hoàn")
    void vnpayChuaTra_khongDoiTaiKhoan() {
        don.setPaymentMethod(Order.PaymentMethod.VNPAY);
        don.setPaymentStatus(Order.PaymentStatus.UNPAID);

        assertThatCode(() -> service.cancelMyOrder(1L, 9L, null)).doesNotThrowAnyException();

        assertThat(don.getStatus()).isEqualTo(Order.Status.CANCELLED);
        assertThat(don.getRefundStatus()).isEqualTo(Order.RefundStatus.NONE);
    }

    @Test
    @DisplayName("Đơn đang giao: không huỷ được, kể cả khi khai đủ tài khoản")
    void dangGiao_khongHuyDuoc() {
        don.setStatus(Order.Status.SHIPPING);
        don.setPaymentMethod(Order.PaymentMethod.VNPAY);
        don.setPaymentStatus(Order.PaymentStatus.PAID);

        assertThatThrownBy(() -> service.cancelMyOrder(1L, 9L, taiKhoan("ACB", "1234567890", "A")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("không thể huỷ");
    }
}
