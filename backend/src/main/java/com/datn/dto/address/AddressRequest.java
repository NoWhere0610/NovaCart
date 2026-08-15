package com.datn.dto.address;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AddressRequest {

    @NotBlank(message = "Tên người nhận không được để trống")
    private String receiverName;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^(0|\\+84)(3|5|7|8|9)[0-9]{8}$",
            message = "Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 03/05/07/08/09, vd 0912345678)")
    private String phone;

    @NotBlank(message = "Vui lòng chọn Tỉnh/Thành phố")
    private String province;
    private String district;
    @NotBlank(message = "Vui lòng chọn Phường/Xã")
    private String ward;
    @NotBlank(message = "Vui lòng nhập địa chỉ chi tiết (số nhà, tên đường)")
    private String detailAddress;
    // Điền tự động từ VietMap Place API lúc khách chọn 1 gợi ý Autocomplete -- optional, null nếu
    // khách tự gõ tay không qua gợi ý (fallback ShippingService vẫn xử lý được, xem Address.java).
    private Double latitude;
    private Double longitude;
    private Boolean isDefault;
}