package com.datn.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.Map;

/** Format lỗi trả về THỐNG NHẤT cho toàn bộ API, để frontend xử lý 1 kiểu duy nhất. */
@Getter
@Builder
public class ApiError {
    private LocalDateTime timestamp;
    private int status;
    private String message;
    /** Chi tiết lỗi từng field khi validate thất bại (vd: {"email": "Email không đúng định dạng"}). */
    private Map<String, String> fieldErrors;
}