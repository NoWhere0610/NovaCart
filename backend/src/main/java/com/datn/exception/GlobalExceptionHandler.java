package com.datn.exception;

import com.datn.dto.ApiError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Bắt toàn bộ exception từ Controller/Service ở một nơi duy nhất -- response lỗi
 * đồng nhất format cho frontend, Controller không cần tự try-catch.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // Lỗi nghiệp vụ tự định nghĩa (username trùng, not found...)
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex) {
        return ResponseEntity.status(ex.getStatus()).body(buildError(ex.getStatus(), ex.getMessage(), null));
    }

    // Sai username/password khi login (Spring Security ném exception này)
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(buildError(HttpStatus.UNAUTHORIZED, "Tên đăng nhập hoặc mật khẩu không đúng", null));
    }

    // Lỗi @Valid ở request DTO (vd: @NotBlank, @Email...) -> trả kèm chi tiết lỗi từng field
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(err -> fieldErrors.put(err.getField(), err.getDefaultMessage()));
        return ResponseEntity.badRequest()
                .body(buildError(HttpStatus.BAD_REQUEST, "Dữ liệu không hợp lệ", fieldErrors));
    }

    // @PreAuthorize("@perm.has(...)") từ chối (đã đăng nhập nhưng không đủ quyền theo ma trận STAFF) --
    // KHÔNG được rơi xuống handler Exception.class chung bên dưới (trả nhầm 500 "lỗi hệ thống" thay vì
    // đúng bản chất 403 "không có quyền").
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(buildError(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này", null));
    }

    // Lưới an toàn cuối cùng: bắt mọi lỗi không lường trước, tránh lộ stack trace ra client
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnknown(Exception ex) {
        // Log để debug được, nhưng không lộ chi tiết ra client.
        log.error("Lỗi không lường trước", ex);
        return ResponseEntity.internalServerError()
                .body(buildError(HttpStatus.INTERNAL_SERVER_ERROR, "Đã có lỗi xảy ra ở hệ thống", null));
    }

    private ApiError buildError(HttpStatus status, String message, Map<String, String> fieldErrors) {
        return ApiError.builder()
                .timestamp(LocalDateTime.now())
                .status(status.value())
                .message(message)
                .fieldErrors(fieldErrors)
                .build();
    }
}