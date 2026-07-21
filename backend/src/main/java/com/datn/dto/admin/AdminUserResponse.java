package com.datn.dto.admin;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class AdminUserResponse {
    private Long userId;
    private String username;
    private String email;
    private String fullName;
    private String phone;
    private Boolean isActive;
    private List<String> roles;
    private LocalDateTime createdAt;
}