package com.datn.repository;

import com.datn.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // Dùng khi login: cho phép đăng nhập bằng username HOẶC email đều được
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    // Dùng khi đăng ký: kiểm tra trùng trước khi tạo user mới
    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    /**
     * Tìm theo email HOẶC tên đăng nhập, không phân biệt hoa thường.
     *
     * Ô tìm ghi là "email" nhưng vẫn khớp cả username: admin gõ vào đó thứ mình nhớ được, và nhớ tên
     * đăng nhập là chuyện rất bình thường. Bắt gõ đúng loại mới ra kết quả là bắt người dùng đoán ý
     * hệ thống.
     */
    @Query("SELECT u FROM User u WHERE LOWER(u.email) LIKE LOWER(CONCAT('%', :tuKhoa, '%')) "
            + "OR LOWER(u.username) LIKE LOWER(CONCAT('%', :tuKhoa, '%'))")
    Page<User> timTheoEmailHoacUsername(@Param("tuKhoa") String tuKhoa, Pageable pageable);

    /** Đếm số tài khoản còn vai trò ADMIN -- dùng để chặn hạ vai trò của admin cuối cùng. */
    @Query("SELECT COUNT(u) FROM User u JOIN u.roles r WHERE r.roleName = 'ADMIN'")
    long demSoAdmin();
}