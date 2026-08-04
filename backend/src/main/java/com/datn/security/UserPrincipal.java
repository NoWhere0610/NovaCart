package com.datn.security;

import com.datn.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Adapter giữa {@link User} và {@link UserDetails} (Spring Security yêu cầu).
 * Tách riêng để entity không phụ thuộc Spring Security và không lộ field nhạy cảm ra ngoài.
 */
@Getter
public class UserPrincipal implements UserDetails {

    private final Long userId;
    private final String username;
    private final String password; // hash BCrypt, KHÔNG phải plaintext
    private final String email;
    private final String fullName;
    private final boolean active;
    private final Set<String> roles;

    public UserPrincipal(User user) {
        this.userId = user.getUserId();
        this.username = user.getUsername();
        this.password = user.getPassword();
        this.email = user.getEmail();
        this.fullName = user.getFullName();
        this.active = Boolean.TRUE.equals(user.getIsActive());
        this.roles = user.getRoles() == null
                ? Set.of()
                : user.getRoles().stream().map(r -> r.getRoleName()).collect(Collectors.toSet());
    }

    /** Spring Security yêu cầu quyền phải có tiền tố "ROLE_" để dùng hasRole("ADMIN"). */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    // Đồ án chưa cần khoá theo hạn tài khoản/hết hạn mật khẩu -> luôn true
    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    // is_active = false (admin khoá tài khoản) -> user này không login được nữa
    @Override
    public boolean isEnabled() {
        return active;
    }
}