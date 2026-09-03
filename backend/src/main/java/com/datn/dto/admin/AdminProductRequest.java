package com.datn.dto.admin;

import com.datn.entity.Product;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class AdminProductRequest {

    // Các ràng buộc dưới đây phải khớp với form ở AdminProductsPage. Trước đây backend lỏng hơn frontend
    // (cho phép giá 0, không mô tả, không ảnh, không phân loại) nên gọi thẳng API là bỏ qua được -- form
    // chỉ là lớp tiện dụng, không phải lớp bảo vệ.

    @NotBlank(message = "Tên sản phẩm không được để trống")
    @Size(max = 200, message = "Tên sản phẩm tối đa 200 ký tự")
    private String productName;

    @NotBlank(message = "Mô tả sản phẩm không được để trống")
    private String description;

    @NotNull(message = "Vui lòng chọn danh mục")
    private Integer categoryId;

    private Integer brandId;

    // Giá 0đ vượt được @DecimalMin("0") cũ -> sản phẩm bán miễn phí (CartService lấy thẳng giá này).
    @NotNull(message = "Giá bán không được để trống")
    @DecimalMin(value = "0", inclusive = false, message = "Giá bán phải lớn hơn 0")
    private BigDecimal price;

    // null = không giảm giá
    @DecimalMin(value = "0", inclusive = false, message = "Giá khuyến mãi phải lớn hơn 0")
    private BigDecimal salePrice;

    @NotBlank(message = "Chất liệu không được để trống")
    @Size(max = 100, message = "Chất liệu tối đa 100 ký tự")
    private String material;

    private Product.Status status;

    // Danh sách URL ảnh theo đúng thứ tự hiển thị — ảnh đầu tiên là thumbnail.
    // Phần tử rỗng bị loại ở AdminProductService.syncImages (@NotEmpty không soi được nội dung từng phần tử).
    @NotEmpty(message = "Sản phẩm cần ít nhất 1 ảnh")
    private List<@Size(max = 255, message = "Đường dẫn ảnh tối đa 255 ký tự") String> imageUrls;

    // Danh sách phân loại size/màu — xem giải thích cơ chế đồng bộ ở AdminProductService.syncVariants
    @Valid
    @NotEmpty(message = "Sản phẩm cần ít nhất 1 phân loại (size/màu)")
    private List<AdminVariantRequest> variants;
}