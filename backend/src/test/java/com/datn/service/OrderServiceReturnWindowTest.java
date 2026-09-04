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
 * Hạn đổi trả 7 ngày.
 *
 * Chính sách đổi trả công bố trên website ghi "trong vòng 7 ngày kể từ ngày nhận hàng", nhưng hệ thống
 * trước đây KHÔNG thực thi -- khách yêu cầu trả hàng sau vài tháng vẫn qua. Đây là loại lỗi khó thấy
 * khi kiểm tay vì phải đợi qua ngày mới tái hiện được; với test thì chỉ là đặt lại deliveredAt.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServiceReturnWindowTest {

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
        don.setTotalAmount(BigDecimal.valueOf(200_000));
        don.setItems(new ArrayList<>());

        when(orderRepository.findByOrderIdAndUser_UserId(anyLong(), anyLong())).thenReturn(Optional.of(don));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
    }

    private RequestReturnRequest lyDo() {
        RequestReturnRequest r = new RequestReturnRequest();
        r.setReason("Sản phẩm bị lỗi đường may");
        return r;
    }

    @Test
    @DisplayName("Nhận hàng 3 ngày trước: còn hạn, yêu cầu trả hàng được chấp nhận")
    void trongHanThiChapNhan() {
        don.setDeliveredAt(LocalDateTime.now().minusDays(3));

        service.requestReturn(1L, 5L, lyDo());

        assertThat(don.getStatus()).isEqualTo(Order.Status.RETURN_REQUESTED);
        assertThat(don.getReturnReason()).isNotBlank();
    }

    @Test
    @DisplayName("Ngày thứ 7 vẫn còn trong hạn (không chặn sớm một ngày)")
    void ngayThu7VanConHan() {
        don.setDeliveredAt(LocalDateTime.now().minusDays(7).plusHours(1));

        assertThatCode(() -> service.requestReturn(1L, 5L, lyDo())).doesNotThrowAnyException();
        assertThat(don.getStatus()).isEqualTo(Order.Status.RETURN_REQUESTED);
    }

    @Test
    @DisplayName("Quá 7 ngày: bị chặn, nêu rõ ngày nhận hàng để khách đối chiếu")
    void quaHanThiChan() {
        don.setDeliveredAt(LocalDateTime.now().minusDays(30));

        assertThatThrownBy(() -> service.requestReturn(1L, 5L, lyDo()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("quá hạn đổi trả")
                .hasMessageContaining("7 ngày");

        assertThat(don.getStatus())
                .as("Đơn phải giữ nguyên trạng thái, không rơi vào RETURN_REQUESTED nửa vời")
                .isEqualTo(Order.Status.DELIVERED);
    }

    @Test
    @DisplayName("Đơn cũ chưa có mốc ngày giao: CỐ Ý không chặn, tránh từ chối oan")
    void donCuKhongCoMocNgayGiaoThiKhongChan() {
        don.setDeliveredAt(null); // đơn tạo trước khi có cột delivered_at

        assertThatCode(() -> service.requestReturn(1L, 5L, lyDo())).doesNotThrowAnyException();
        assertThat(don.getStatus()).isEqualTo(Order.Status.RETURN_REQUESTED);
    }

    @Test
    @DisplayName("Đơn chưa giao thì không yêu cầu trả hàng được, bất kể hạn")
    void donChuaGiaoThiKhongTraDuoc() {
        don.setStatus(Order.Status.SHIPPING);
        don.setDeliveredAt(LocalDateTime.now().minusDays(1));

        assertThatThrownBy(() -> service.requestReturn(1L, 5L, lyDo()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("đã được giao");
    }

    @Test
    @DisplayName("Đơn đã COMPLETED vẫn trả hàng được nếu còn trong hạn")
    void donDaHoanThanhVanTraDuocNeuConHan() {
        don.setStatus(Order.Status.COMPLETED);
        don.setDeliveredAt(LocalDateTime.now().minusDays(2));

        service.requestReturn(1L, 5L, lyDo());

        assertThat(don.getStatus()).isEqualTo(Order.Status.RETURN_REQUESTED);
    }
}
