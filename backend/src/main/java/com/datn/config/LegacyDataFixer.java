package com.datn.config;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Vá dữ liệu cũ khi schema thay đổi, chạy một lần lúc khởi động.
 *
 * VÌ SAO CẦN: dự án dùng spring.jpa.hibernate.ddl-auto=update chứ không có công cụ migration
 * (Flyway/Liquibase). Hibernate THÊM ĐƯỢC cột mới vào bảng đã có dữ liệu, nhưng các dòng cũ nhận giá
 * trị NULL và Hibernate không có cách nào điền giá trị mặc định cho chúng. Với hầu hết cột thì vô hại;
 * với cột @Version thì hỏng nặng.
 *
 * LỖI ĐÃ GẶP THẬT (đo trên cơ sở dữ liệu đang chạy: 84/114 đơn có version NULL, trong đó 7 đơn vẫn
 * đang hoạt động): mọi thao tác GHI lên một đơn có version NULL đều ném NullPointerException ngay lúc
 * commit transaction, tận trong Hibernate (Versioning.increment -> LongJavaType.next: không tăng được
 * NULL). Hệ quả: admin bấm "Xác nhận đơn" ra lỗi hệ thống, khách bấm "Huỷ đơn" ra lỗi hệ thống, thanh
 * toán VNPay không ghi nhận được -- những đơn đó kẹt vĩnh viễn, không có cách nào xử lý trong ứng dụng.
 *
 * Câu lệnh vá là idempotent (lần chạy sau không còn dòng nào để sửa) và rất rẻ, nên để chạy mỗi lần
 * khởi động là an toàn -- quan trọng hơn: máy nào nâng cấp từ schema cũ cũng tự khỏi, không cần ai nhớ
 * chạy tay.
 */
@Configuration
@RequiredArgsConstructor
public class LegacyDataFixer {

    private static final Logger log = LoggerFactory.getLogger(LegacyDataFixer.class);

    private final EntityManager entityManager;
    private final PlatformTransactionManager transactionManager;

    @Bean
    ApplicationRunner vaDuLieuCu() {
        return args -> {
            backfillOrderVersion();
            backfillRefundStatus();
        };
    }

    /**
     * Mở transaction bằng TransactionTemplate chứ KHÔNG dùng @Transactional: bean này tự gọi phương thức
     * của chính nó (từ lambda trong vaDuLieuCu), mà @Transactional hoạt động qua proxy nên lời gọi nội
     * bộ không đi qua proxy -- annotation sẽ bị bỏ qua hoàn toàn và câu UPDATE báo "No active
     * transaction for update or delete query".
     */
    void backfillOrderVersion() {
        try {
            int soDong = new TransactionTemplate(transactionManager).execute(status -> entityManager
                    .createNativeQuery("UPDATE orders SET version = 0 WHERE version IS NULL")
                    .executeUpdate());
            if (soDong > 0) {
                log.warn("[va-du-lieu] đã điền version = 0 cho {} đơn hàng cũ (trước đó NULL nên không "
                        + "thao tác được: xác nhận/huỷ/ghi nhận thanh toán đều lỗi lúc commit).", soDong);
            }
        } catch (Exception e) {
            // Không được làm hỏng việc khởi động ứng dụng vì một bước vá dữ liệu.
            log.error("[va-du-lieu] không vá được cột version của orders: {}", e.getMessage());
        }
    }

    /**
     * Lấp refund_status NULL thành 'NONE' cho đơn tạo trước khi có luồng hoàn tiền.
     *
     * Cùng một cái bẫy như cột version: giá trị mặc định khai trong entity Java chỉ áp cho đối tượng
     * MỚI tạo, không vá được dòng đã nằm sẵn trong bảng. Để NULL thì mọi chỗ so sánh refundStatus đều
     * phải nhớ kiểm null trước, và chỉ cần một chỗ quên là ném NullPointerException.
     */
    void backfillRefundStatus() {
        try {
            int soDong = new TransactionTemplate(transactionManager).execute(status -> entityManager
                    .createNativeQuery("UPDATE orders SET refund_status = 'NONE' WHERE refund_status IS NULL")
                    .executeUpdate());
            if (soDong > 0) {
                log.warn("[va-du-lieu] đã điền refund_status = 'NONE' cho {} đơn hàng cũ.", soDong);
            }
        } catch (Exception e) {
            log.error("[va-du-lieu] không vá được cột refund_status của orders: {}", e.getMessage());
        }
    }
}
