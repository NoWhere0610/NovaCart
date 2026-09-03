package com.datn.service;

import com.datn.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

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

            // Trả về đường dẫn TƯƠNG ĐỐI, không phải URL tuyệt đối.
            //
            // Bản cũ dùng ServletUriComponentsBuilder.fromCurrentContextPath() -> URL sinh ra theo header
            // Host của chính request upload và được LƯU THẲNG vào product_images.image_url. Ảnh admin
            // upload trên máy dev sẽ đóng băng thành "http://localhost:8080/..." -- máy khác mở app qua IP
            // LAN sẽ tự giải localhost thành chính nó và toàn bộ ảnh vỡ, dù file vẫn nằm nguyên trên server.
            // Đổi host/cổng/bật HTTPS cũng hỏng y hệt, và nếu admin lúc vào bằng localhost lúc bằng IP thì
            // DB chứa lẫn lộn 2 kiểu URL.
            //
            // Đường dẫn tương đối luôn được giải theo chính origin mà trình duyệt đang mở
            // (dev: Vite proxy /uploads -> backend, xem vite.config.ts).
            return "/uploads/products/" + filename;
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu ảnh");
        }
    }
}
