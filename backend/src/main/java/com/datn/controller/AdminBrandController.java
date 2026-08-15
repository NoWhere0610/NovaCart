package com.datn.controller;

import com.datn.dto.admin.AdminBrandDto;
import com.datn.service.AdminBrandService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/brands")
@RequiredArgsConstructor
public class AdminBrandController {

    private final AdminBrandService adminBrandService;

    @GetMapping
    @PreAuthorize("@perm.has('CATEGORY_BRAND_VIEW')")
    public ResponseEntity<List<AdminBrandDto.Response>> listAll() {
        return ResponseEntity.ok(adminBrandService.listAll());
    }

    @PostMapping
    @PreAuthorize("@perm.has('CATEGORY_BRAND_WRITE')")
    public ResponseEntity<AdminBrandDto.Response> create(@Valid @RequestBody AdminBrandDto.Request request) {
        return ResponseEntity.ok(adminBrandService.create(request));
    }

    @PutMapping("/{brandId}")
    @PreAuthorize("@perm.has('CATEGORY_BRAND_WRITE')")
    public ResponseEntity<AdminBrandDto.Response> update(
            @PathVariable Integer brandId, @Valid @RequestBody AdminBrandDto.Request request) {
        return ResponseEntity.ok(adminBrandService.update(brandId, request));
    }

    @DeleteMapping("/{brandId}")
    @PreAuthorize("@perm.has('CATEGORY_BRAND_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Integer brandId) {
        adminBrandService.delete(brandId);
        return ResponseEntity.noContent().build();
    }
}