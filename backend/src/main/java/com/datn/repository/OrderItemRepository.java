package com.datn.repository;

import com.datn.entity.Order;
import com.datn.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    boolean existsByOrder_User_UserIdAndOrder_StatusAndVariant_Product_ProductId(
            Long userId, Order.Status status, Long productId);
}