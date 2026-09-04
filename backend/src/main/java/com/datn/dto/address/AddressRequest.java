package com.datn.dto.address;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * Body của POST/PUT /api/addresses.
 *
 * KHÔNG còn nhận tên người nhận và số điện thoại. Hai thông tin đó lấy thẳng từ hồ sơ tài khoản (họ
 * tên + số điện thoại, cả hai đều bắt buộc ở màn Tài khoản) -- xem AddressService.applyRequest.
 *
 * Bắt khách gõ lại chính tên và số của mình ở MỖI địa chỉ là hỏi hai lần cùng một thứ, và mở đường cho
 * hai nơi lệch nhau: sửa số điện thoại ở hồ sơ mà các địa chỉ cũ vẫn giữ số cũ thì đơn hàng tiếp theo
 * lại giao theo số đã bỏ.
 *
 * ĐÁNH ĐỔI đã biết: không còn đặt hàng gửi cho người khác (mua hộ, gửi người nhà) với tên/số riêng cho
 * từng địa chỉ. Mọi đơn ghi người nhận là chủ tài khoản.
 */
@Getter
@Setter
public class AddressRequest {

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
