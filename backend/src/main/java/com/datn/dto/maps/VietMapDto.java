package com.datn.dto.maps;

import lombok.Builder;
import lombok.Getter;

public class VietMapDto {

    // 1 gợi ý địa chỉ trả về từ Autocomplete -- refId dùng để gọi tiếp Place API lấy lat/lng.
    @Getter
    @Builder
    public static class Suggestion {
        private String refId;
        private String display;
        private String address;
        private String name;
    }

    // Chi tiết 1 địa điểm (sau khi khách chọn 1 gợi ý) -- đủ để tự điền vào form địa chỉ.
    @Getter
    @Builder
    public static class PlaceDetail {
        private String display;
        private String hsNum;
        private String street;
        private String city;
        private String district;
        private String ward;
        private Double lat;
        private Double lng;
    }
}
