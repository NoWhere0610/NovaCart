package com.datn.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Quét mọi endpoint trong các controller quản trị và bắt lỗi "quên gắn @PreAuthorize".
 *
 * Vì sao đáng có: quyền của Nhân viên được quyết định ở tầng method bằng @PreAuthorize("@perm.has(...)"),
 * không phải ở tầng route như ADMIN. Thêm một endpoint mới mà quên annotation thì nó lọt qua ma trận
 * phân quyền một cách IM LẶNG -- không có lỗi, không có cảnh báo, chỉ có một nhân viên làm được việc
 * lẽ ra không được phép. Test này chạy trong vài chục mili giây và không cần Spring context.
 */
class ControllerSecurityAuditTest {

    private static final Set<Class<? extends Annotation>> MAPPING_ANNOTATIONS = Set.of(
            GetMapping.class, PostMapping.class, PutMapping.class,
            DeleteMapping.class, PatchMapping.class, RequestMapping.class);

    /**
     * Các nhánh API bị KHOÁ CỨNG chỉ-ADMIN ngay ở tầng route trong SecurityConfig. Chúng cố ý KHÔNG dùng
     * @PreAuthorize vì không đi qua ma trận quyền STAFF -- nhân viên không bao giờ chạm tới được, dù ma
     * trận có bật gì đi nữa.
     *
     * Danh sách này là bản sao của luật trong SecurityConfig, nên test tự kiểm chứng nó vẫn còn đúng
     * (xem luatKhoaRouteVanConTrongSecurityConfig) -- xoá luật bên kia mà quên sửa bên này thì test đỏ,
     * không im lặng trôi qua.
     */
    private static final List<String> NHANH_KHOA_CUNG_ADMIN = List.of(
            "/api/admin/inventory/**",
            "/api/admin/users/**",
            "/api/admin/permissions/**");

    private static final Path SECURITY_CONFIG =
            Path.of("src", "main", "java", "com", "datn", "config", "SecurityConfig.java");

    private static boolean bịKhoáCứngỞTầngRoute(Class<?> controller) {
        RequestMapping mapping = controller.getAnnotation(RequestMapping.class);
        if (mapping == null || mapping.value().length == 0) return false;
        String basePath = mapping.value()[0];
        return NHANH_KHOA_CUNG_ADMIN.stream()
                .map(p -> p.replace("/**", ""))
                .anyMatch(basePath::startsWith);
    }

    @Test
    @DisplayName("Mọi endpoint quản trị đều được canh: hoặc @PreAuthorize, hoặc khoá cứng ADMIN ở route")
    void moiEndpointQuanTriDeuDuocCanh() throws Exception {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));

        List<String> thieuQuyen = new ArrayList<>();
        int daKiem = 0;

        for (var definition : scanner.findCandidateComponents("com.datn.controller")) {
            Class<?> controller = Class.forName(definition.getBeanClassName());
            if (!controller.getSimpleName().startsWith("Admin")) continue;
            // Gắn @PreAuthorize ở cấp lớp là đã bao trọn mọi method bên trong.
            if (controller.isAnnotationPresent(PreAuthorize.class)) continue;
            if (bịKhoáCứngỞTầngRoute(controller)) continue;

            for (Method method : controller.getDeclaredMethods()) {
                if (!Modifier.isPublic(method.getModifiers()) || method.isSynthetic()) continue;
                boolean laEndpoint = MAPPING_ANNOTATIONS.stream().anyMatch(method::isAnnotationPresent);
                if (!laEndpoint) continue;
                daKiem++;
                if (!method.isAnnotationPresent(PreAuthorize.class)) {
                    thieuQuyen.add(controller.getSimpleName() + "." + method.getName() + "()");
                }
            }
        }

        assertThat(daKiem)
                .as("Không quét được endpoint nào -- test này đang tự lừa mình, kiểm lại tên gói/quy ước đặt tên")
                .isGreaterThan(20);
        assertThat(thieuQuyen)
                .as("Endpoint quản trị thiếu @PreAuthorize (nhân viên sẽ gọi được mà không qua ma trận quyền)")
                .isEmpty();
    }

    @Test
    @DisplayName("Các nhánh được miễn @PreAuthorize vẫn thật sự bị khoá cứng ADMIN trong SecurityConfig")
    void luatKhoaRouteVanConTrongSecurityConfig() throws Exception {
        assertThat(SECURITY_CONFIG).as("Không đọc được SecurityConfig -- đường dẫn đã đổi?").exists();
        String nguon = Files.readString(SECURITY_CONFIG, StandardCharsets.UTF_8);

        for (String nhanh : NHANH_KHOA_CUNG_ADMIN) {
            assertThat(nguon)
                    .as("Nhánh %s đang được miễn @PreAuthorize vì tin rằng nó khoá cứng ADMIN ở route. "
                            + "Không thấy luật đó trong SecurityConfig nữa -- hoặc khôi phục luật, hoặc gắn "
                            + "@PreAuthorize cho các endpoint trong nhánh này.", nhanh)
                    .contains("requestMatchers(\"" + nhanh + "\").hasRole(\"ADMIN\")");
        }
    }
}
