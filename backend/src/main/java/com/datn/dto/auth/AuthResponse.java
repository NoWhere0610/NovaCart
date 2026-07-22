package com.datn.dto.auth;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * Response trả về sau khi login/register thành công.
 * Frontend sẽ lưu accessToken (localStorage) và gắn vào header Authorization
 * cho các request tiếp theo: "Authorization: Bearer <accessToken>".
 */
@Getter
@Builder
public class AuthResponse {
    private String accessToken;
    private Long userId;
    private String username;
    private String email;
    private String fullName;
    private List<String> roles;
}