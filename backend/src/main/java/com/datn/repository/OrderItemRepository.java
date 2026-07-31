package com.datn.repository;

import com.datn.entity.Order;
import com.datn.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    boolean existsByOrder_User_UserIdAndOrder_StatusAndVariant_Product_ProductId(
            Long userId, Order.Status status, Long productId);

    // Dùng cho điều kiện được phép đánh giá: chỉ cần đơn đã tới trạng thái
    // "đã giao" (DELIVERED - cần đánh giá) hoặc xa hơn (COMPLETED) là đủ,
    // không cần đợi khách xác nhận Hoàn thành mới cho đánh giá.
    boolean existsByOrder_User_UserIdAndOrder_StatusInAndVariant_Product_ProductId(
            Long userId, Collection<Order.Status> statuses, Long productId);

    java.util.Optional<OrderItem> findByOrderItemIdAndOrder_OrderId(Long orderItemId, Long orderId);
}