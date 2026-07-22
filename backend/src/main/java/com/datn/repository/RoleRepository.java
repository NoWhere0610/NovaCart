package com.datn.repository;

import com.datn.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Integer> {

    // Dùng để lấy role mặc định (CUSTOMER) gán cho user mới đăng ký
    Optional<Role> findByRoleName(String roleName);
}