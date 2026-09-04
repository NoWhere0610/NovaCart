package com.datn.repository;

import com.datn.entity.VoucherUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VoucherUsageRepository extends JpaRepository<VoucherUsage, Long> {

    boolean existsByVoucher_VoucherIdAndUser_UserId(Integer voucherId, Long userId);

    /**
     * Xoá dấu đã dùng khi đơn bị huỷ/trả hàng -- trả lại quyền dùng mã cho khách.
     *
     * Trả về số dòng đã xoá để bên gọi biết có thực sự xoá được không: 0 nghĩa là khách chưa từng được
     * ghi nhận dùng mã này (vd đơn cũ tạo trước khi có bảng), lúc đó KHÔNG được trừ usedCount toàn cục
     * kẻo con số đó tụt xuống dưới thực tế sau vài lần huỷ.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM VoucherUsage vu WHERE vu.voucher.voucherId = :voucherId AND vu.user.userId = :userId")
    int xoaDauDaDung(@Param("voucherId") Integer voucherId, @Param("userId") Long userId);
}
