package com.datn.service;

import com.datn.dto.admin.AdminVoucherDto;
import com.datn.entity.Voucher;
import com.datn.exception.ApiException;
import com.datn.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VoucherService {

    private final VoucherRepository voucherRepository;

    // ================== ADMIN CRUD ==================

    @Transactional(readOnly = true)
    public List<AdminVoucherDto.Response> listAll() {
        return voucherRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional
    public AdminVoucherDto.Response create(AdminVoucherDto.Request request) {
        if (voucherRepository.findByCodeIgnoreCase(request.getCode()).isPresent()) {
            throw ApiException.badRequest("Mã giảm giá đã tồn tại");
        }
        Voucher voucher = new Voucher();
        applyFields(voucher, request);
        voucher.setUsedCount(0);
        return toResponse(voucherRepository.save(voucher));
    }

    @Transactional
    public AdminVoucherDto.Response update(Integer voucherId, AdminVoucherDto.Request request) {
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> ApiException.notFound("Mã giảm giá không tồn tại"));
        applyFields(voucher, request);
        return toResponse(voucherRepository.save(voucher));
    }

    @Transactional
    public void delete(Integer voucherId) {
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> ApiException.notFound("Mã giảm giá không tồn tại"));
        // Soft delete: đơn hàng cũ đã snapshot voucherCode dạng String (không tham
        // chiếu voucher_id) nên xoá cứng KHÔNG vi phạm khoá ngoại, nhưng vẫn chọn
        // ẩn (isActive=false) để giữ lịch sử/thống kê mã đã từng phát hành
        voucher.setIsActive(false);
        voucherRepository.save(voucher);
    }

    // ================== ÁP DỤNG LÚC CHECKOUT ==================

    /**
     * Validate mã giảm giá + tính số tiền được giảm dựa trên subtotal đơn hàng.
     * Được gọi TỪ BÊN TRONG transaction checkout() của OrderService — nếu hợp
     * lệ, hàm này CŨNG TỰ TĂNG usedCount ngay (không tách thành 2 bước), để
     * đảm bảo tính đúng đắn nằm trong CÙNG 1 transaction với việc tạo đơn hàng.
     */
    @Transactional
    public BigDecimal applyVoucher(String code, BigDecimal subtotal) {
        Voucher voucher = voucherRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> ApiException.badRequest("Mã giảm giá không tồn tại"));

        if (!Boolean.TRUE.equals(voucher.getIsActive())) {
            throw ApiException.badRequest("Mã giảm giá đã ngừng hoạt động");
        }

        // DB thật lưu start_date/end_date kiểu DATE (không có giờ) -> so sánh
        // bằng LocalDate.now(), KHÔNG dùng LocalDateTime.now() (sai kiểu, không compile được)
        LocalDate today = LocalDate.now();
        if (voucher.getStartDate() != null && today.isBefore(voucher.getStartDate())) {
            throw ApiException.badRequest("Mã giảm giá chưa tới thời gian áp dụng");
        }
        if (voucher.getEndDate() != null && today.isAfter(voucher.getEndDate())) {
            throw ApiException.badRequest("Mã giảm giá đã hết hạn");
        }
        // usedCount có thể NULL nếu DB chưa chạy migration bổ sung cột này -> coi như 0
        int currentUsedCount = voucher.getUsedCount() != null ? voucher.getUsedCount() : 0;
        if (voucher.getUsageLimit() != null && currentUsedCount >= voucher.getUsageLimit()) {
            throw ApiException.badRequest("Mã giảm giá đã hết lượt sử dụng");
        }
        if (voucher.getMinOrderValue() != null && subtotal.compareTo(voucher.getMinOrderValue()) < 0) {
            throw ApiException.badRequest(
                    "Đơn hàng cần tối thiểu " + voucher.getMinOrderValue() + " để áp dụng mã này");
        }

        BigDecimal discount;
        if (voucher.getDiscountType() == Voucher.DiscountType.PERCENT) {
            discount = subtotal.multiply(voucher.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            // Chặn giảm quá mức trần dù % cao (vd giảm 50% nhưng tối đa 100k)
            if (voucher.getMaxDiscountAmount() != null && discount.compareTo(voucher.getMaxDiscountAmount()) > 0) {
                discount = voucher.getMaxDiscountAmount();
            }
        } else {
            discount = voucher.getDiscountValue();
        }

        // Số tiền giảm KHÔNG BAO GIỜ vượt quá tổng tiền hàng (tránh subtotal âm)
        if (discount.compareTo(subtotal) > 0) {
            discount = subtotal;
        }

        voucher.setUsedCount(currentUsedCount + 1);
        voucherRepository.save(voucher);

        return discount;
    }

    private void applyFields(Voucher voucher, AdminVoucherDto.Request request) {
        voucher.setCode(request.getCode().trim().toUpperCase());
        voucher.setDiscountType(request.getDiscountType());
        voucher.setDiscountValue(request.getDiscountValue());
        voucher.setMinOrderValue(request.getMinOrderValue());
        voucher.setMaxDiscountAmount(request.getMaxDiscountAmount());
        voucher.setStartDate(request.getStartDate());
        voucher.setEndDate(request.getEndDate());
        voucher.setUsageLimit(request.getUsageLimit());
        voucher.setIsActive(request.getIsActive() != null ? request.getIsActive() : true);
    }

    private AdminVoucherDto.Response toResponse(Voucher v) {
        return AdminVoucherDto.Response.builder()
                .voucherId(v.getVoucherId())
                .code(v.getCode())
                .discountType(v.getDiscountType())
                .discountValue(v.getDiscountValue())
                .minOrderValue(v.getMinOrderValue())
                .maxDiscountAmount(v.getMaxDiscountAmount())
                .startDate(v.getStartDate())
                .endDate(v.getEndDate())
                .usageLimit(v.getUsageLimit())
                .usedCount(v.getUsedCount())
                .isActive(v.getIsActive())
                .build();
    }
}