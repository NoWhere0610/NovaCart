package com.datn.controller;

import com.datn.dto.CategoryResponse;
import com.datn.dto.PageResponse;
import com.datn.dto.ProductDetailResponse;
import com.datn.dto.ProductResponse;
import com.datn.service.HomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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

    @GetMapping("/products/{productId}")
    public ProductDetailResponse getProductDetail(@PathVariable Long productId) {
    return homeService.getProductDetail(productId);
}

    @GetMapping("/products/search")
    public PageResponse<ProductResponse> searchProducts(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return homeService.searchProducts(keyword, pageable);
    }

    // "Đã xem gần đây" -- FE đọc danh sách productId từ localStorage rồi gọi 1 lần lấy đủ thông tin
    // hiển thị, thay vì gọi GET /products/{id} lặp lại N lần.
    @GetMapping("/products/by-ids")
    public List<ProductResponse> getProductsByIds(@RequestParam List<Long> ids) {
        return homeService.getProductsByIds(ids);
    }

    // Trang Shop: hợp nhất lọc danh mục/từ khoá/khoảng giá/size/màu vào 1 endpoint duy nhất -- mọi tham
    // số đều optional, không truyền = không lọc theo tiêu chí đó.
    @GetMapping("/products/filter")
    public PageResponse<ProductResponse> filterProducts(
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String color,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int pageSize) {
        Pageable pageable = PageRequest.of(page, pageSize);
        return homeService.filterProducts(categoryId, keyword, minPrice, maxPrice, size, color, pageable);
    }
}
