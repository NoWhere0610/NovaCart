package com.datn.repository;

import com.datn.entity.Voucher;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface VoucherRepository extends JpaRepository<Voucher, Integer> {
    Optional<Voucher> findByCodeIgnoreCase(String code);

    // Dùng đúng lúc THỰC SỰ áp mã (applyVoucher, tăng usedCount) -- khoá row tới hết transaction, tránh
    // 2 đơn cùng lúc đọc trùng usedCount rồi cùng qua được kiểm tra usageLimit (giống findByIdForUpdate
    // của ProductVariantRepository). KHÔNG dùng cho previewDiscount (chỉ đọc, không cần khoá).
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM Voucher v WHERE LOWER(v.code) = LOWER(:code)")
    Optional<Voucher> findByCodeIgnoreCaseForUpdate(@Param("code") String code);
}