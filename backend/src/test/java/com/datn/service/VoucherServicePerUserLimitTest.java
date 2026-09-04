package com.datn.service;

import com.datn.entity.Voucher;
import com.datn.entity.VoucherUsage;
import com.datn.exception.ApiException;
import com.datn.repository.VoucherRepository;
import com.datn.repository.VoucherUsageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Giới hạn "mỗi khách chỉ dùng mỗi mã một lần".
 *
 * VẤN ĐỀ TRƯỚC ĐÓ: Voucher chỉ có usedCount -- một con số đếm TỔNG, không biết ai đã dùng. Mã đặt
 * usageLimit = 100 nhằm phục vụ 100 khách thì một người hoàn toàn có thể tự dùng hết cả 100 lượt. Nhìn
 * màn hình quản trị không thấy gì bất thường: usedCount vẫn tăng đều tới 100 đúng như dự kiến.
 *
 * Hai ca dễ làm sai nhất được khoá riêng ở đây:
 *   - Đơn bán tại quầy (userId null) KHÔNG được vướng giới hạn, cũng không được ghi dấu
 *   - Huỷ đơn phải TRẢ LẠI quyền dùng, nếu không khách mất mã vĩnh viễn vì một đơn không mua được gì
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class VoucherServicePerUserLimitTest {

    private static final String MA = "SALE50";
    private static final long KHACH = 7L;
    private static final BigDecimal TIEN_HANG = BigDecimal.valueOf(500_000);

    @Mock VoucherRepository voucherRepository;
    @Mock VoucherUsageRepository voucherUsageRepository;
    @InjectMocks VoucherService service;

    private Voucher voucher;

    @BeforeEach
    void setUp() {
        voucher = new Voucher();
        voucher.setVoucherId(3);
        voucher.setCode(MA);
        voucher.setDiscountType(Voucher.DiscountType.AMOUNT);
        voucher.setDiscountValue(BigDecimal.valueOf(50_000));
        voucher.setIsActive(true);
        voucher.setUsedCount(0);
        voucher.setUsageLimit(100);
        voucher.setStartDate(LocalDate.now().minusDays(1));
        voucher.setEndDate(LocalDate.now().plusDays(30));

        when(voucherRepository.findByCodeIgnoreCase(MA)).thenReturn(Optional.of(voucher));
        when(voucherRepository.findByCodeIgnoreCaseForUpdate(MA)).thenReturn(Optional.of(voucher));
        when(voucherRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(voucherUsageRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private void daDung(boolean roi) {
        when(voucherUsageRepository.existsByVoucher_VoucherIdAndUser_UserId(anyInt(), anyLong()))
                .thenReturn(roi);
    }

    // ===================== Áp mã =====================

    @Test
    @DisplayName("Lần đầu: áp được, và có GHI DẤU đúng người + đúng đơn")
    void lanDau_apDuocVaGhiDau() {
        daDung(false);

        BigDecimal giam = service.applyVoucher(MA, TIEN_HANG, KHACH, "DH123");

        assertThat(giam).isEqualByComparingTo(BigDecimal.valueOf(50_000));
        ArgumentCaptor<VoucherUsage> captor = ArgumentCaptor.forClass(VoucherUsage.class);
        verify(voucherUsageRepository).save(captor.capture());
        assertThat(captor.getValue().getUser().getUserId()).isEqualTo(KHACH);
        assertThat(captor.getValue().getVoucher().getVoucherId()).isEqualTo(3);
        assertThat(captor.getValue().getOrderCode()).isEqualTo("DH123");
        // usedCount toàn cục vẫn phải tăng như cũ -- giới hạn theo người là lớp CHẶN THÊM, không thay thế.
        assertThat(voucher.getUsedCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("Lần hai của CÙNG một khách: bị từ chối, không cộng usedCount")
    void lanHai_biTuChoi() {
        daDung(true);

        assertThatThrownBy(() -> service.applyVoucher(MA, TIEN_HANG, KHACH, "DH456"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("đã sử dụng mã giảm giá này rồi");

        // Từ chối rồi mà vẫn cộng usedCount thì mã hết lượt dần vì những lần dùng không thành công.
        assertThat(voucher.getUsedCount()).isZero();
        verify(voucherUsageRepository, never()).save(any());
    }

    @Test
    @DisplayName("Xem trước cũng chặn ngay, không đợi tới lúc bấm Đặt hàng")
    void xemTruoc_chanNgay() {
        daDung(true);

        // Để tới lúc đặt hàng mới báo thì khách đã nhìn một tổng tiền không có thật suốt màn thanh toán.
        assertThatThrownBy(() -> service.previewDiscount(MA, TIEN_HANG, KHACH))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("đã sử dụng mã giảm giá này rồi");
    }

    @Test
    @DisplayName("Khách KHÁC vẫn dùng được bình thường")
    void khachKhac_vanDungDuoc() {
        when(voucherUsageRepository.existsByVoucher_VoucherIdAndUser_UserId(3, KHACH)).thenReturn(true);
        when(voucherUsageRepository.existsByVoucher_VoucherIdAndUser_UserId(3, 99L)).thenReturn(false);

        assertThatCode(() -> service.applyVoucher(MA, TIEN_HANG, 99L, "DH789"))
                .doesNotThrowAnyException();
    }

    // ===================== Bán tại quầy =====================

    @Test
    @DisplayName("Hoá đơn quầy (không có tài khoản khách): KHÔNG vướng giới hạn, KHÔNG ghi dấu")
    void banTaiQuay_khongVuongGioiHan() {
        daDung(true); // dù có ai đó từng dùng đi nữa

        // Hoá đơn POS không gắn tài khoản khách nào (khách vãng lai) nên không có "người" để giới hạn.
        // Bỏ sót nhánh null ở đây sẽ làm thu ngân không áp được mã cho bất kỳ khách nào.
        assertThatCode(() -> service.applyVoucher(MA, TIEN_HANG, null, "HD001"))
                .doesNotThrowAnyException();

        verify(voucherUsageRepository, never()).save(any());
        assertThat(voucher.getUsedCount()).isEqualTo(1);
    }

    // ===================== Huỷ đơn =====================

    @Test
    @DisplayName("Huỷ đơn: trả lại quyền dùng mã cho ĐÚNG người đó")
    void huyDon_traLaiQuyenDung() {
        service.revertVoucherUsage(MA, KHACH);

        // Không xoá dấu thì khách mất mã vĩnh viễn vì một đơn họ không hề mua được gì.
        verify(voucherUsageRepository).xoaDauDaDung(3, KHACH);
    }

    @Test
    @DisplayName("Huỷ hoá đơn quầy: chỉ trừ usedCount, không có dấu nào để xoá")
    void huyHoaDonQuay() {
        voucher.setUsedCount(5);

        service.revertVoucherUsage(MA, null);

        verify(voucherUsageRepository, never()).xoaDauDaDung(anyInt(), anyLong());
        assertThat(voucher.getUsedCount()).isEqualTo(4);
    }

    @Test
    @DisplayName("Mã rỗng/null: không làm gì, không ném lỗi")
    void maRong_khongLamGi() {
        assertThatCode(() -> service.revertVoucherUsage(null, KHACH)).doesNotThrowAnyException();
        assertThatCode(() -> service.revertVoucherUsage("  ", KHACH)).doesNotThrowAnyException();
        verify(voucherUsageRepository, never()).xoaDauDaDung(anyInt(), eq(KHACH));
    }
}
