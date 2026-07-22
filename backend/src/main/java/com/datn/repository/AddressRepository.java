package com.datn.repository;

import com.datn.entity.Address;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AddressRepository extends JpaRepository<Address, Long> {

    // Danh sách địa chỉ của 1 user (trang "Sổ địa chỉ" của khách hàng)
    List<Address> findByUser_UserId(Long userId);

    // Địa chỉ mặc định hiện tại của user, dùng để gỡ cờ is_default khi user
    // đặt 1 địa chỉ khác làm mặc định (đảm bảo chỉ có 1 default/user)
    Optional<Address> findByUser_UserIdAndIsDefaultTrue(Long userId);
}