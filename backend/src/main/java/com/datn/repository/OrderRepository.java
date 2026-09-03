package com.datn.repository;

import com.datn.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    // "Quản lý đơn hàng" (AdminOrderService) chỉ quản lý đơn ONLINE -- đơn POS có luồng/trạng thái
    // riêng (trừ kho ngay lúc thêm item), quản lý chung sẽ trừ kho 2 lần + khoá cứng hoá đơn POS.
    Page<Order> findByOrderType(Order.OrderType orderType, Pageable pageable);

    @EntityGraph(attributePaths = { "items" })
    Optional<Order> findByOrderIdAndOrderType(Long orderId, Order.OrderType orderType);

    // ----- Thống kê -----
    /**
     * Giống findByStatusInAndCreatedAtBetween() cho các trạng thái "tĩnh" (COMPLETED/CANCELLED/
     * RETURN_REQUESTED -- lọc theo createdAt như cũ), NHƯNG đơn RETURNED được lọc theo returnedAt (thời
     * điểm THỰC SỰ hoàn trả) thay vì createdAt -- 1 đơn tạo tháng 7, trả hàng tháng 9 phải xuất hiện ở
     * báo cáo tháng 9, không phải tháng 7. Đơn RETURNED cũ chưa có returnedAt (tạo trước khi thêm cột
     * này) fallback về createdAt để không biến mất khỏi mọi báo cáo.
     */
    // Nạp sẵn cả product/category/brand của từng dòng hàng -- thống kê luôn phải duyệt tới category/brand
    // (gộp doanh thu theo danh mục, lọc theo thương hiệu). Để LAZY thì mỗi dòng hàng sinh thêm 2-3 query
    // lẻ: 1 kỳ 5.000 đơn có thể thành hơn 20.000 query cho 1 lần bấm nút, và còn chạy lại lần nữa cho kỳ
    // so sánh. Chỉ 1 collection (items) được fetch nên không dính lỗi MultipleBagFetchException.
    @EntityGraph(attributePaths = {
            "items", "items.variant", "items.variant.product",
            "items.variant.product.category", "items.variant.product.brand" })
    @Query("SELECT o FROM Order o WHERE " +
            "(o.status IN :otherStatuses AND o.createdAt BETWEEN :from AND :to) " +
            "OR (o.status = :returnedStatus AND (" +
            "    (o.returnedAt IS NOT NULL AND o.returnedAt BETWEEN :from AND :to) " +
            "    OR (o.returnedAt IS NULL AND o.createdAt BETWEEN :from AND :to)))")
    List<Order> findForStatistics(
            @Param("otherStatuses") List<Order.Status> otherStatuses,
            @Param("returnedStatus") Order.Status returnedStatus,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);
}