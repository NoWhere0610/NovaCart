package com.datn.repository;

import com.datn.entity.Address;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AddressRepository extends JpaRepository<Address, Long> {

    List<Address> findByUser_UserId(Long userId);

    // Địa chỉ mặc định hiện tại, dùng để gỡ cờ is_default khi đổi default (đảm bảo chỉ 1 default/user).
    Optional<Address> findByUser_UserIdAndIsDefaultTrue(Long userId);
}