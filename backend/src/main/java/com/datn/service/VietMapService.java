package com.datn.service;

import com.datn.dto.maps.VietMapDto;
import com.datn.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

/**
 * Tích hợp VietMap Maps API (maps.vietmap.vn/docs) -- thay thế Google Maps Platform vì Google đã chặn
 * API key đăng ký từ Việt Nam từ 21/03/2022. VietMap thiết kế API tương tự Google (Autocomplete,
 * Place Detail, Distance Matrix) nên khái niệm dùng trong code vẫn giữ nguyên như thiết kế ban đầu.
 *
 * Toàn bộ lời gọi tới VietMap đều nằm ở BACKEND (không lộ apikey ra frontend) -- frontend chỉ gọi qua
 * MapsController, đơn giản hơn cả kiểu tách 2 key frontend/backend mà Google Maps Platform yêu cầu.
 */
@Service
public class VietMapService {

    @Value("${vietmap.api-key}")
    private String apiKey;

    @Value("${shop.origin.lat}")
    private double shopLat;

    @Value("${shop.origin.lng}")
    private double shopLng;

    private final RestClient restClient = RestClient.create("https://maps.vietmap.vn");

    @SuppressWarnings("unchecked")
    public List<VietMapDto.Suggestion> autocomplete(String text) {
        List<Map<String, Object>> raw = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/autocomplete/v3")
                        .queryParam("apikey", apiKey)
                        .queryParam("text", text)
                        .build())
                .retrieve()
                .body(List.class);

        return raw == null ? List.of() : raw.stream()
                .map(r -> VietMapDto.Suggestion.builder()
                        .refId((String) r.get("ref_id"))
                        .display(spaceAfterComma((String) r.get("display")))
                        .address(spaceAfterComma((String) r.get("address")))
                        .name((String) r.get("name"))
                        .build())
                .toList();
    }

    @SuppressWarnings("unchecked")
    public VietMapDto.PlaceDetail placeDetail(String refId) {
        Map<String, Object> raw = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/place/v3")
                        .queryParam("apikey", apiKey)
                        .queryParam("refid", refId)
                        .build())
                .retrieve()
                .body(Map.class);

        if (raw == null) {
            throw ApiException.notFound("Không tìm thấy địa điểm");
        }
        return VietMapDto.PlaceDetail.builder()
                .display(spaceAfterComma((String) raw.get("display")))
                .hsNum((String) raw.get("hs_num"))
                .street((String) raw.get("street"))
                .city((String) raw.get("city"))
                .district((String) raw.get("district"))
                .ward((String) raw.get("ward"))
                .lat(toDouble(raw.get("lat")))
                .lng(toDouble(raw.get("lng")))
                .build();
    }

    /**
     * Reverse geocode: từ toạ độ (khách bấm/kéo ghim trên bản đồ) -> địa chỉ đầy đủ (tỉnh/phường/
     * đường). Gọi 2 bước giống hệt luồng Autocomplete: reverse trả về ref_id của kết quả gần nhất, rồi
     * tái dùng placeDetail() để lấy đúng field đã tách sẵn city/district/ward/hs_num/street.
     *
     * QUAN TRỌNG: /api/place/v3 và /api/reverse/v3 của VietMap trả tỉnh/phường theo cấu trúc CŨ (còn
     * cấp huyện, trước 01/07/2025) -- KHÔNG tự cập nhật theo cải cách hành chính mới dù đã hơn 1 năm.
     * Bằng chứng: VietMap có hẳn 1 API RIÊNG (/api/migrate-address) chỉ để chuyển đổi cũ -> mới, cho
     * thấy chính VietMap cũng xác nhận API chính (Autocomplete/Reverse/Place) chưa cập nhật. Vì vậy
     * BẮT BUỘC phải gọi thêm bước migrateToNewAdministrative() dưới đây để lấy đúng tên tỉnh/phường
     * MỚI, không dùng thẳng city/ward từ placeDetail().
     */
    @SuppressWarnings("unchecked")
    public VietMapDto.PlaceDetail reverseGeocode(double lat, double lng) {
        List<Map<String, Object>> raw = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/reverse/v3")
                        .queryParam("apikey", apiKey)
                        .queryParam("lat", lat)
                        .queryParam("lng", lng)
                        .build())
                .retrieve()
                .body(List.class);

        if (raw == null || raw.isEmpty()) {
            throw ApiException.notFound("Không tìm được địa chỉ tại vị trí này");
        }
        String refId = (String) raw.get(0).get("ref_id");
        VietMapDto.PlaceDetail detail = placeDetail(refId);

        try {
            Map<String, String> migrated = migrateToNewAdministrative(detail.getDisplay(), lat, lng);
            if (!migrated.isEmpty()) {
                // display/name lấy từ CHÍNH kết quả migrate-address (đã ở cấu trúc MỚI) -- không dùng
                // detail.getDisplay() cũ nữa, nếu không "Địa chỉ chi tiết" ở frontend vẫn hiện lẫn
                // "Phường X,Quận Y" kiểu cũ khi hsNum/street rỗng phải fallback về display.
                boolean hasStreetInfo = detail.getHsNum() != null || detail.getStreet() != null;
                return VietMapDto.PlaceDetail.builder()
                        .display(migrated.getOrDefault("display", detail.getDisplay()))
                        .hsNum(detail.getHsNum())
                        .street(hasStreetInfo ? detail.getStreet() : migrated.get("name"))
                        .city(migrated.getOrDefault("province", detail.getCity()))
                        .district(detail.getDistrict())
                        .ward(migrated.getOrDefault("ward", detail.getWard()))
                        .lat(detail.getLat())
                        .lng(detail.getLng())
                        .build();
            }
        } catch (Exception ignored) {
            // Không chuyển đổi được (vd VietMap lỗi/timeout) -- vẫn trả về địa chỉ CŨ thay vì chặn cả
            // request; frontend đã có cơ chế báo "không tự xác định được, chọn tay" cho trường hợp này.
        }
        return detail;
    }

    /**
     * Chuyển 1 địa chỉ dạng text từ cấu trúc CŨ sang MỚI qua đúng API chính thức của VietMap (đáng tin
     * hơn tự so khớp tên bằng tay) -- trả về Map rỗng nếu VietMap không xác định được.
     */
    @SuppressWarnings("unchecked")
    private Map<String, String> migrateToNewAdministrative(String oldAddressText, double lat, double lng) {
        Map<String, Object> raw = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/migrate-address/v3")
                        .queryParam("apikey", apiKey)
                        .queryParam("text", oldAddressText)
                        .queryParam("focus", lat + "," + lng)
                        .queryParam("migrate_type", "1")
                        .build())
                .retrieve()
                .body(Map.class);

        if (raw == null) return Map.of();

        Map<String, String> result = new java.util.HashMap<>();
        if (raw.get("display") instanceof String s) result.put("display", spaceAfterComma(s));
        if (raw.get("name") instanceof String s) result.put("name", s);

        List<Map<String, Object>> boundaries = (List<Map<String, Object>>) raw.get("boundaries");
        if (boundaries != null) {
            for (Map<String, Object> b : boundaries) {
                String fullName = (String) b.get("full_name");
                int type = b.get("type") instanceof Number n ? n.intValue() : -1;
                if (fullName == null) continue;
                // type: 0 = tỉnh/thành phố, 2 = phường/xã (xem VietMapDto/tài liệu migrate-address).
                if (type == 0) result.put("province", fullName);
                else if (type == 2) result.put("ward", fullName);
            }
        }
        return result;
    }

    // VietMap trả "display"/"address" KHÔNG có khoảng trắng sau dấu phẩy (vd "Phường 9,Quận 5,TP.HCM")
    // -- tự chèn thêm cho dễ đọc, không sửa lại toàn bộ định dạng.
    private String spaceAfterComma(String s) {
        return s == null ? null : s.replaceAll(",(?=\\S)", ", ");
    }

    /**
     * Khoảng cách đường bộ (km) từ showroom (shop.origin.lat/lng) tới toạ độ đích, dùng
     * ShippingService tính phí ship theo khoảng cách thật. Ném exception nếu VietMap lỗi/timeout --
     * ShippingService PHẢI tự fallback về công thức cũ, không được để lỗi ở đây chặn cả việc đặt hàng.
     */
    @SuppressWarnings("unchecked")
    public BigDecimal distanceKm(double destLat, double destLng) {
        String origin = shopLat + "," + shopLng;
        String dest = destLat + "," + destLng;

        Map<String, Object> raw = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/matrix")
                        .queryParam("apikey", apiKey)
                        .queryParam("api-version", "1.1")
                        .queryParam("point", origin)
                        .queryParam("point", dest)
                        .queryParam("sources", "0")
                        .queryParam("destinations", "1")
                        .queryParam("annotation", "distance")
                        .build())
                .retrieve()
                .body(Map.class);

        if (raw == null || !"OK".equals(raw.get("code"))) {
            throw new IllegalStateException("VietMap Matrix API trả về lỗi: " + (raw != null ? raw.get("messages") : "null"));
        }
        List<List<Number>> distances = (List<List<Number>>) raw.get("distances");
        double meters = distances.get(0).get(0).doubleValue();
        return BigDecimal.valueOf(meters).divide(BigDecimal.valueOf(1000), 2, RoundingMode.HALF_UP);
    }

    private Double toDouble(Object value) {
        return value instanceof Number number ? number.doubleValue() : null;
    }
}
