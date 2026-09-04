package com.datn.backend;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Kiểm tra ứng dụng khởi động được với cấu hình thật -- bắt được các lỗi mà unit test không thấy:
 * thiếu bean, sai tên thuộc tính trong application.properties, @Query JPQL viết sai cú pháp (Hibernate
 * phân tích toàn bộ repository lúc khởi động).
 *
 * GẮN @Tag("integration") vì test này CẦN MSSQL đang chạy ở localhost:1433 -- nó mở kết nối thật và
 * truy vấn bảng role_permission. Máy chưa cài/chưa bật SQL Server sẽ hỏng, kéo theo "mvn test" hỏng
 * hoàn toàn dù các test thuần logic khác chẳng cần cơ sở dữ liệu.
 *
 * Mặc định bị loại khỏi "mvn test" (xem maven-surefire-plugin trong pom.xml).
 * Chạy riêng khi có cơ sở dữ liệu:  mvn test -Dgroups=integration
 */
@Tag("integration")
@SpringBootTest
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
