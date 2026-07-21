package com.datn.service;

import com.datn.dto.admin.AdminBrandDto;
import com.datn.entity.Brand;
import com.datn.exception.ApiException;
import com.datn.repository.BrandRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminBrandService {

    private final BrandRepository brandRepository;

    public List<AdminBrandDto.Response> listAll() {
        return brandRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional
    public AdminBrandDto.Response create(AdminBrandDto.Request request) {
        Brand brand = new Brand();
        brand.setBrandName(request.getBrandName());
        brand.setLogoUrl(request.getLogoUrl());
        return toResponse(brandRepository.save(brand));
    }

    @Transactional
    public AdminBrandDto.Response update(Integer brandId, AdminBrandDto.Request request) {
        Brand brand = brandRepository.findById(brandId)
                .orElseThrow(() -> ApiException.notFound("Thương hiệu không tồn tại"));
        brand.setBrandName(request.getBrandName());
        brand.setLogoUrl(request.getLogoUrl());
        return toResponse(brandRepository.save(brand));
    }

    @Transactional
    public void delete(Integer brandId) {
        Brand brand = brandRepository.findById(brandId)
                .orElseThrow(() -> ApiException.notFound("Thương hiệu không tồn tại"));
        // Brand không có cột isActive trong schema hiện tại và product.brand_id được phép NULL
        // (khác Category) -> xoá cứng an toàn hơn, nhưng chỉ khi không còn sản phẩm nào tham chiếu.
        // Đồ án đơn giản hoá: để DB tự ném lỗi khoá ngoại nếu còn sản phẩm dùng brand này,
        // GlobalExceptionHandler sẽ bắt và trả lỗi chung, admin sẽ biết cần gỡ sản phẩm trước.
        brandRepository.delete(brand);
    }

    private AdminBrandDto.Response toResponse(Brand b) {
        return AdminBrandDto.Response.builder()
                .brandId(b.getBrandId())
                .brandName(b.getBrandName())
                .logoUrl(b.getLogoUrl())
                .build();
    }
}