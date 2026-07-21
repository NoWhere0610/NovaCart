package com.datn.repository;

import com.datn.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    // Trang "Đơn hàng của tôi" - phân trang, mới nhất lên đầu (xem OrderService)
    Page<Order> findByUser_UserId(Long userId, Pageable pageable);

    @EntityGraph(attributePaths = { "items" })
    Optional<Order> findByOrderIdAndUser_UserId(Long orderId, Long userId);

    // Dùng cho trang quản trị: lọc theo trạng thái (không giới hạn theo user cụ
    // thể)
    Page<Order> findByStatus(Order.Status status, Pageable pageable);
}