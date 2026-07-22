package com.datn.service;

import com.datn.dto.address.AddressRequest;
import com.datn.dto.address.AddressResponse;
import com.datn.entity.Address;
import com.datn.entity.User;
import com.datn.exception.ApiException;
import com.datn.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AddressService {

    private final AddressRepository addressRepository;

    public List<AddressResponse> getMyAddresses(Long userId) {
        return addressRepository.findByUser_UserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AddressResponse create(Long userId, AddressRequest request) {
        Address address = new Address();
        address.setUser(userRef(userId));
        applyRequest(address, request);

        // Nếu đây là địa chỉ ĐẦU TIÊN của user -> tự động set làm mặc định luôn,
        // để khi checkout luôn có sẵn 1 địa chỉ default cho user mới
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
        applyRequest(address, request);

        if (Boolean.TRUE.equals(request.getIsDefault()) && !Boolean.TRUE.equals(address.getIsDefault())) {
            unsetCurrentDefault(userId);
            address.setIsDefault(true);
        }

        return toResponse(addressRepository.save(address));
    }

    @Transactional
    public void delete(Long userId, Long addressId) {
        Address address = getOwnedAddressOrThrow(userId, addressId);
        addressRepository.delete(address);
    }

    // ----- helper nội bộ -----

    /** Kiểm tra địa chỉ có tồn tại VÀ đúng là của user đang đăng nhập hay không
     *  (chặn user A sửa/xoá địa chỉ của user B chỉ bằng cách đổi addressId trên URL). */
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

    private void applyRequest(Address address, AddressRequest request) {
        address.setReceiverName(request.getReceiverName());
        address.setPhone(request.getPhone());
        address.setProvince(request.getProvince());
        address.setDistrict(request.getDistrict());
        address.setWard(request.getWard());
        address.setDetailAddress(request.getDetailAddress());
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
                .isDefault(a.getIsDefault())
                .build();
    }
}