package com.datn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Địa chỉ giao hàng của khách hàng.
 * 1 user có thể có NHIỀU địa chỉ (n-1 tới User), 1 địa chỉ được đánh dấu is_default
 * để tự động chọn sẵn khi checkout.
 */
@Entity
@Table(name = "addresses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Address {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "address_id")
    private Long addressId;

    // Chủ sở hữu địa chỉ. LAZY để không tự động kéo User mỗi lần load Address
    // (chỉ cần user_id là đủ cho phần lớn nghiệp vụ).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "receiver_name", nullable = false, length = 100)
    private String receiverName;

    @Column(name = "phone", nullable = false, length = 20)
    private String phone;

    @Column(name = "province", length = 100)
    private String province;

    @Column(name = "district", length = 100)
    private String district;

    @Column(name = "ward", length = 100)
    private String ward;

    @Column(name = "detail_address", length = 255)
    private String detailAddress;

    // true = địa chỉ mặc định, chỉ 1 địa chỉ/user được true tại 1 thời điểm
    // (logic đảm bảo tính duy nhất này nằm ở AddressService, không phải DB constraint)
    @Column(name = "is_default")
    private Boolean isDefault = false;
}