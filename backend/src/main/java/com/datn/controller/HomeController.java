package com.datn.controller;

import com.datn.dto.CategoryResponse;
import com.datn.dto.PageResponse;
import com.datn.dto.ProductResponse;
import com.datn.service.HomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/home")
@RequiredArgsConstructor
public class HomeController {

    private final HomeService homeService;

    @GetMapping("/categories")
    public List<CategoryResponse> getCategories() {
        return homeService.getRootCategories();
    }

    @GetMapping("/products/newest")
    public PageResponse<ProductResponse> getNewestProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return homeService.getNewestProducts(pageable);
    }

    @GetMapping("/products/category/{categoryId}")
    public PageResponse<ProductResponse> getProductsByCategory(
            @PathVariable Integer categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return homeService.getProductsByCategory(categoryId, pageable);
    }

    @GetMapping("/products/sale")
    public PageResponse<ProductResponse> getOnSaleProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return homeService.getOnSaleProducts(pageable);
    }

    @GetMapping("/products/search")
    public PageResponse<ProductResponse> searchProducts(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return homeService.searchProducts(keyword, pageable);
    }
}
