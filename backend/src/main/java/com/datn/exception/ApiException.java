package com.datn.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Exception nghiệp vụ dùng chung (username trùng, không tìm thấy resource,
 * không có quyền thao tác...). Ném exception này ở Service, GlobalExceptionHandler
 * sẽ tự bắt và convert thành ApiError JSON đúng HTTP status tương ứng.
 */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, message);
    }
}