package com.datn.security;

/**
 * Toàn bộ "quyền" có thể bật/tắt riêng cho role STAFF (Nhân viên) — nguồn xác định duy nhất. Role ADMIN
 * KHÔNG nằm trong danh sách này -- Admin luôn có full quyền, không qua bảng role_permission, để không dữ
 * liệu sai nào trong DB có thể khoá mất quyền admin. Module Kho tồn hàng/Người dùng cố tình KHÔNG có mặt
 * ở đây -- vẫn khoá cứng chỉ ADMIN ở SecurityConfig, không cho Nhân viên dù ma trận có bật gì.
 */
public enum PermissionKey {
    POS_USE,
    ORDER_VIEW,
    ORDER_UPDATE_STATUS,
    PRODUCT_VIEW,
    PRODUCT_WRITE,
    PRODUCT_DELETE,
    CATEGORY_BRAND_VIEW,
    CATEGORY_BRAND_WRITE,
    CATEGORY_BRAND_DELETE,
    VOUCHER_VIEW,
    VOUCHER_WRITE,
    VOUCHER_DELETE,
    STATISTICS_VIEW
}
