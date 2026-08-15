package com.datn.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

/**
 * Ma trận phân quyền cho role STAFF (Nhân viên) -- mỗi dòng là 1 quyền (permissionCode, xem
 * {@link com.datn.security.PermissionKey}) đang bật hay tắt. CHỈ chứa dòng cho STAFF; ADMIN không có
 * dòng nào trong bảng này (luôn full quyền, xem PermissionService).
 */
@Entity
@Table(name = "role_permission")
@IdClass(RolePermission.Key.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RolePermission {

    @Id
    @Column(name = "role_name", length = 20)
    private String roleName;

    @Id
    @Column(name = "permission_code", length = 50)
    private String permissionCode;

    @Column(nullable = false)
    private boolean granted;

    @EqualsAndHashCode
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Key implements Serializable {
        private String roleName;
        private String permissionCode;
    }
}
