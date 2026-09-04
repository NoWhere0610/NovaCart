package com.datn.security;

import com.datn.entity.RolePermission;
import com.datn.repository.RolePermissionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Ma trận phân quyền Nhân viên. Sai ở đây nghĩa là hoặc nhân viên làm được việc không được phép, hoặc
 * admin bị chặn khỏi chính hệ thống của mình.
 *
 * Đặt Authentication thẳng vào SecurityContextHolder thay vì dựng Spring Security context -- PermissionService
 * chỉ đọc danh sách quyền từ đó, không cần gì thêm.
 */
@ExtendWith(MockitoExtension.class)
class PermissionServiceTest {

    @Mock
    RolePermissionRepository rolePermissionRepository;
    @InjectMocks
    PermissionService service;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void dangNhapVoiVaiTro(String... roles) {
        var authorities = List.of(roles).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("u", "p", authorities));
    }

    /** Nạp cache quyền STAFF đúng như PermissionService.refresh() làm lúc khởi động. */
    private void maTranStaff(String... grantedCodes) {
        List<RolePermission> rows = new java.util.ArrayList<>();
        for (PermissionKey key : PermissionKey.values()) {
            boolean granted = List.of(grantedCodes).contains(key.name());
            rows.add(new RolePermission("STAFF", key.name(), granted));
        }
        when(rolePermissionRepository.findByRoleName("STAFF")).thenReturn(rows);
        service.refresh();
    }

    @Test
    @DisplayName("Admin luôn có mọi quyền, không đi qua bảng ma trận")
    void adminLuonCoMoiQuyen() {
        maTranStaff(); // ma trận STAFF trống hoàn toàn
        dangNhapVoiVaiTro("ROLE_ADMIN");

        for (PermissionKey key : PermissionKey.values()) {
            assertThat(service.has(key.name())).as("Admin phải có quyền %s", key).isTrue();
        }
        assertThat(service.isCurrentUserAdmin()).isTrue();
    }

    @Test
    @DisplayName("Nhân viên chỉ có đúng những quyền đang bật trong ma trận")
    void nhanVienChiCoQuyenDangBat() {
        maTranStaff(PermissionKey.PRODUCT_VIEW.name(), PermissionKey.ORDER_VIEW.name());
        dangNhapVoiVaiTro("ROLE_STAFF");

        assertThat(service.has(PermissionKey.PRODUCT_VIEW.name())).isTrue();
        assertThat(service.has(PermissionKey.ORDER_VIEW.name())).isTrue();
        assertThat(service.has(PermissionKey.PRODUCT_WRITE.name())).isFalse();
        assertThat(service.has(PermissionKey.STATISTICS_VIEW.name())).isFalse();
        assertThat(service.isCurrentUserAdmin())
                .as("Nhân viên KHÔNG được coi là admin -- đây là thứ chặn họ sửa tồn kho qua form sản phẩm")
                .isFalse();
    }

    @Test
    @DisplayName("Chưa đăng nhập thì không có quyền nào")
    void chuaDangNhapThiKhongCoQuyen() {
        maTranStaff(PermissionKey.PRODUCT_VIEW.name());
        SecurityContextHolder.clearContext();

        assertThat(service.has(PermissionKey.PRODUCT_VIEW.name())).isFalse();
        assertThat(service.isCurrentUserAdmin()).isFalse();
    }

    @Test
    @DisplayName("Khách hàng thường (ROLE_USER) không chạm được quyền quản trị nào")
    void khachHangThuongKhongCoQuyenQuanTri() {
        maTranStaff(PermissionKey.PRODUCT_VIEW.name());
        dangNhapVoiVaiTro("ROLE_USER");

        for (PermissionKey key : PermissionKey.values()) {
            assertThat(service.has(key.name())).as("ROLE_USER không được có quyền %s", key).isFalse();
        }
    }

    @Test
    @DisplayName("Mã quyền lạ (gõ sai trong @PreAuthorize) trả false với nhân viên, không ném lỗi")
    void maQuyenLaTraFalseVoiNhanVien() {
        maTranStaff(PermissionKey.PRODUCT_VIEW.name());
        dangNhapVoiVaiTro("ROLE_STAFF");

        assertThat(service.has("KHONG_TON_TAI")).isFalse();
    }

    @Test
    @DisplayName("refresh() nạp lại ma trận -- admin bật quyền là nhân viên dùng được ngay")
    void refreshNapLaiMaTran() {
        maTranStaff(); // ban đầu không có quyền nào
        dangNhapVoiVaiTro("ROLE_STAFF");
        assertThat(service.has(PermissionKey.PRODUCT_WRITE.name())).isFalse();

        maTranStaff(PermissionKey.PRODUCT_WRITE.name()); // admin bật quyền + refresh
        assertThat(service.has(PermissionKey.PRODUCT_WRITE.name())).isTrue();
    }
}
