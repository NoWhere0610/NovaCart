package com.datn.dto.address;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AddressResponse {
    private Long addressId;
    private String receiverName;
    private String phone;
    private String province;
    private String district;
    private String ward;
    private String detailAddress;
    private Double latitude;
    private Double longitude;
    private Boolean isDefault;
}