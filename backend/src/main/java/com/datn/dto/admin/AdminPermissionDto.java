package com.datn.dto.admin;

import jakarta.validation.constraints.NotEmpty;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

/** DTO cho trang "Phân quyền nhân viên" -- ma trận quyền của role STAFF. */
public class AdminPermissionDto {

    /** 1 dòng trong ma trận: 1 quyền đang bật/tắt cho STAFF. */
    @Getter
    @Builder
    public static class Item {
        private String code;
        private String group;
        private String label;
        private boolean granted;
    }

    /** Body của PUT: map mã quyền -> bật/tắt. Chỉ cần gửi những quyền muốn đổi, mã lạ sẽ bị bỏ qua. */
    @Getter
    @Setter
    public static class UpdateRequest {
        @NotEmpty(message = "Chưa có quyền nào được gửi lên")
        private Map<String, Boolean> permissions;
    }
}
