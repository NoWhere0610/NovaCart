package com.datn.repository;

import com.datn.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Page<Order> findByUser_UserId(Long userId, Pageable pageable);

    @EntityGraph(attributePaths = { "items" })
    Optional<Order> findByOrderIdAndUser_UserId(Long orderId, Long userId);

    // Trang quản trị: lọc theo trạng thái, không giới hạn theo user.
    Page<Order> findByStatus(Order.Status status, Pageable pageable);

    // ----- POS (bán tại quầy) -----
    Page<Order> findByOrderTypeAndStatus(Order.OrderType orderType, Order.Status status, Pageable pageable);

    @EntityGraph(attributePaths = { "items" })
    Optional<Order> findByOrderIdAndOrderType(Long orderId, Order.OrderType orderType);

    // ----- Thống kê -----
    @EntityGraph(attributePaths = { "items" })
    List<Order> findByStatusInAndCreatedAtBetween(
            List<Order.Status> statuses, LocalDateTime from, LocalDateTime to);
}