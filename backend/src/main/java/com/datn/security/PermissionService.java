package com.datn.security;

import com.datn.entity.RolePermission;
import com.datn.repository.RolePermissionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Kiểm tra quyền ĐỘNG cho role STAFF (Nhân viên) -- gọi từ @PreAuthorize("@perm.has('...')") ở tầng
 * method của controller, KHÔNG chặn ở tầng route như ADMIN (xem SecurityConfig). Bean tên "perm" để
 * SpEL trong @PreAuthorize gọi được.
 *
 * Cache toàn bộ quyền STAFF đang bật trong RAM (nạp lúc khởi động, refresh() khi có sửa qua UI quản lý
 * ma trận sau này) -- tránh mỗi request admin đều phải query DB.
 */
@Service("perm")
@RequiredArgsConstructor
public class PermissionService {

    private final RolePermissionRepository rolePermissionRepository;

    private volatile Set<String> staffGranted = Set.of();

    @PostConstruct
    void init() {
        seedDefaultsIfEmpty();
        refresh();
    }

    /** Nạp lại cache từ DB -- gọi sau khi UI quản lý ma trận (giai đoạn 2) sửa quyền. */
    public void refresh() {
        staffGranted = rolePermissionRepository.findByRoleName("STAFF").stream()
                .filter(RolePermission::isGranted)
                .map(RolePermission::getPermissionCode)
                .collect(Collectors.toSet());
    }

    /** Admin luôn true (không qua bảng); Staff theo đúng ma trận đang bật; vai trò khác/chưa đăng nhập -> false. */
    public boolean has(String permissionCode) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        Set<String> authorities = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
        if (authorities.contains("ROLE_ADMIN")) return true;
        if (authorities.contains("ROLE_STAFF")) return staffGranted.contains(permissionCode);
        return false;
    }

    /** Chạy 1 lần duy nhất (bảng rỗng, lần đầu deploy) -- điền sẵn đề xuất mặc định: Nhân viên được xem +
     * thao tác nghiệp vụ hàng ngày (bán hàng/đơn hàng), CHƯA được các hành động ảnh hưởng catalog/tiền
     * (sửa-xoá sản phẩm/danh mục/voucher) hay xem doanh thu -- admin tự bật thêm sau nếu muốn (giai đoạn 2). */
    private void seedDefaultsIfEmpty() {
        if (rolePermissionRepository.count() > 0) return;

        Set<PermissionKey> grantedByDefault = EnumSet.of(
                PermissionKey.POS_USE,
                PermissionKey.ORDER_VIEW,
                PermissionKey.ORDER_UPDATE_STATUS,
                PermissionKey.PRODUCT_VIEW,
                PermissionKey.CATEGORY_BRAND_VIEW,
                PermissionKey.VOUCHER_VIEW);

        for (PermissionKey key : PermissionKey.values()) {
            rolePermissionRepository.save(
                    new RolePermission("STAFF", key.name(), grantedByDefault.contains(key)));
        }
    }
}
