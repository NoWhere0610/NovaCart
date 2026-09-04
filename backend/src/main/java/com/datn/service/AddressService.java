package com.datn.service;

import com.datn.dto.address.AddressRequest;
import com.datn.dto.address.AddressResponse;
import com.datn.entity.Address;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.AddressRepository;
import com.datn.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AddressService {

    private final AddressRepository addressRepository;
    private final UserRepository userRepository;

    public List<AddressResponse> getMyAddresses(Long userId) {
        return addressRepository.findByUser_UserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AddressResponse create(Long userId, AddressRequest request) {
        Address address = new Address();
        address.setUser(userRef(userId));
        applyRequest(address, request, userId);

        // Địa chỉ đầu tiên của user -> tự động set làm mặc định.
        boolean isFirstAddress = addressRepository.findByUser_UserId(userId).isEmpty();
        if (isFirstAddress || Boolean.TRUE.equals(request.getIsDefault())) {
            unsetCurrentDefault(userId);
            address.setIsDefault(true);
        }

        return toResponse(addressRepository.save(address));
    }

    @Transactional
    public AddressResponse update(Long userId, Long addressId, AddressRequest request) {
        Address address = getOwnedAddressOrThrow(userId, addressId);
        applyRequest(address, request, userId);

        if (Boolean.TRUE.equals(request.getIsDefault()) && !Boolean.TRUE.equals(address.getIsDefault())) {
            unsetCurrentDefault(userId);
            address.setIsDefault(true);
        }

        return toResponse(addressRepository.save(address));
    }

    @Transactional
    public void delete(Long userId, Long addressId) {
        Address address = getOwnedAddressOrThrow(userId, addressId);
        boolean wasDefault = Boolean.TRUE.equals(address.getIsDefault());
        addressRepository.delete(address);

        // Xoá đúng địa chỉ đang là mặc định -- tự đôn 1 địa chỉ còn lại lên làm mặc định, không thì
        // tài khoản không còn địa chỉ mặc định nào (checkout sẽ không tự chọn sẵn được địa chỉ nào).
        if (wasDefault) {
            addressRepository.findByUser_UserId(userId).stream().findFirst().ifPresent(next -> {
                next.setIsDefault(true);
                addressRepository.save(next);
            });
        }
    }

    // ----- helper nội bộ -----

    /** Kiểm tra địa chỉ tồn tại và thuộc đúng user đang đăng nhập, chặn sửa/xoá địa chỉ người khác. */
    private Address getOwnedAddressOrThrow(Long userId, Long addressId) {
        Address address = addressRepository.findById(addressId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy địa chỉ"));
        if (!address.getUser().getUserId().equals(userId)) {
            throw ApiException.forbidden("Bạn không có quyền thao tác trên địa chỉ này");
        }
        return address;
    }

    private void unsetCurrentDefault(Long userId) {
        addressRepository.findByUser_UserIdAndIsDefaultTrue(userId)
                .ifPresent(current -> {
                    current.setIsDefault(false);
                    addressRepository.save(current);
                });
    }

    // Toạ độ khách gửi lên KHÔNG được xác minh có thực sự khớp với tỉnh/phường đã chọn hay không (client
    // tự gửi lat/lng, không bắt buộc đi qua VietMap Autocomplete) -- việc đối chiếu ngược bằng reverse
    // geocode + so khớp tên tỉnh không đủ tin cậy để chặn cứng (VietMap còn lỗi tên tỉnh cũ/mới sau cải
    // cách hành chính, xem VietMapService), nên CHỈ chặn được trường hợp rõ ràng vô lý: toạ độ nằm ngoài
    // hẳn lãnh thổ Việt Nam (dữ liệu rác/lỗi phía client), không chặn được việc khách cố tình khai toạ độ
    // gần showroom để giảm phí ship trong khi khai địa chỉ giao ở tỉnh khác.
    private static final double VN_MIN_LAT = 8.0;
    private static final double VN_MAX_LAT = 23.5;
    private static final double VN_MIN_LNG = 102.0;
    private static final double VN_MAX_LNG = 115.0;

    private void applyRequest(Address address, AddressRequest request, Long userId) {
        // Người nhận LUÔN lấy từ hồ sơ tài khoản, không nhận từ request -- xem AddressRequest.
        // Đọc lại mỗi lần lưu địa chỉ nên sửa hồ sơ xong, lưu lại địa chỉ là số mới có hiệu lực ngay.
        User chuTaiKhoan = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản"));

        // Cột receiver_name/phone của bảng addresses là NOT NULL, và đơn hàng lấy thẳng số này để giao.
        // Hồ sơ thiếu thì phải chặn tại đây với câu chỉ rõ phải làm gì, chứ không để lỗi ràng buộc cơ
        // sở dữ liệu bắn ra một thông báo chẳng ai hiểu.
        if (chuTaiKhoan.getFullName() == null || chuTaiKhoan.getFullName().isBlank()
                || chuTaiKhoan.getPhone() == null || chuTaiKhoan.getPhone().isBlank()) {
            throw ApiException.badRequest(
                    "Vui lòng điền Họ tên và Số điện thoại ở mục Thông tin cá nhân trước khi thêm địa chỉ giao hàng");
        }

        address.setReceiverName(chuTaiKhoan.getFullName());
        address.setPhone(chuTaiKhoan.getPhone());
        address.setProvince(request.getProvince());
        address.setDistrict(request.getDistrict());
        address.setWard(request.getWard());
        address.setDetailAddress(request.getDetailAddress());

        Double lat = request.getLatitude();
        Double lng = request.getLongitude();
        if (lat != null && lng != null
                && (lat < VN_MIN_LAT || lat > VN_MAX_LAT || lng < VN_MIN_LNG || lng > VN_MAX_LNG)) {
            throw ApiException.badRequest("Toạ độ địa chỉ không hợp lệ, vui lòng chọn lại từ gợi ý hoặc bản đồ");
        }
        address.setLatitude(lat);
        address.setLongitude(lng);
    }

    /** Tạo reference User chỉ chứa id để gán vào @ManyToOne mà không cần query cả bản ghi User. */
    private User userRef(Long userId) {
        User user = new User();
        user.setUserId(userId);
        return user;
    }

    private AddressResponse toResponse(Address a) {
        return AddressResponse.builder()
                .addressId(a.getAddressId())
                .receiverName(a.getReceiverName())
                .phone(a.getPhone())
                .province(a.getProvince())
                .district(a.getDistrict())
                .ward(a.getWard())
                .detailAddress(a.getDetailAddress())
                .latitude(a.getLatitude())
                .longitude(a.getLongitude())
                .isDefault(a.getIsDefault())
                .build();
    }

    /** Dùng bởi ShippingController để lấy Address (kèm toạ độ) khi tính phí ship trước lúc đặt hàng. */
    public Address getOwnedAddress(Long userId, Long addressId) {
        return getOwnedAddressOrThrow(userId, addressId);
    }
}