package com.datn.dto.admin;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * Body của PUT /api/admin/users/{userId}/role.
 *
 * Đặt MỘT vai trò duy nhất chứ không phải danh sách: hệ thống chỉ có 3 vai trò loại trừ nhau
 * (ADMIN / STAFF / CUSTOMER) và mọi chỗ kiểm quyền đều xử lý theo kiểu đó. Cho gán nhiều vai trò cùng
 * lúc là mở ra những tổ hợp chưa ai định nghĩa hành vi.
 */
@Getter
@Setter
public class UpdateUserRoleRequest {

    @NotBlank(message = "Vui lòng chọn vai trò")
    private String roleName;

    public void setRoleName(String v) {
        this.roleName = v == null ? null : v.trim().toUpperCase();
    }
}
