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
     * Trả về số dòng đã xoá (0 hoặc 1). Bên gọi hiện KHÔNG dùng giá trị này, và đó là đúng: usedCount
     * toàn cục với bảng voucher_usages được duy trì độc lập, cả hai đều đối xứng với applyVoucher. Đơn
     * cũ tạo trước khi có bảng này vẫn đã cộng usedCount lúc áp mã, nên vẫn phải trừ khi huỷ dù không
     * có dòng nào để xoá.
     *
     * (Chú thích cũ ở đây mô tả một biện pháp phòng vệ -- "0 dòng thì không được trừ usedCount" -- mà
     * mã gọi không hề thực hiện. Bản soát độc lập chỉ ra điều này và cũng xác nhận không dựng được
     * kịch bản gây hại; sửa chú thích cho khớp mã thay vì thêm một nhánh không cần thiết.)
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM VoucherUsage vu WHERE vu.voucher.voucherId = :voucherId AND vu.user.userId = :userId")
    int xoaDauDaDung(@Param("voucherId") Integer voucherId, @Param("userId") Long userId);
}
