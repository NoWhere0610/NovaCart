package com.datn.repository;

import com.datn.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // Dùng khi login: cho phép đăng nhập bằng username HOẶC email đều được
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    // Dùng khi đăng ký: kiểm tra trùng trước khi tạo user mới
    boolean existsByUsername(String username);

    boolean existsByEmail(String email);
}