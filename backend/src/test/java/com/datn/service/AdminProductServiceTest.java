package com.datn.service;

import com.datn.dto.admin.AdminProductRequest;
import com.datn.dto.admin.AdminVariantRequest;
import com.datn.entity.Category;
import com.datn.entity.Product;
import com.datn.entity.ProductVariant;
import com.datn.exception.ApiException;
import com.datn.repository.BrandRepository;
import com.datn.repository.CartItemRepository;
import com.datn.repository.CategoryRepository;
import com.datn.repository.OrderItemRepository;
import com.datn.repository.ProductRepository;
import com.datn.repository.ProductVariantRepository;
import com.datn.security.PermissionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Ba cơ chế bảo vệ của màn Sản phẩm, mỗi cái khoá lại một lỗi đã xảy ra thật:
 *   - applyStock       : form gửi lại số tồn kho cũ không được ghi đè giao dịch bán vừa phát sinh
 *   - normalizeSku     : SKU bỏ trống phải tự sinh (cột sku có UNIQUE, SQL Server chỉ cho đúng 1 NULL)
 *   - assertRemovable  : không cho xoá phân loại đã phát sinh đơn / đang nằm trong giỏ khách
 *
 * Cả ba đều private, nên test đi qua API công khai update()/create() -- assert trên kết quả thay vì trên
 * cấu trúc nội bộ, nên không vỡ khi mã được sắp xếp lại.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminProductServiceTest {

    @Mock
    ProductRepository productRepository;
    @Mock
    CategoryRepository categoryRepository;
    @Mock
    BrandRepository brandRepository;
    @Mock
    ProductVariantRepository variantRepository;
    @Mock
    OrderItemRepository orderItemRepository;
    @Mock
    CartItemRepository cartItemRepository;
    @Mock
    PermissionService permissionService;
    @InjectMocks
    AdminProductService service;

    private Category danhMuc;
    private Product sanPham;
    private ProductVariant bienTheCu;

    @BeforeEach
    void setUp() {
        danhMuc = StatsFixtures.cat(1, "Áo thun", null);

        bienTheCu = new ProductVariant();
        bienTheCu.setVariantId(10L);
        bienTheCu.setSize("M");
        bienTheCu.setColor("Đen");
        bienTheCu.setSku("SKU-CU-1");
        bienTheCu.setStockQuantity(7); // số THẬT trong kho lúc này

        sanPham = new Product();
        sanPham.setProductId(1L);
        sanPham.setProductName("Áo thun basic");
        sanPham.setSlug("ao-thun-basic");
        sanPham.setCategory(danhMuc);
        sanPham.setStatus(Product.Status.ACTIVE);
        sanPham.setImages(new ArrayList<>());
        sanPham.setVariants(new ArrayList<>(List.of(bienTheCu)));
        bienTheCu.setProduct(sanPham);

        when(productRepository.findById(1L)).thenReturn(Optional.of(sanPham));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        when(categoryRepository.findById(1)).thenReturn(Optional.of(danhMuc));
        when(productRepository.existsBySlug(anyString())).thenReturn(false);
        when(variantRepository.existsBySku(anyString())).thenReturn(false);
        when(orderItemRepository.existsByVariant_VariantId(anyLong())).thenReturn(false);
        when(cartItemRepository.existsByVariant_VariantId(anyLong())).thenReturn(false);
        when(permissionService.isCurrentUserAdmin()).thenReturn(true);
    }

    private AdminVariantRequest bienThe(Long id, String size, String color, String sku,
                                        Integer stock, Integer stockGoc) {
        AdminVariantRequest r = new AdminVariantRequest();
        r.setVariantId(id);
        r.setSize(size);
        r.setColor(color);
        r.setSku(sku);
        r.setStockQuantity(stock);
        r.setOriginalStockQuantity(stockGoc);
        return r;
    }

    private AdminProductRequest yeuCau(AdminVariantRequest... bienThe) {
        AdminProductRequest r = new AdminProductRequest();
        r.setProductName("Áo thun basic");
        r.setDescription("mô tả");
        r.setCategoryId(1);
        r.setPrice(BigDecimal.valueOf(199_000));
        r.setMaterial("Cotton");
        r.setStatus(Product.Status.ACTIVE);
        r.setImageUrls(List.of("/uploads/products/a.jpg"));
        r.setVariants(List.of(bienThe));
        return r;
    }

    // ----- applyStock: chống ghi đè tồn kho bằng số cũ -----

    @Test
    @DisplayName("Sửa mô tả trong khi tồn kho đã đổi: KHÔNG ghi đè, giữ nguyên số thật trong kho")
    void suaMoTaKhongGhiDeTonKhoDaDoi() {
        // Form mở lúc kho còn 10, gửi lại y nguyên 10; trong lúc đó POS đã bán, kho thật còn 7.
        service.update(1L, yeuCau(bienThe(10L, "M", "Đen", "SKU-CU-1", 10, 10)));

        assertThat(bienTheCu.getStockQuantity())
                .as("Số gửi lên trùng số gốc = admin không có ý định đổi kho -> giữ nguyên giá trị thật")
                .isEqualTo(7);
    }

    @Test
    @DisplayName("Thật sự đổi tồn kho nhưng số gốc đã cũ: chặn và nêu rõ số hiện tại")
    void doiTonKhoVoiSoGocDaCuThiBiChan() {
        assertThatThrownBy(() -> service.update(1L, yeuCau(bienThe(10L, "M", "Đen", "SKU-CU-1", 50, 10))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("hiện là 7");

        assertThat(bienTheCu.getStockQuantity()).isEqualTo(7);
    }

    @Test
    @DisplayName("Đổi tồn kho với số gốc còn khớp thì ghi bình thường")
    void doiTonKhoVoiSoGocDungThiGhiDuoc() {
        service.update(1L, yeuCau(bienThe(10L, "M", "Đen", "SKU-CU-1", 99, 7)));

        assertThat(bienTheCu.getStockQuantity()).isEqualTo(99);
    }

    @Test
    @DisplayName("Nhân viên không được sửa tồn kho dù gửi số khác")
    void nhanVienKhongDuocSuaTonKho() {
        when(permissionService.isCurrentUserAdmin()).thenReturn(false);

        assertThatThrownBy(() -> service.update(1L, yeuCau(bienThe(10L, "M", "Đen", "SKU-CU-1", 99, 7))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("không có quyền sửa tồn kho");

        assertThat(bienTheCu.getStockQuantity()).isEqualTo(7);
    }

    @Test
    @DisplayName("Phân loại MỚI do nhân viên thêm luôn bắt đầu từ tồn kho 0")
    void bienTheMoiCuaNhanVienBatDauTuKhong() {
        when(permissionService.isCurrentUserAdmin()).thenReturn(false);

        Product kq = mapVe(service.update(1L, yeuCau(
                bienThe(10L, "M", "Đen", "SKU-CU-1", 7, 7),
                bienThe(null, "L", "Trắng", "", 500, null))));

        ProductVariant moi = kq.getVariants().stream()
                .filter(v -> "L".equals(v.getSize())).findFirst().orElseThrow();
        assertThat(moi.getStockQuantity())
                .as("Nhân viên khai 500 nhưng tồn kho là dữ liệu chỉ Admin được đặt")
                .isZero();
    }

    // ----- normalizeSku -----

    @Test
    @DisplayName("Hai phân loại cùng bỏ trống SKU vẫn lưu được, mỗi cái một mã riêng")
    void haiBienTheBoTrongSkuVanLuuDuoc() {
        Product kq = mapVe(service.update(1L, yeuCau(
                bienThe(10L, "M", "Đen", "SKU-CU-1", 7, 7),
                bienThe(null, "L", "Trắng", "", 0, null),
                bienThe(null, "XL", "Trắng", null, 0, null))));

        List<String> sku = kq.getVariants().stream().map(ProductVariant::getSku).toList();
        assertThat(sku).as("Không được có SKU rỗng/null -- cột sku có UNIQUE, SQL Server chỉ cho 1 NULL")
                .noneMatch(s -> s == null || s.isBlank());
        assertThat(sku).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("Phân loại đã có SKU thì giữ nguyên, không tự sinh đè lên")
    void giuNguyenSkuDaCo() {
        Product kq = mapVe(service.update(1L, yeuCau(bienThe(10L, "M", "Đen", "  ", 7, 7))));

        assertThat(kq.getVariants().get(0).getSku()).isEqualTo("SKU-CU-1");
    }

    // ----- Chặn trùng ngay trong 1 request -----

    @Test
    @DisplayName("Khai trùng size+màu trong cùng một lần lưu bị chặn, nêu đúng dòng trùng")
    void chanTrungSizeMauTrongCungRequest() {
        assertThatThrownBy(() -> service.update(1L, yeuCau(
                bienThe(10L, "M", "Đen", "SKU-CU-1", 7, 7),
                bienThe(null, "M", "Đen", "", 0, null))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("M / Đen");
    }

    @Test
    @DisplayName("Khai trùng SKU trong cùng một lần lưu bị chặn")
    void chanTrungSkuTrongCungRequest() {
        assertThatThrownBy(() -> service.update(1L, yeuCau(
                bienThe(10L, "M", "Đen", "DUP-1", 7, 7),
                bienThe(null, "L", "Trắng", "DUP-1", 0, null))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("DUP-1");
    }

    @Test
    @DisplayName("variantId không thuộc sản phẩm này thì báo lỗi, không âm thầm tạo thêm phân loại")
    void variantIdLaThiBaoLoi() {
        assertThatThrownBy(() -> service.update(1L, yeuCau(bienThe(999L, "M", "Đen", "X", 1, 1))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("không thuộc sản phẩm này");
    }

    // ----- assertRemovable -----

    @Test
    @DisplayName("Bỏ phân loại đã phát sinh đơn hàng: chặn kèm tên size/màu, không rollback cả lần lưu")
    void khongXoaDuocBienTheDaCoDonHang() {
        when(orderItemRepository.existsByVariant_VariantId(10L)).thenReturn(true);

        assertThatThrownBy(() -> service.update(1L, yeuCau(bienThe(null, "L", "Trắng", "", 0, null))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("đã phát sinh đơn hàng")
                .hasMessageContaining("M / Đen");
    }

    @Test
    @DisplayName("Bỏ phân loại đang nằm trong giỏ khách: thông báo khác, nêu đúng lý do")
    void khongXoaDuocBienTheDangTrongGio() {
        when(cartItemRepository.existsByVariant_VariantId(10L)).thenReturn(true);

        assertThatThrownBy(() -> service.update(1L, yeuCau(bienThe(null, "L", "Trắng", "", 0, null))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("giỏ hàng");
    }

    @Test
    @DisplayName("Phân loại chưa từng được đặt/thêm giỏ thì xoá được bình thường")
    void xoaDuocBienTheChuaDungToi() {
        assertThatCode(() -> service.update(1L, yeuCau(bienThe(null, "L", "Trắng", "", 0, null))))
                .doesNotThrowAnyException();
        assertThat(sanPham.getVariants()).extracting(ProductVariant::getSize).containsExactly("L");
    }

    // ----- Ràng buộc phía service (gọi thẳng API bỏ qua form vẫn phải chặn) -----

    @Test
    @DisplayName("Ảnh toàn chuỗi rỗng bị chặn ở service, không tin frontend đã lọc")
    void anhToanChuoiRongBiChan() {
        AdminProductRequest r = yeuCau(bienThe(10L, "M", "Đen", "SKU-CU-1", 7, 7));
        r.setImageUrls(List.of("", "   "));

        assertThatThrownBy(() -> service.update(1L, r))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ít nhất 1 ảnh");
    }

    @Test
    @DisplayName("Giá khuyến mãi cao hơn giá bán bị chặn")
    void giaKhuyenMaiCaoHonGiaBanBiChan() {
        AdminProductRequest r = yeuCau(bienThe(10L, "M", "Đen", "SKU-CU-1", 7, 7));
        r.setSalePrice(BigDecimal.valueOf(999_999));

        assertThatThrownBy(() -> service.update(1L, r))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("khuyến mãi");
    }

    // ----- Slug -----

    @Test
    @DisplayName("Tên không đổi thì slug giữ nguyên (không phá link đã chia sẻ)")
    void tenKhongDoiThiSlugGiuNguyen() {
        service.update(1L, yeuCau(bienThe(10L, "M", "Đen", "SKU-CU-1", 7, 7)));

        assertThat(sanPham.getSlug()).isEqualTo("ao-thun-basic");
    }

    @Test
    @DisplayName("Đổi tên thì slug mới bỏ dấu tiếng Việt đúng cách")
    void doiTenThiSlugBoDauDungCach() {
        AdminProductRequest r = yeuCau(bienThe(10L, "M", "Đen", "SKU-CU-1", 7, 7));
        r.setProductName("Áo sơ mi trắng");

        service.update(1L, r);

        assertThat(sanPham.getSlug())
                .as("Bản cũ lọc thẳng ký tự nên chữ có dấu bị XOÁ, ra 'o-s-mi-trng'")
                .isEqualTo("ao-so-mi-trang");
    }

    /** update() trả về DTO; các assert ở trên cần đối tượng Product thật nên đọc thẳng từ đồ thị đã bị sửa. */
    private Product mapVe(Object ignoredResponse) {
        return sanPham;
    }
}
