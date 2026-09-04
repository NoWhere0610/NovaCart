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

    // order_items.variant_id là FK KHÔNG có ON DELETE CASCADE -> xoá 1 biến thể đã từng được đặt hàng sẽ
    // bị DB chặn. Kiểm tra trước để báo đúng bản chất ("đã phát sinh đơn hàng") thay vì để
    // DataIntegrityViolationException rơi vào handler chung và trả về thông báo trùng lặp khó hiểu.
    boolean existsByVariant_VariantId(Long variantId);
}