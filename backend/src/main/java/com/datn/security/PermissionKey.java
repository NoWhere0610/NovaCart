package com.datn.security;

/**
 * Toàn bộ "quyền" có thể bật/tắt riêng cho role STAFF (Nhân viên) — nguồn xác định duy nhất. Role ADMIN
 * KHÔNG nằm trong danh sách này -- Admin luôn có full quyền, không qua bảng role_permission, để không dữ
 * liệu sai nào trong DB có thể khoá mất quyền admin. Module Kho tồn hàng/Người dùng cố tình KHÔNG có mặt
 * ở đây -- vẫn khoá cứng chỉ ADMIN ở SecurityConfig, không cho Nhân viên dù ma trận có bật gì.
 *
 * Mỗi quyền mang kèm nhãn + nhóm tiếng Việt để trang "Phân quyền nhân viên" render được ma trận mà
 * frontend không phải tự dịch lại từng mã (thêm quyền mới chỉ cần sửa đúng ở đây).
 */
public enum PermissionKey {

    POS_USE("Bán hàng tại quầy", "Sử dụng màn hình POS (tạo/thanh toán hoá đơn tại quầy)"),

    ORDER_VIEW("Đơn hàng", "Xem danh sách & chi tiết đơn hàng online"),
    ORDER_UPDATE_STATUS("Đơn hàng", "Cập nhật trạng thái đơn, xác nhận đã nhận chuyển khoản"),

    PRODUCT_VIEW("Sản phẩm", "Xem danh sách & chi tiết sản phẩm"),
    PRODUCT_WRITE("Sản phẩm", "Thêm / sửa sản phẩm (KHÔNG bao gồm sửa tồn kho -- luôn chỉ Admin)"),
    PRODUCT_DELETE("Sản phẩm", "Ẩn (xoá) sản phẩm"),

    CATEGORY_BRAND_VIEW("Danh mục & Thương hiệu", "Xem danh mục và thương hiệu"),
    CATEGORY_BRAND_WRITE("Danh mục & Thương hiệu", "Thêm / sửa danh mục và thương hiệu"),
    CATEGORY_BRAND_DELETE("Danh mục & Thương hiệu", "Xoá danh mục và thương hiệu"),

    VOUCHER_VIEW("Mã giảm giá", "Xem danh sách mã giảm giá"),
    VOUCHER_WRITE("Mã giảm giá", "Thêm / sửa mã giảm giá"),
    VOUCHER_DELETE("Mã giảm giá", "Xoá mã giảm giá"),

    STATISTICS_VIEW("Thống kê", "Xem báo cáo doanh thu và thống kê bán hàng");

    private final String group;
    private final String label;

    PermissionKey(String group, String label) {
        this.group = group;
        this.label = label;
    }

    public String getGroup() {
        return group;
    }

    public String getLabel() {
        return label;
    }
}
