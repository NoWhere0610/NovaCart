package com.datn.service;

import com.datn.entity.Brand;
import com.datn.entity.Category;
import com.datn.entity.Order;
import com.datn.entity.OrderItem;
import com.datn.entity.Product;
import com.datn.entity.ProductVariant;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Dựng sẵn đồ thị Order -> OrderItem -> ProductVariant -> Product -> Category/Brand cho các test thống kê.
 *
 * Toàn bộ phần tính tiền của AdminStatisticsService là hàm thuần chạy trên đồ thị này trong bộ nhớ, nên
 * chỉ cần dựng đúng đồ thị là test được mà không cần Spring context hay cơ sở dữ liệu. Chi phí thật của
 * việc test lớp đó nằm ở việc dựng đồ thị -- gom về đây một chỗ để mỗi test chỉ còn 3-4 dòng.
 */
final class StatsFixtures {

    private StatsFixtures() {
    }

    static Category cat(int id, String name, Category parent) {
        Category c = new Category();
        c.setCategoryId(id);
        c.setCategoryName(name);
        c.setParent(parent);
        return c;
    }

    static Brand brand(int id, String name) {
        Brand b = new Brand();
        b.setBrandId(id);
        b.setBrandName(name);
        return b;
    }

    /** Giá mặc định của sản phẩm trong fixture -- POS lấy giá từ đây (CartService.effectivePrice), còn
     *  các test thống kê thì lấy từ subtotal của dòng hàng nên không phụ thuộc con số này. */
    static final long GIA_MAC_DINH = 100_000L;

    static ProductVariant variant(long productId, String productName, Category category, Brand brand) {
        Product p = new Product();
        p.setProductId(productId);
        p.setProductName(productName);
        p.setCategory(category);
        p.setBrand(brand);
        p.setStatus(Product.Status.ACTIVE);
        p.setPrice(BigDecimal.valueOf(GIA_MAC_DINH));
        ProductVariant v = new ProductVariant();
        v.setVariantId(productId * 100);
        v.setProduct(p);
        v.setSize("M");
        v.setColor("Đen");
        return v;
    }

    static OrderItem item(ProductVariant variant, int quantity, long unitPrice) {
        OrderItem i = new OrderItem();
        i.setVariant(variant);
        i.setProductName(variant.getProduct().getProductName());
        i.setSize(variant.getSize());
        i.setColor(variant.getColor());
        i.setUnitPrice(BigDecimal.valueOf(unitPrice));
        i.setQuantity(quantity);
        i.setSubtotal(BigDecimal.valueOf(unitPrice * quantity));
        return i;
    }

    /**
     * Đơn ONLINE đã COMPLETED, COD và ĐÃ THU ĐƯỢC TIỀN -- mặc định này được tính là doanh thu đã thực
     * nhận (isRealizedRevenue), để test nào không quan tâm phương thức thanh toán thì khỏi phải khai.
     *
     * paymentStatus phải là PAID: trước đây để UNPAID vẫn qua được vì isRealizedRevenue có ngoại lệ
     * "COD thì luôn tính" -- ngoại lệ đó tồn tại chỉ vì hệ thống chưa có bước xác nhận đã thu tiền mặt.
     * Nay COD có bước xác nhận riêng nên quy tắc chung là "khác UNPAID mới tính", và một đơn COD đã bán
     * xong trong đời thật thì phải là PAID. Test nào cần ca "chưa thu được tiền" thì tự đặt lại UNPAID
     * (xem khongTinhDoanhThuHoaDonChuyenKhoanChuaThuTien).
     */
    static Order order(LocalDateTime createdAt, long totalAmount, OrderItem... items) {
        Order o = new Order();
        o.setCreatedAt(createdAt);
        o.setStatus(Order.Status.COMPLETED);
        o.setOrderType(Order.OrderType.ONLINE);
        o.setPaymentMethod(Order.PaymentMethod.COD);
        o.setPaymentStatus(Order.PaymentStatus.PAID);
        o.setTotalAmount(BigDecimal.valueOf(totalAmount));
        o.setItems(new ArrayList<>(List.of(items)));
        for (OrderItem i : o.getItems()) {
            i.setOrder(o);
        }
        return o;
    }
}
