package com.datn.service;

import com.datn.entity.Role;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.RoleRepository;
import com.datn.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Đổi vai trò tài khoản.
 *
 * Trước đây muốn tạo một nhân viên phải chạy INSERT tay vào bảng user_roles -- việc chỉ người viết mã
 * làm được, và tài liệu demo phải hướng dẫn mở SQL Server Management Studio.
 *
 * HAI CHỐT CHẶN đều nhằm vào cùng một tai nạn: hệ thống không còn ADMIN nào và không có màn hình nào
 * để tự sửa lại. Ca "admin cuối cùng" KHÔNG dựng được qua HTTP (chỉ ADMIN gọi được endpoint này, mà
 * nếu có 2 admin thì hạ một người vẫn còn một) -- nên nó chỉ kiểm được ở đây.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminUserServiceRoleTest {

    @Mock UserRepository userRepository;
    @Mock RoleRepository roleRepository;
    @InjectMocks AdminUserService service;

    private User muc;

    private static Role vaiTro(String ten) {
        Role r = new Role();
        r.setRoleName(ten);
        return r;
    }

    @BeforeEach
    void setUp() {
        muc = new User();
        muc.setUserId(7L);
        muc.setUsername("nhanvien1");
        muc.setRoles(new HashSet<>(Set.of(vaiTro("CUSTOMER"))));

        when(userRepository.findById(7L)).thenReturn(Optional.of(muc));
        when(userRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(roleRepository.findByRoleName(any())).thenAnswer(i -> Optional.of(vaiTro(i.getArgument(0))));
        when(userRepository.demSoAdmin()).thenReturn(3L);

        dangNhapBang("admin");
    }

    @AfterEach
    void tearDown() {
        // SecurityContextHolder dùng ThreadLocal -- không xoá thì danh tính rò sang test khác chạy
        // cùng luồng, và test kia đột nhiên "đang đăng nhập" bằng ai đó không liên quan.
        SecurityContextHolder.clearContext();
    }

    private void dangNhapBang(String username) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(username, "n/a", java.util.List.of()));
    }

    // ===================== Đổi vai trò bình thường =====================

    @Test
    @DisplayName("Nâng khách thành nhân viên: thay hẳn vai trò, không cộng dồn")
    void nangThanhNhanVien() {
        var kq = service.doiVaiTro(7L, "STAFF");

        // Đặt ĐÚNG MỘT vai trò. Cộng dồn thì sinh ra tổ hợp chưa ai định nghĩa hành vi (vd vừa STAFF
        // vừa CUSTOMER), và mọi chỗ kiểm quyền trong hệ thống đều giả định ba vai trò loại trừ nhau.
        assertThat(kq.getRoles()).containsExactly("STAFF");
        assertThat(muc.getRoles()).hasSize(1);
    }

    @Test
    @DisplayName("Vai trò không có trong hệ thống: từ chối, không đụng vào tài khoản")
    void vaiTroKhongHopLe() {
        assertThatThrownBy(() -> service.doiVaiTro(7L, "SIEUNHAN"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("chỉ nhận ADMIN, STAFF hoặc CUSTOMER");

        assertThat(muc.getRoles()).extracting(Role::getRoleName).containsExactly("CUSTOMER");
    }

    // ===================== Hai chốt chặn =====================

    @Test
    @DisplayName("Admin TỰ hạ vai trò của chính mình: bị chặn")
    void tuHaVaiTroCuaChinhMinh() {
        muc.setUsername("admin");
        muc.setRoles(new HashSet<>(Set.of(vaiTro("ADMIN"))));
        dangNhapBang("admin");

        // Bấm nhầm là mất quyền ngay lập tức, và không còn màn hình nào để tự sửa lại -- phải mở thẳng
        // cơ sở dữ liệu, đúng cái mà tính năng này sinh ra để khỏi phải làm.
        assertThatThrownBy(() -> service.doiVaiTro(7L, "CUSTOMER"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("tự hạ vai trò");

        assertThat(muc.getRoles()).extracting(Role::getRoleName).containsExactly("ADMIN");
    }

    @Test
    @DisplayName("Hạ vai trò ADMIN CUỐI CÙNG: bị chặn dù người bấm là admin khác")
    void haAdminCuoiCung() {
        muc.setRoles(new HashSet<>(Set.of(vaiTro("ADMIN"))));
        when(userRepository.demSoAdmin()).thenReturn(1L);
        dangNhapBang("mot-admin-khac");

        assertThatThrownBy(() -> service.doiVaiTro(7L, "STAFF"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("quản trị duy nhất còn lại");

        assertThat(muc.getRoles()).extracting(Role::getRoleName).containsExactly("ADMIN");
    }

    @Test
    @DisplayName("Còn nhiều admin: hạ một người vẫn được")
    void conNhieuAdmin_haDuoc() {
        muc.setRoles(new HashSet<>(Set.of(vaiTro("ADMIN"))));
        when(userRepository.demSoAdmin()).thenReturn(2L);
        dangNhapBang("mot-admin-khac");

        assertThat(service.doiVaiTro(7L, "STAFF").getRoles()).containsExactly("STAFF");
    }

    @Test
    @DisplayName("Giữ nguyên ADMIN cho admin cuối cùng: KHÔNG bị chặn (không hạ quyền ai cả)")
    void adminCuoiCung_datLaiChinhVaiTroDo() {
        muc.setRoles(new HashSet<>(Set.of(vaiTro("ADMIN"))));
        when(userRepository.demSoAdmin()).thenReturn(1L);
        dangNhapBang("mot-admin-khac");

        // Chốt chặn phải nhắm đúng vào việc HẠ quyền. Chặn cả thao tác đặt lại đúng vai trò đang có là
        // chặn oan một hành động vô hại.
        assertThat(service.doiVaiTro(7L, "ADMIN").getRoles()).containsExactly("ADMIN");
    }

    @Test
    @DisplayName("Nâng người khác LÊN admin: không vướng chốt chặn nào")
    void nangLenAdmin() {
        when(userRepository.demSoAdmin()).thenReturn(1L);

        assertThat(service.doiVaiTro(7L, "ADMIN").getRoles()).containsExactly("ADMIN");
    }
}
