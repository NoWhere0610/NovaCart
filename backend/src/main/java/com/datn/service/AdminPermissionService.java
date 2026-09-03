package com.datn.service;

import com.datn.dto.admin.AdminPermissionDto;
import com.datn.entity.RolePermission;
import com.datn.exception.ApiException;
import com.datn.repository.RolePermissionRepository;
import com.datn.security.PermissionKey;
import com.datn.security.PermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Quản lý ma trận quyền của role STAFF cho trang "Phân quyền nhân viên" (chỉ ADMIN vào được, xem
 * SecurityConfig). Việc KIỂM TRA quyền lúc chạy nằm ở {@link PermissionService} -- ở đây chỉ đọc/ghi
 * cấu hình rồi gọi refresh() để cache trong RAM khớp lại với DB ngay, nhân viên không phải đăng nhập lại.
 */
@Service
@RequiredArgsConstructor
public class AdminPermissionService {

    private static final String STAFF_ROLE = "STAFF";

    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionService permissionService;

    /**
     * Trả về ĐỦ mọi quyền khai báo trong {@link PermissionKey} theo đúng thứ tự khai báo (đã nhóm sẵn),
     * không phải chỉ những dòng đang có trong DB -- quyền mới thêm vào enum sau này (bảng đã có dữ liệu
     * nên seed không chạy lại) vẫn hiện ra trong ma trận ở trạng thái tắt để admin tự bật.
     */
    @Transactional(readOnly = true)
    public List<AdminPermissionDto.Item> getStaffMatrix() {
        Map<String, Boolean> grantedByCode = new HashMap<>();
        for (RolePermission row : rolePermissionRepository.findByRoleName(STAFF_ROLE)) {
            grantedByCode.put(row.getPermissionCode(), row.isGranted());
        }

        return Arrays.stream(PermissionKey.values())
                .map(key -> AdminPermissionDto.Item.builder()
                        .code(key.name())
                        .group(key.getGroup())
                        .label(key.getLabel())
                        .granted(Boolean.TRUE.equals(grantedByCode.get(key.name())))
                        .build())
                .toList();
    }

    /** Ghi lại các quyền được gửi lên (upsert -- quyền chưa có dòng nào trong DB thì tạo mới). */
    @Transactional
    public List<AdminPermissionDto.Item> updateStaffMatrix(Map<String, Boolean> permissions) {
        for (Map.Entry<String, Boolean> entry : permissions.entrySet()) {
            PermissionKey key = parseKeyOrThrow(entry.getKey());
            boolean granted = Boolean.TRUE.equals(entry.getValue());
            rolePermissionRepository.save(new RolePermission(STAFF_ROLE, key.name(), granted));
        }

        // Cache quyền nằm trong RAM (PermissionService) -- không refresh thì nhân viên vẫn dùng quyền cũ
        // cho tới lần khởi động lại backend tiếp theo.
        permissionService.refresh();
        return getStaffMatrix();
    }

    private PermissionKey parseKeyOrThrow(String code) {
        try {
            return PermissionKey.valueOf(code);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw ApiException.badRequest("Mã quyền không hợp lệ: " + code);
        }
    }
}
