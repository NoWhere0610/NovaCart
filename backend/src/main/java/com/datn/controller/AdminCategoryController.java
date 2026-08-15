package com.datn.controller;

import com.datn.dto.admin.AdminCategoryDto;
import com.datn.service.AdminCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/categories")
@RequiredArgsConstructor
public class AdminCategoryController {

    private final AdminCategoryService adminCategoryService;

    @GetMapping
    @PreAuthorize("@perm.has('CATEGORY_BRAND_VIEW')")
    public ResponseEntity<List<AdminCategoryDto.Response>> listAll() {
        return ResponseEntity.ok(adminCategoryService.listAll());
    }

    @PostMapping
    @PreAuthorize("@perm.has('CATEGORY_BRAND_WRITE')")
    public ResponseEntity<AdminCategoryDto.Response> create(
            @Valid @RequestBody AdminCategoryDto.Request request) {
        return ResponseEntity.ok(adminCategoryService.create(request));
    }

    @PutMapping("/{categoryId}")
    @PreAuthorize("@perm.has('CATEGORY_BRAND_WRITE')")
    public ResponseEntity<AdminCategoryDto.Response> update(
            @PathVariable Integer categoryId, @Valid @RequestBody AdminCategoryDto.Request request) {
        return ResponseEntity.ok(adminCategoryService.update(categoryId, request));
    }

    @DeleteMapping("/{categoryId}")
    @PreAuthorize("@perm.has('CATEGORY_BRAND_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Integer categoryId) {
        adminCategoryService.delete(categoryId);
        return ResponseEntity.noContent().build();
    }
}