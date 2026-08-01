package com.datn.service;

import com.datn.dto.admin.AdminCategoryDto;
import com.datn.entity.Category;
import com.datn.exception.ApiException;
import com.datn.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminCategoryService {

    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<AdminCategoryDto.Response> listAll() {
        return categoryRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional
    public AdminCategoryDto.Response create(AdminCategoryDto.Request request) {
        Category category = new Category();
        applyFields(category, request);
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public AdminCategoryDto.Response update(Integer categoryId, AdminCategoryDto.Request request) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> ApiException.notFound("Danh mục không tồn tại"));
        applyFields(category, request);
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public void delete(Integer categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> ApiException.notFound("Danh mục không tồn tại"));
        // Soft delete: chỉ ẩn khỏi trang chủ (isActive=false), KHÔNG xoá cứng vì
        // có thể đang có sản phẩm tham chiếu category_id này (ràng buộc NOT NULL
        // ở Product.category, xoá cứng sẽ vi phạm khoá ngoại)
        category.setIsActive(false);
        categoryRepository.save(category);
    }

    private void applyFields(Category category, AdminCategoryDto.Request request) {
        category.setCategoryName(request.getCategoryName());
        category.setDescription(request.getDescription());
        category.setImageUrl(request.getImageUrl());
        category.setIsActive(request.getIsActive() != null ? request.getIsActive() : true);
        category.setSlug(request.getCategoryName().toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "").trim().replaceAll("\\s+", "-"));

        if (request.getParentId() != null) {
            Category parent = categoryRepository.findById(request.getParentId())
                    .orElseThrow(() -> ApiException.notFound("Danh mục cha không tồn tại"));
            category.setParent(parent);
        } else {
            category.setParent(null);
        }
    }

    private AdminCategoryDto.Response toResponse(Category c) {
        return AdminCategoryDto.Response.builder()
                .categoryId(c.getCategoryId())
                .categoryName(c.getCategoryName())
                .slug(c.getSlug())
                .parentId(c.getParent() != null ? c.getParent().getCategoryId() : null)
                .parentName(c.getParent() != null ? c.getParent().getCategoryName() : null)
                .description(c.getDescription())
                .imageUrl(c.getImageUrl())
                .isActive(c.getIsActive())
                .build();
    }
}