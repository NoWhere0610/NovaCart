package com.datn.service;

import com.datn.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

/**
 * Lưu ảnh sản phẩm admin upload từ máy vào đĩa cục bộ (thư mục app.upload.dir), phục vụ lại qua
 * /uploads/** (xem WebMvcConfig). Đủ dùng cho đồ án -- lên production thật nên đổi sang S3/CDN.
 */
@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final long MAX_SIZE_BYTES = 5L * 1024 * 1024; // 5MB

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public String storeProductImage(MultipartFile file) {
        if (file.isEmpty()) {
            throw ApiException.badRequest("File ảnh trống");
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw ApiException.badRequest("Ảnh vượt quá 5MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw ApiException.badRequest("Chỉ chấp nhận ảnh JPEG, PNG, WEBP hoặc GIF");
        }

        try {
            Path targetDir = Paths.get(uploadDir, "products").toAbsolutePath();
            Files.createDirectories(targetDir);

            String extension = switch (contentType) {
                case "image/png" -> ".png";
                case "image/webp" -> ".webp";
                case "image/gif" -> ".gif";
                default -> ".jpg";
            };
            String filename = UUID.randomUUID() + extension;
            Path targetFile = targetDir.resolve(filename);
            Files.copy(file.getInputStream(), targetFile);

            return ServletUriComponentsBuilder.fromCurrentContextPath()
                    .path("/uploads/products/")
                    .path(filename)
                    .toUriString();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu ảnh");
        }
    }
}
