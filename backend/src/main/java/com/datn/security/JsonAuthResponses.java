package com.datn.security;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * Ghi JSON body cho lỗi 401/403 phát ra TỪ TẦNG ROUTE (AuthenticationEntryPoint/AccessDeniedHandler
 * trong SecurityConfig) -- mặc định Spring Security trả body RỖNG ở tầng này, khiến frontend không đọc
 * được message thật (khác 403 phát ra từ @PreAuthorize ở tầng method, đã có body qua GlobalExceptionHandler).
 * Cùng format {@link com.datn.dto.ApiError} để frontend xử lý nhất quán dù lỗi phát sinh ở tầng nào.
 */
public final class JsonAuthResponses {

    private JsonAuthResponses() {
    }

    public static void writeJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(
                "{\"status\":" + status + ",\"message\":\"" + message + "\",\"fieldErrors\":null}");
    }
}
