-- =====================================================
-- DATABASE: Website bán quần áo nam (JavaWeb + SQL + React)
-- DBMS: Microsoft SQL Server (T-SQL)
-- Bản đầy đủ cho TOÀN BỘ dự án (Sprint 1: Auth/Address,
-- Sprint 2: Cart/Order, Sprint 3: Admin, Sprint 4: Review/Voucher)
-- =====================================================

IF DB_ID('menswear_shop') IS NOT NULL
BEGIN
    ALTER DATABASE menswear_shop SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE menswear_shop;
END
GO

CREATE DATABASE menswear_shop;
GO

USE menswear_shop;
GO

-- =====================================================
-- 1. PHÂN QUYỀN (ROLE) + TÀI KHOẢN (USER)
-- =====================================================

CREATE TABLE roles (
    role_id     INT IDENTITY(1,1) PRIMARY KEY,
    role_name   NVARCHAR(50) NOT NULL UNIQUE   -- ADMIN, CUSTOMER, STAFF...
);
GO

INSERT INTO roles (role_name) VALUES (N'ADMIN'), (N'CUSTOMER'), (N'STAFF');
GO

CREATE TABLE users (
    user_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    username        NVARCHAR(50)  NOT NULL UNIQUE,
    password        NVARCHAR(255) NOT NULL,        -- lưu hash (BCrypt)
    email           NVARCHAR(100) NOT NULL UNIQUE,
    full_name       NVARCHAR(100),
    phone           NVARCHAR(20),
    avatar_url      NVARCHAR(255),
    is_active       BIT DEFAULT 1,                  -- khóa/mở tài khoản
    created_at      DATETIME2 DEFAULT SYSDATETIME(),
    updated_at      DATETIME2 DEFAULT SYSDATETIME()
);
GO

-- Một user có thể có nhiều role (thiết kế linh hoạt, dù thường chỉ 1)
CREATE TABLE user_roles (
    user_id     BIGINT NOT NULL,
    role_id     INT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
);
GO

-- Địa chỉ giao hàng của khách hàng (1 user có nhiều địa chỉ)
CREATE TABLE addresses (
    address_id      BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    receiver_name   NVARCHAR(100) NOT NULL,
    phone           NVARCHAR(20) NOT NULL,
    province        NVARCHAR(100),
    district        NVARCHAR(100),
    ward            NVARCHAR(100),
    detail_address  NVARCHAR(255),
    is_default      BIT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
GO

-- =====================================================
-- 2. LOẠI QUẦN ÁO (CATEGORY) - hỗ trợ danh mục cha/con
-- =====================================================

CREATE TABLE categories (
    category_id     INT IDENTITY(1,1) PRIMARY KEY,
    category_name   NVARCHAR(100) NOT NULL,        -- Áo thun, Quần jean, Áo sơ mi...
    parent_id       INT NULL,                       -- danh mục cha (NULL nếu là gốc)
    slug            NVARCHAR(150) UNIQUE,
    description     NVARCHAR(MAX),
    -- Mới thêm: ảnh đại diện danh mục (dùng cho CategoriesPage + mega menu ở trang chủ)
    image_url       NVARCHAR(255) NULL,
    is_active       BIT DEFAULT 1,
    FOREIGN KEY (parent_id) REFERENCES categories(category_id)
);
GO

-- =====================================================
-- 3. THƯƠNG HIỆU (gợi ý thêm - nhiều shop quần áo cần)
-- =====================================================

CREATE TABLE brands (
    brand_id    INT IDENTITY(1,1) PRIMARY KEY,
    brand_name  NVARCHAR(100) NOT NULL UNIQUE,
    logo_url    NVARCHAR(255)
);
GO

-- =====================================================
-- 4. SẢN PHẨM (PRODUCT)
-- =====================================================

CREATE TABLE products (
    product_id      BIGINT IDENTITY(1,1) PRIMARY KEY,
    product_name    NVARCHAR(200) NOT NULL,
    slug            NVARCHAR(220) UNIQUE,
    description     NVARCHAR(MAX),
    category_id     INT NOT NULL,
    brand_id        INT NULL,
    price           DECIMAL(12,2) NOT NULL,         -- giá gốc
    sale_price      DECIMAL(12,2) NULL,             -- giá khuyến mãi (nếu có)
    material        NVARCHAR(100),                  -- chất liệu: cotton, kaki...
    status          NVARCHAR(20) DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','INACTIVE','OUT_OF_STOCK')),
    created_at      DATETIME2 DEFAULT SYSDATETIME(),
    updated_at      DATETIME2 DEFAULT SYSDATETIME(),
    created_by      BIGINT NULL,                    -- admin nào tạo sản phẩm
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (brand_id) REFERENCES brands(brand_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);
GO

-- Ảnh sản phẩm: 1 sản phẩm có nhiều ảnh
CREATE TABLE product_images (
    image_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    product_id      BIGINT NOT NULL,
    image_url       NVARCHAR(255) NOT NULL,
    is_thumbnail    BIT DEFAULT 0,                  -- ảnh đại diện hiển thị ở danh sách
    display_order   INT DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
GO

-- Biến thể sản phẩm: size + màu + số lượng tồn kho riêng (gợi ý quan trọng cho shop quần áo)
CREATE TABLE product_variants (
    variant_id      BIGINT IDENTITY(1,1) PRIMARY KEY,
    product_id      BIGINT NOT NULL,
    size            NVARCHAR(20) NOT NULL,          -- S, M, L, XL, XXL...
    color           NVARCHAR(50) NOT NULL,           -- Đen, Trắng, Xanh...
    sku             NVARCHAR(100) UNIQUE,            -- mã quản lý kho
    stock_quantity  INT DEFAULT 0,
    CONSTRAINT uq_product_size_color UNIQUE (product_id, size, color),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
GO

-- =====================================================
-- 5. GIỎ HÀNG (CART)
-- =====================================================

CREATE TABLE carts (
    cart_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id     BIGINT NOT NULL UNIQUE,
    updated_at  DATETIME2 DEFAULT SYSDATETIME(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
GO

CREATE TABLE cart_items (
    cart_item_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    cart_id         BIGINT NOT NULL,
    variant_id      BIGINT NOT NULL,
    quantity        INT NOT NULL DEFAULT 1,
    FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);
GO

-- =====================================================
-- 6. ĐƠN HÀNG (ORDER)
-- =====================================================

CREATE TABLE orders (
    order_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id             BIGINT NOT NULL,
    address_id          BIGINT NULL,
    order_code          NVARCHAR(50) UNIQUE,
    total_amount        DECIMAL(14,2) NOT NULL,
    -- Sprint 4: chi tiết áp mã giảm giá (mới thêm so với bản gốc)
    subtotal_amount     DECIMAL(14,2) NULL,                  -- tổng tiền hàng TRƯỚC khi giảm giá
    discount_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,    -- số tiền đã giảm nhờ voucher
    voucher_code        NVARCHAR(50) NULL,                   -- snapshot mã đã dùng
    status              NVARCHAR(20) DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING','CONFIRMED','SHIPPING','COMPLETED','CANCELLED')),
    payment_method      NVARCHAR(20) DEFAULT 'COD'
                            CHECK (payment_method IN ('COD','BANK_TRANSFER','MOMO','VNPAY')),
    payment_status      NVARCHAR(20) DEFAULT 'UNPAID'
                            CHECK (payment_status IN ('UNPAID','PAID','REFUNDED')),
    note                NVARCHAR(255),
    created_at          DATETIME2 DEFAULT SYSDATETIME(),
    updated_at          DATETIME2 DEFAULT SYSDATETIME(),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (address_id) REFERENCES addresses(address_id)
);
GO

CREATE TABLE order_items (
    order_item_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id        BIGINT NOT NULL,
    variant_id      BIGINT NOT NULL,
    product_name    NVARCHAR(200) NOT NULL,  -- lưu lại tên tại thời điểm mua
    size            NVARCHAR(20),
    color           NVARCHAR(50),
    unit_price      DECIMAL(12,2) NOT NULL,  -- giá tại thời điểm mua
    quantity        INT NOT NULL,
    -- Mới thêm: OrderItem.java (Sprint 2) tính subtotal = unit_price * quantity
    -- ngay lúc đặt hàng rồi lưu lại (không tính động mỗi lần xem), nên bảng cần cột này
    subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id)
);
GO

-- =====================================================
-- 7. ĐÁNH GIÁ SẢN PHẨM (REVIEW)
-- =====================================================

CREATE TABLE reviews (
    review_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    product_id  BIGINT NOT NULL,
    user_id     BIGINT NOT NULL,
    rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     NVARCHAR(MAX),
    created_at  DATETIME2 DEFAULT SYSDATETIME(),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    -- Mới thêm: chặn 1 user đánh giá trùng 1 sản phẩm ngay ở tầng DB
    -- (trước đó chỉ được chặn ở tầng code, không an toàn tuyệt đối)
    CONSTRAINT uq_review_user_product UNIQUE (user_id, product_id)
);
GO

-- =====================================================
-- 8. MÃ GIẢM GIÁ (VOUCHER)
-- =====================================================

CREATE TABLE vouchers (
    voucher_id          INT IDENTITY(1,1) PRIMARY KEY,
    code                NVARCHAR(50) UNIQUE NOT NULL,
    discount_type       NVARCHAR(10) NOT NULL CHECK (discount_type IN ('PERCENT','AMOUNT')),
    discount_value      DECIMAL(12,2) NOT NULL,
    min_order_value     DECIMAL(12,2) DEFAULT 0,
    -- Sprint 4: 2 cột dưới đây mới thêm so với bản gốc
    max_discount_amount DECIMAL(12,2) NULL,          -- chỉ dùng cho loại PERCENT, chặn giảm quá nhiều
    used_count          INT NOT NULL DEFAULT 0,      -- đếm số lượt đã dùng, so sánh với usage_limit
    start_date          DATE,
    end_date            DATE,
    usage_limit         INT DEFAULT 0,
    is_active           BIT DEFAULT 1
);
GO

-- =====================================================
-- INDEX để tăng tốc truy vấn thường dùng
-- =====================================================

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status   ON products(status);
CREATE INDEX idx_variants_product  ON product_variants(product_id);
CREATE INDEX idx_orders_user       ON orders(user_id);
CREATE INDEX idx_orders_status     ON orders(status);
GO

-- =====================================================
-- DỮ LIỆU MẪU (SEED DATA)
-- =====================================================

-- Admin mặc định — mật khẩu: Admin@123
-- (hash BCrypt THẬT tạo bằng bcrypt rounds=10, KHÔNG còn là chuỗi placeholder
-- giả '$2a$10$hashedpasswordplaceholder' như bản gốc — chuỗi đó không đăng
-- nhập được vì không phải hash hợp lệ)
INSERT INTO users (username, password, email, full_name, is_active)
VALUES (N'admin', N'$2b$10$PhCqGHhTMbwMYDVpp3AegO48UpBVOo8u69UdfhCaVnR/0kTKxXkIK', N'admin@menswear.com', N'Quản trị viên', 1);
GO

INSERT INTO user_roles (user_id, role_id)
SELECT user_id, role_id FROM users, roles WHERE username = N'admin' AND role_name = N'ADMIN';
GO

-- Thương hiệu mẫu
INSERT INTO brands (brand_name) VALUES (N'Local Brand'), (N'No Brand');
GO

-- Sản phẩm mẫu: danh mục 2 cấp (Áo / Quần / Đồ mặc trong / Suit & Blazer / Bộ đồ)
-- + hàng trăm sản phẩm mẫu để trang chủ, shop, mega-menu có dữ liệu thật ngay khi chạy script.
-- =====================================================
-- DANH MỤC + SẢN PHẨM MỞ RỘNG (sinh tự động — xem gen_seed.py)
-- =====================================================

-- ---- Danh mục cấp 1 (nhóm cha) ----
INSERT INTO categories (category_name, slug, image_url, is_active) VALUES
(N'Áo', N'ao', N'https://picsum.photos/seed/cat-ao/700/900', 1),
(N'Quần', N'quan', N'https://picsum.photos/seed/cat-quan/700/900', 1),
(N'Đồ mặc trong', N'do-mac-trong', N'https://picsum.photos/seed/cat-do-mac-trong/700/900', 1),
(N'Suit & Blazer', N'suit-blazer', N'https://picsum.photos/seed/cat-suit-blazer/700/900', 1),
(N'Bộ đồ', N'bo-do', N'https://picsum.photos/seed/cat-bo-do/700/900', 1);
GO

-- ---- Danh mục con của nhóm 'ao' ----
DECLARE @parent_ao INT = (SELECT category_id FROM categories WHERE slug = N'ao');
INSERT INTO categories (category_name, slug, parent_id, image_url, is_active) VALUES
(N'Áo thun', N'ao-thun', @parent_ao, N'https://picsum.photos/seed/cat-ao-thun/700/900', 1),
(N'Áo sơ mi', N'ao-so-mi', @parent_ao, N'https://picsum.photos/seed/cat-ao-so-mi/700/900', 1),
(N'Áo khoác', N'ao-khoac', @parent_ao, N'https://picsum.photos/seed/cat-ao-khoac/700/900', 1),
(N'Áo dài', N'ao-dai', @parent_ao, N'https://picsum.photos/seed/cat-ao-dai/700/900', 1),
(N'Áo tanktop', N'ao-tanktop', @parent_ao, N'https://picsum.photos/seed/cat-ao-tanktop/700/900', 1),
(N'Áo polo', N'ao-polo', @parent_ao, N'https://picsum.photos/seed/cat-ao-polo/700/900', 1);
GO

-- ---- Danh mục con của nhóm 'quan' ----
DECLARE @parent_quan INT = (SELECT category_id FROM categories WHERE slug = N'quan');
INSERT INTO categories (category_name, slug, parent_id, image_url, is_active) VALUES
(N'Quần tây', N'quan-tay', @parent_quan, N'https://picsum.photos/seed/cat-quan-tay/700/900', 1),
(N'Quần jeans', N'quan-jeans', @parent_quan, N'https://picsum.photos/seed/cat-quan-jeans/700/900', 1),
(N'Quần short', N'quan-short', @parent_quan, N'https://picsum.photos/seed/cat-quan-short/700/900', 1),
(N'Quần thể thao', N'quan-the-thao', @parent_quan, N'https://picsum.photos/seed/cat-quan-the-thao/700/900', 1),
(N'Quần slim fit', N'quan-slim-fit', @parent_quan, N'https://picsum.photos/seed/cat-quan-slim-fit/700/900', 1),
(N'Quần kaki', N'quan-kaki', @parent_quan, N'https://picsum.photos/seed/cat-quan-kaki/700/900', 1),
(N'Quần âu', N'quan-au', @parent_quan, N'https://picsum.photos/seed/cat-quan-au/700/900', 1),
(N'Quần regular fit', N'quan-regular-fit', @parent_quan, N'https://picsum.photos/seed/cat-quan-regular-fit/700/900', 1),
(N'Quần fiero', N'quan-fiero', @parent_quan, N'https://picsum.photos/seed/cat-quan-fiero/700/900', 1),
(N'Quần cropped', N'quan-cropped', @parent_quan, N'https://picsum.photos/seed/cat-quan-cropped/700/900', 1);
GO

-- ---- Danh mục con của nhóm 'do-mac-trong' ----
DECLARE @parent_do_mac_trong INT = (SELECT category_id FROM categories WHERE slug = N'do-mac-trong');
INSERT INTO categories (category_name, slug, parent_id, image_url, is_active) VALUES
(N'Quần boxer', N'quan-boxer', @parent_do_mac_trong, N'https://picsum.photos/seed/cat-quan-boxer/700/900', 1),
(N'Áo lót', N'ao-lot', @parent_do_mac_trong, N'https://picsum.photos/seed/cat-ao-lot/700/900', 1),
(N'Quần brief', N'quan-brief', @parent_do_mac_trong, N'https://picsum.photos/seed/cat-quan-brief/700/900', 1),
(N'Đồ giữ nhiệt', N'do-giu-nhiet', @parent_do_mac_trong, N'https://picsum.photos/seed/cat-do-giu-nhiet/700/900', 1);
GO

-- ---- Danh mục con của nhóm 'suit-blazer' ----
DECLARE @parent_suit_blazer INT = (SELECT category_id FROM categories WHERE slug = N'suit-blazer');
INSERT INTO categories (category_name, slug, parent_id, image_url, is_active) VALUES
(N'Bộ suit', N'bo-suit', @parent_suit_blazer, N'https://picsum.photos/seed/cat-bo-suit/700/900', 1),
(N'Blazer', N'blazer', @parent_suit_blazer, N'https://picsum.photos/seed/cat-blazer/700/900', 1);
GO

-- =====================================================
-- SẢN PHẨM THEO TỪNG DANH MỤC CON
-- =====================================================

-- ===== Áo thun (ao-thun) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_ao_thun INT = (SELECT category_id FROM categories WHERE slug = N'ao-thun');
DECLARE @new_ao_thun TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_ao_thun(product_id, slug)
VALUES
(N'Áo thun form rộng oversize - Cotton 4 chiều', N'ao-thun-form-rong-oversize-cotton-4-chieu-01', N'Áo thun form rộng oversize - Cotton 4 chiều, màu xanh navy, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 149000, NULL, N'Cotton 4 chiều', N'ACTIVE'),
(N'Áo thun cổ tim - Cotton Compact', N'ao-thun-co-tim-cotton-compact-02', N'Áo thun cổ tim - Cotton Compact, màu xanh rêu, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton compact, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 169000, NULL, N'Cotton Compact', N'ACTIVE'),
(N'Áo thun in họa tiết - Cotton 100%', N'ao-thun-in-hoa-tiet-cotton-100-03', N'Áo thun in họa tiết - Cotton 100%, màu xanh rêu, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 189000, 155000, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun form rộng oversize - Cotton Compact', N'ao-thun-form-rong-oversize-cotton-compact-04', N'Áo thun form rộng oversize - Cotton Compact, màu xanh rêu, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton compact, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 209000, NULL, N'Cotton Compact', N'ACTIVE'),
(N'Áo thun form ôm - Polyester', N'ao-thun-form-om-polyester-05', N'Áo thun form ôm - Polyester, màu đen, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 229000, NULL, N'Polyester', N'ACTIVE'),
(N'Áo thun phối màu tay - Cotton lạnh', N'ao-thun-phoi-mau-tay-cotton-lanh-06', N'Áo thun phối màu tay - Cotton lạnh, màu xanh rêu, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 259000, 212000, N'Cotton lạnh', N'ACTIVE'),
(N'Áo thun form rộng oversize - Cotton 100%', N'ao-thun-form-rong-oversize-cotton-100-07', N'Áo thun form rộng oversize - Cotton 100%, màu xanh rêu, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 279000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun form rộng oversize - Polyester', N'ao-thun-form-rong-oversize-polyester-08', N'Áo thun form rộng oversize - Polyester, màu be, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 299000, NULL, N'Polyester', N'ACTIVE'),
(N'Áo thun tay lỡ - Cotton 100%', N'ao-thun-tay-lo-cotton-100-09', N'Áo thun tay lỡ - Cotton 100%, màu xanh rêu, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 349000, 286000, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun sọc ngang - Cotton 100%', N'ao-thun-soc-ngang-cotton-100-10', N'Áo thun sọc ngang - Cotton 100%, màu trắng, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 129000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun cổ tròn - Cotton 100%', N'ao-thun-co-tron-cotton-100-11', N'Áo thun cổ tròn - Cotton 100%, màu xanh rêu, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 149000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun cổ tròn - Polyester', N'ao-thun-co-tron-polyester-12', N'Áo thun cổ tròn - Polyester, màu xanh rêu, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 169000, 139000, N'Polyester', N'ACTIVE'),
(N'Áo thun tay lỡ - Cotton Compact', N'ao-thun-tay-lo-cotton-compact-13', N'Áo thun tay lỡ - Cotton Compact, màu xám, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton compact, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 189000, NULL, N'Cotton Compact', N'ACTIVE'),
(N'Áo thun form ôm - Cotton 100%', N'ao-thun-form-om-cotton-100-14', N'Áo thun form ôm - Cotton 100%, màu be, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 209000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun cổ tròn - Cotton 100%', N'ao-thun-co-tron-cotton-100-15', N'Áo thun cổ tròn - Cotton 100%, màu đen, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 229000, 188000, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun cổ tròn - Cotton 4 chiều', N'ao-thun-co-tron-cotton-4-chieu-16', N'Áo thun cổ tròn - Cotton 4 chiều, màu đen, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 259000, NULL, N'Cotton 4 chiều', N'ACTIVE'),
(N'Áo thun in họa tiết - Cotton Compact', N'ao-thun-in-hoa-tiet-cotton-compact-17', N'Áo thun in họa tiết - Cotton Compact, màu xanh rêu, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton compact, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 279000, NULL, N'Cotton Compact', N'ACTIVE'),
(N'Áo thun form rộng oversize - Polyester', N'ao-thun-form-rong-oversize-polyester-18', N'Áo thun form rộng oversize - Polyester, màu đen, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 299000, 245000, N'Polyester', N'ACTIVE'),
(N'Áo thun cổ tròn - Cotton Compact', N'ao-thun-co-tron-cotton-compact-19', N'Áo thun cổ tròn - Cotton Compact, màu xám, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton compact, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 349000, NULL, N'Cotton Compact', N'ACTIVE'),
(N'Áo thun trơn basic - Cotton Compact', N'ao-thun-tron-basic-cotton-compact-20', N'Áo thun trơn basic - Cotton Compact, màu xám, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton compact, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 129000, NULL, N'Cotton Compact', N'ACTIVE'),
(N'Áo thun cổ tim - Cotton 4 chiều', N'ao-thun-co-tim-cotton-4-chieu-21', N'Áo thun cổ tim - Cotton 4 chiều, màu đen, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 149000, 122000, N'Cotton 4 chiều', N'ACTIVE'),
(N'Áo thun tay lỡ - Cotton 100%', N'ao-thun-tay-lo-cotton-100-22', N'Áo thun tay lỡ - Cotton 100%, màu trắng, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 169000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun trơn basic - Cotton 4 chiều', N'ao-thun-tron-basic-cotton-4-chieu-23', N'Áo thun trơn basic - Cotton 4 chiều, màu trắng, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 189000, NULL, N'Cotton 4 chiều', N'ACTIVE'),
(N'Áo thun cổ tim - Polyester', N'ao-thun-co-tim-polyester-24', N'Áo thun cổ tim - Polyester, màu xanh navy, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 209000, 171000, N'Polyester', N'ACTIVE'),
(N'Áo thun in họa tiết - Cotton 100%', N'ao-thun-in-hoa-tiet-cotton-100-25', N'Áo thun in họa tiết - Cotton 100%, màu xám, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 229000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun form ôm - Cotton 100%', N'ao-thun-form-om-cotton-100-26', N'Áo thun form ôm - Cotton 100%, màu xám, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 259000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun form ôm - Cotton 100%', N'ao-thun-form-om-cotton-100-27', N'Áo thun form ôm - Cotton 100%, màu trắng, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 279000, 229000, N'Cotton 100%', N'ACTIVE'),
(N'Áo thun form ôm - Cotton 4 chiều', N'ao-thun-form-om-cotton-4-chieu-28', N'Áo thun form ôm - Cotton 4 chiều, màu xanh navy, phù hợp mặc hằng ngày, đi chơi, đi học. Chất liệu cotton 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_ao_thun, @brandLocal, 299000, NULL, N'Cotton 4 chiều', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_ao_thun
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_ao_thun;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_ao_thun n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Trắng'), (N'L', N'Đen'), (N'XL', N'Trắng')) AS x(size, color);
GO

-- ===== Áo sơ mi (ao-so-mi) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_ao_so_mi INT = (SELECT category_id FROM categories WHERE slug = N'ao-so-mi');
DECLARE @new_ao_so_mi TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_ao_so_mi(product_id, slug)
VALUES
(N'Áo sơ mi tay ngắn basic - Kate Ford', N'ao-so-mi-tay-ngan-basic-kate-ford-01', N'Áo sơ mi tay ngắn basic - Kate Ford, màu be, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate ford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 289000, NULL, N'Kate Ford', N'ACTIVE'),
(N'Áo sơ mi linen mùa hè - Kate Ford', N'ao-so-mi-linen-mua-he-kate-ford-02', N'Áo sơ mi linen mùa hè - Kate Ford, màu xám, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate ford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 319000, NULL, N'Kate Ford', N'ACTIVE'),
(N'Áo sơ mi caro flannel - Cotton cao cấp', N'ao-so-mi-caro-flannel-cotton-cao-cap-03', N'Áo sơ mi caro flannel - Cotton cao cấp, màu be, phù hợp đi làm, đi học, dự tiệc. Chất liệu cotton cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 349000, 286000, N'Cotton cao cấp', N'ACTIVE'),
(N'Áo sơ mi caro flannel - Kate lụa', N'ao-so-mi-caro-flannel-kate-lua-04', N'Áo sơ mi caro flannel - Kate lụa, màu xanh navy, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 379000, NULL, N'Kate lụa', N'ACTIVE'),
(N'Áo sơ mi tay ngắn basic - Cotton cao cấp', N'ao-so-mi-tay-ngan-basic-cotton-cao-cap-05', N'Áo sơ mi tay ngắn basic - Cotton cao cấp, màu xanh nhạt, phù hợp đi làm, đi học, dự tiệc. Chất liệu cotton cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 399000, NULL, N'Cotton cao cấp', N'ACTIVE'),
(N'Áo sơ mi vải lụa cao cấp - Kate Ford', N'ao-so-mi-vai-lua-cao-cap-kate-ford-06', N'Áo sơ mi vải lụa cao cấp - Kate Ford, màu be, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate ford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 449000, 368000, N'Kate Ford', N'ACTIVE'),
(N'Áo sơ mi tay ngắn basic - Linen', N'ao-so-mi-tay-ngan-basic-linen-07', N'Áo sơ mi tay ngắn basic - Linen, màu đen, phù hợp đi làm, đi học, dự tiệc. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 489000, NULL, N'Linen', N'ACTIVE'),
(N'Áo sơ mi form slim - Kate Ford', N'ao-so-mi-form-slim-kate-ford-08', N'Áo sơ mi form slim - Kate Ford, màu trắng, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate ford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 529000, NULL, N'Kate Ford', N'ACTIVE'),
(N'Áo sơ mi caro flannel - Cotton cao cấp', N'ao-so-mi-caro-flannel-cotton-cao-cap-09', N'Áo sơ mi caro flannel - Cotton cao cấp, màu đen, phù hợp đi làm, đi học, dự tiệc. Chất liệu cotton cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 599000, 491000, N'Cotton cao cấp', N'ACTIVE'),
(N'Áo sơ mi công sở tay dài - Cotton cao cấp', N'ao-so-mi-cong-so-tay-dai-cotton-cao-cap-10', N'Áo sơ mi công sở tay dài - Cotton cao cấp, màu xanh nhạt, phù hợp đi làm, đi học, dự tiệc. Chất liệu cotton cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 259000, NULL, N'Cotton cao cấp', N'ACTIVE'),
(N'Áo sơ mi linen mùa hè - Linen', N'ao-so-mi-linen-mua-he-linen-11', N'Áo sơ mi linen mùa hè - Linen, màu xanh navy, phù hợp đi làm, đi học, dự tiệc. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 289000, NULL, N'Linen', N'ACTIVE'),
(N'Áo sơ mi form slim - Oxford', N'ao-so-mi-form-slim-oxford-12', N'Áo sơ mi form slim - Oxford, màu xám, phù hợp đi làm, đi học, dự tiệc. Chất liệu oxford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 319000, 262000, N'Oxford', N'ACTIVE'),
(N'Áo sơ mi chống nhăn - Linen', N'ao-so-mi-chong-nhan-linen-13', N'Áo sơ mi chống nhăn - Linen, màu xanh navy, phù hợp đi làm, đi học, dự tiệc. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 349000, NULL, N'Linen', N'ACTIVE'),
(N'Áo sơ mi caro flannel - Kate Ford', N'ao-so-mi-caro-flannel-kate-ford-14', N'Áo sơ mi caro flannel - Kate Ford, màu trắng, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate ford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 379000, NULL, N'Kate Ford', N'ACTIVE'),
(N'Áo sơ mi sọc kẻ lịch lãm - Kate Ford', N'ao-so-mi-soc-ke-lich-lam-kate-ford-15', N'Áo sơ mi sọc kẻ lịch lãm - Kate Ford, màu xanh navy, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate ford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 399000, 327000, N'Kate Ford', N'ACTIVE'),
(N'Áo sơ mi chống nhăn - Oxford', N'ao-so-mi-chong-nhan-oxford-16', N'Áo sơ mi chống nhăn - Oxford, màu xám, phù hợp đi làm, đi học, dự tiệc. Chất liệu oxford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 449000, NULL, N'Oxford', N'ACTIVE'),
(N'Áo sơ mi công sở tay dài - Cotton cao cấp', N'ao-so-mi-cong-so-tay-dai-cotton-cao-cap-17', N'Áo sơ mi công sở tay dài - Cotton cao cấp, màu đen, phù hợp đi làm, đi học, dự tiệc. Chất liệu cotton cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 489000, NULL, N'Cotton cao cấp', N'ACTIVE'),
(N'Áo sơ mi tay ngắn basic - Linen', N'ao-so-mi-tay-ngan-basic-linen-18', N'Áo sơ mi tay ngắn basic - Linen, màu xanh nhạt, phù hợp đi làm, đi học, dự tiệc. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 529000, 434000, N'Linen', N'ACTIVE'),
(N'Áo sơ mi sọc kẻ lịch lãm - Kate Ford', N'ao-so-mi-soc-ke-lich-lam-kate-ford-19', N'Áo sơ mi sọc kẻ lịch lãm - Kate Ford, màu be, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate ford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 599000, NULL, N'Kate Ford', N'ACTIVE'),
(N'Áo sơ mi tay ngắn basic - Kate Ford', N'ao-so-mi-tay-ngan-basic-kate-ford-20', N'Áo sơ mi tay ngắn basic - Kate Ford, màu xanh navy, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate ford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 259000, NULL, N'Kate Ford', N'ACTIVE'),
(N'Áo sơ mi caro flannel - Oxford', N'ao-so-mi-caro-flannel-oxford-21', N'Áo sơ mi caro flannel - Oxford, màu xám, phù hợp đi làm, đi học, dự tiệc. Chất liệu oxford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 289000, 237000, N'Oxford', N'ACTIVE'),
(N'Áo sơ mi vải lụa cao cấp - Kate Ford', N'ao-so-mi-vai-lua-cao-cap-kate-ford-22', N'Áo sơ mi vải lụa cao cấp - Kate Ford, màu xanh navy, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate ford, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 319000, NULL, N'Kate Ford', N'ACTIVE'),
(N'Áo sơ mi phối túi ngực - Cotton cao cấp', N'ao-so-mi-phoi-tui-nguc-cotton-cao-cap-23', N'Áo sơ mi phối túi ngực - Cotton cao cấp, màu trắng, phù hợp đi làm, đi học, dự tiệc. Chất liệu cotton cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 349000, NULL, N'Cotton cao cấp', N'ACTIVE'),
(N'Áo sơ mi linen mùa hè - Cotton cao cấp', N'ao-so-mi-linen-mua-he-cotton-cao-cap-24', N'Áo sơ mi linen mùa hè - Cotton cao cấp, màu xám, phù hợp đi làm, đi học, dự tiệc. Chất liệu cotton cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 379000, 311000, N'Cotton cao cấp', N'ACTIVE'),
(N'Áo sơ mi form slim - Cotton cao cấp', N'ao-so-mi-form-slim-cotton-cao-cap-25', N'Áo sơ mi form slim - Cotton cao cấp, màu đen, phù hợp đi làm, đi học, dự tiệc. Chất liệu cotton cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 399000, NULL, N'Cotton cao cấp', N'ACTIVE'),
(N'Áo sơ mi vải lụa cao cấp - Kate lụa', N'ao-so-mi-vai-lua-cao-cap-kate-lua-26', N'Áo sơ mi vải lụa cao cấp - Kate lụa, màu xanh nhạt, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 449000, NULL, N'Kate lụa', N'ACTIVE'),
(N'Áo sơ mi chống nhăn - Linen', N'ao-so-mi-chong-nhan-linen-27', N'Áo sơ mi chống nhăn - Linen, màu xám, phù hợp đi làm, đi học, dự tiệc. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 489000, 401000, N'Linen', N'ACTIVE'),
(N'Áo sơ mi form slim - Kate lụa', N'ao-so-mi-form-slim-kate-lua-28', N'Áo sơ mi form slim - Kate lụa, màu xám, phù hợp đi làm, đi học, dự tiệc. Chất liệu kate lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_so_mi, @brandLocal, 529000, NULL, N'Kate lụa', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_ao_so_mi
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_ao_so_mi;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_ao_so_mi n
CROSS APPLY (VALUES (N'S', N'Trắng'), (N'M', N'Xanh nhạt'), (N'L', N'Trắng'), (N'XL', N'Xanh nhạt')) AS x(size, color);
GO

-- ===== Áo khoác (ao-khoac) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_ao_khoac INT = (SELECT category_id FROM categories WHERE slug = N'ao-khoac');
DECLARE @new_ao_khoac TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_ao_khoac(product_id, slug)
VALUES
(N'Áo khoác phao siêu nhẹ - Da PU', N'ao-khoac-phao-sieu-nhe-da-pu-01', N'Áo khoác phao siêu nhẹ - Da PU, màu nâu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu da pu, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 449000, NULL, N'Da PU', N'ACTIVE'),
(N'Áo khoác form oversize - Da PU', N'ao-khoac-form-oversize-da-pu-02', N'Áo khoác form oversize - Da PU, màu xám, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu da pu, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 499000, NULL, N'Da PU', N'ACTIVE'),
(N'Áo khoác da lộn phối - Polyester chống nước', N'ao-khoac-da-lon-phoi-polyester-chong-nuoc-03', N'Áo khoác da lộn phối - Polyester chống nước, màu xám, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu polyester chống nước, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 549000, 450000, N'Polyester chống nước', N'ACTIVE'),
(N'Áo khoác denim phối túi - Da PU', N'ao-khoac-denim-phoi-tui-da-pu-04', N'Áo khoác denim phối túi - Da PU, màu rêu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu da pu, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 599000, NULL, N'Da PU', N'ACTIVE'),
(N'Áo khoác bomber cá tính - Denim', N'ao-khoac-bomber-ca-tinh-denim-05', N'Áo khoác bomber cá tính - Denim, màu rêu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 649000, NULL, N'Denim', N'ACTIVE'),
(N'Áo khoác kaki basic - Dạ nỉ', N'ao-khoac-kaki-basic-da-ni-06', N'Áo khoác kaki basic - Dạ nỉ, màu đen, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu dạ nỉ, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 699000, 573000, N'Dạ nỉ', N'ACTIVE'),
(N'Áo khoác phao siêu nhẹ - Polyester chống nước', N'ao-khoac-phao-sieu-nhe-polyester-chong-nuoc-07', N'Áo khoác phao siêu nhẹ - Polyester chống nước, màu rêu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu polyester chống nước, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 749000, NULL, N'Polyester chống nước', N'ACTIVE'),
(N'Áo khoác denim phối túi - Polyester chống nước', N'ao-khoac-denim-phoi-tui-polyester-chong-nuoc-08', N'Áo khoác denim phối túi - Polyester chống nước, màu xanh navy, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu polyester chống nước, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 799000, NULL, N'Polyester chống nước', N'ACTIVE'),
(N'Áo khoác gió chống nắng - Dạ nỉ', N'ao-khoac-gio-chong-nang-da-ni-09', N'Áo khoác gió chống nắng - Dạ nỉ, màu đen, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu dạ nỉ, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 899000, 737000, N'Dạ nỉ', N'ACTIVE'),
(N'Áo khoác gió chống nắng - Denim', N'ao-khoac-gio-chong-nang-denim-10', N'Áo khoác gió chống nắng - Denim, màu xanh navy, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 399000, NULL, N'Denim', N'ACTIVE'),
(N'Áo khoác hoodie zip - Dạ nỉ', N'ao-khoac-hoodie-zip-da-ni-11', N'Áo khoác hoodie zip - Dạ nỉ, màu xám, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu dạ nỉ, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 449000, NULL, N'Dạ nỉ', N'ACTIVE'),
(N'Áo khoác nỉ zip form rộng - Kaki', N'ao-khoac-ni-zip-form-rong-kaki-12', N'Áo khoác nỉ zip form rộng - Kaki, màu đen, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 499000, 409000, N'Kaki', N'ACTIVE'),
(N'Áo khoác da lộn phối - Da PU', N'ao-khoac-da-lon-phoi-da-pu-13', N'Áo khoác da lộn phối - Da PU, màu nâu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu da pu, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 549000, NULL, N'Da PU', N'ACTIVE'),
(N'Áo khoác dù 2 lớp chống nước - Da PU', N'ao-khoac-du-2-lop-chong-nuoc-da-pu-14', N'Áo khoác dù 2 lớp chống nước - Da PU, màu xanh navy, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu da pu, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 599000, NULL, N'Da PU', N'ACTIVE'),
(N'Áo khoác bomber cá tính - Dạ nỉ', N'ao-khoac-bomber-ca-tinh-da-ni-15', N'Áo khoác bomber cá tính - Dạ nỉ, màu xanh navy, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu dạ nỉ, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 649000, 532000, N'Dạ nỉ', N'ACTIVE'),
(N'Áo khoác phao siêu nhẹ - Da PU', N'ao-khoac-phao-sieu-nhe-da-pu-16', N'Áo khoác phao siêu nhẹ - Da PU, màu rêu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu da pu, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 699000, NULL, N'Da PU', N'ACTIVE'),
(N'Áo khoác da lộn phối - Dạ nỉ', N'ao-khoac-da-lon-phoi-da-ni-17', N'Áo khoác da lộn phối - Dạ nỉ, màu be, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu dạ nỉ, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 749000, NULL, N'Dạ nỉ', N'ACTIVE'),
(N'Áo khoác dù 2 lớp chống nước - Da PU', N'ao-khoac-du-2-lop-chong-nuoc-da-pu-18', N'Áo khoác dù 2 lớp chống nước - Da PU, màu xám, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu da pu, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 799000, 655000, N'Da PU', N'ACTIVE'),
(N'Áo khoác da lộn phối - Denim', N'ao-khoac-da-lon-phoi-denim-19', N'Áo khoác da lộn phối - Denim, màu xám, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 899000, NULL, N'Denim', N'ACTIVE'),
(N'Áo khoác denim phối túi - Denim', N'ao-khoac-denim-phoi-tui-denim-20', N'Áo khoác denim phối túi - Denim, màu đen, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 399000, NULL, N'Denim', N'ACTIVE'),
(N'Áo khoác denim phối túi - Dạ nỉ', N'ao-khoac-denim-phoi-tui-da-ni-21', N'Áo khoác denim phối túi - Dạ nỉ, màu nâu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu dạ nỉ, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 449000, 368000, N'Dạ nỉ', N'ACTIVE'),
(N'Áo khoác dù 2 lớp chống nước - Polyester chống nước', N'ao-khoac-du-2-lop-chong-nuoc-polyester-chong-nuoc-22', N'Áo khoác dù 2 lớp chống nước - Polyester chống nước, màu xanh navy, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu polyester chống nước, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 499000, NULL, N'Polyester chống nước', N'ACTIVE'),
(N'Áo khoác kaki basic - Denim', N'ao-khoac-kaki-basic-denim-23', N'Áo khoác kaki basic - Denim, màu xanh navy, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 549000, NULL, N'Denim', N'ACTIVE'),
(N'Áo khoác denim phối túi - Kaki', N'ao-khoac-denim-phoi-tui-kaki-24', N'Áo khoác denim phối túi - Kaki, màu đen, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 599000, 491000, N'Kaki', N'ACTIVE'),
(N'Áo khoác hoodie zip - Dạ nỉ', N'ao-khoac-hoodie-zip-da-ni-25', N'Áo khoác hoodie zip - Dạ nỉ, màu nâu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu dạ nỉ, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 649000, NULL, N'Dạ nỉ', N'ACTIVE'),
(N'Áo khoác hoodie zip - Dạ nỉ', N'ao-khoac-hoodie-zip-da-ni-26', N'Áo khoác hoodie zip - Dạ nỉ, màu đen, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu dạ nỉ, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 699000, NULL, N'Dạ nỉ', N'ACTIVE'),
(N'Áo khoác phao siêu nhẹ - Denim', N'ao-khoac-phao-sieu-nhe-denim-27', N'Áo khoác phao siêu nhẹ - Denim, màu rêu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 749000, 614000, N'Denim', N'ACTIVE'),
(N'Áo khoác nỉ zip form rộng - Polyester chống nước', N'ao-khoac-ni-zip-form-rong-polyester-chong-nuoc-28', N'Áo khoác nỉ zip form rộng - Polyester chống nước, màu rêu, phù hợp đi học, đi làm, đi chơi mùa lạnh. Chất liệu polyester chống nước, form dáng chuẩn, dễ phối đồ.', @cat_ao_khoac, @brandLocal, 799000, NULL, N'Polyester chống nước', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_ao_khoac
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_ao_khoac;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_ao_khoac n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Xanh navy'), (N'L', N'Đen'), (N'XL', N'Xanh navy')) AS x(size, color);
GO

-- ===== Áo dài (ao-dai) — 26 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_ao_dai INT = (SELECT category_id FROM categories WHERE slug = N'ao-dai');
DECLARE @new_ao_dai TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_ao_dai(product_id, slug)
VALUES
(N'Áo dài họa tiết hoa văn - Gấm', N'ao-dai-hoa-tiet-hoa-van-gam-01', N'Áo dài họa tiết hoa văn - Gấm, màu xanh dương, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu gấm, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 650000, NULL, N'Gấm', N'ACTIVE'),
(N'Áo dài truyền thống gấm - The đũi', N'ao-dai-truyen-thong-gam-the-dui-02', N'Áo dài truyền thống gấm - The đũi, màu đen, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu the đũi, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 750000, NULL, N'The đũi', N'ACTIVE'),
(N'Áo dài form rộng thoải mái - The đũi', N'ao-dai-form-rong-thoai-mai-the-dui-03', N'Áo dài form rộng thoải mái - The đũi, màu trắng ngà, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu the đũi, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 850000, 697000, N'The đũi', N'ACTIVE'),
(N'Áo dài lụa cao cấp - Cotton lụa', N'ao-dai-lua-cao-cap-cotton-lua-04', N'Áo dài lụa cao cấp - Cotton lụa, màu trắng ngà, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu cotton lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 990000, NULL, N'Cotton lụa', N'ACTIVE'),
(N'Áo dài the đũi mộc mạc - Lụa satin', N'ao-dai-the-dui-moc-mac-lua-satin-05', N'Áo dài the đũi mộc mạc - Lụa satin, màu xanh ngọc, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu lụa satin, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1090000, NULL, N'Lụa satin', N'ACTIVE'),
(N'Áo dài lụa satin bóng - Lụa satin', N'ao-dai-lua-satin-bong-lua-satin-06', N'Áo dài lụa satin bóng - Lụa satin, màu vàng đồng, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu lụa satin, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1190000, 976000, N'Lụa satin', N'ACTIVE'),
(N'Áo dài tay raglan - Gấm', N'ao-dai-tay-raglan-gam-07', N'Áo dài tay raglan - Gấm, màu trắng ngà, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu gấm, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1290000, NULL, N'Gấm', N'ACTIVE'),
(N'Áo dài form rộng thoải mái - Lụa satin', N'ao-dai-form-rong-thoai-mai-lua-satin-08', N'Áo dài form rộng thoải mái - Lụa satin, màu xanh ngọc, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu lụa satin, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1450000, NULL, N'Lụa satin', N'ACTIVE'),
(N'Áo dài dự lễ trang trọng - Gấm', N'ao-dai-du-le-trang-trong-gam-09', N'Áo dài dự lễ trang trọng - Gấm, màu đen, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu gấm, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1590000, 1304000, N'Gấm', N'ACTIVE'),
(N'Áo dài lụa satin bóng - Lụa satin', N'ao-dai-lua-satin-bong-lua-satin-10', N'Áo dài lụa satin bóng - Lụa satin, màu đỏ đô, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu lụa satin, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 550000, NULL, N'Lụa satin', N'ACTIVE'),
(N'Áo dài tay raglan - Gấm', N'ao-dai-tay-raglan-gam-11', N'Áo dài tay raglan - Gấm, màu xanh ngọc, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu gấm, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 650000, NULL, N'Gấm', N'ACTIVE'),
(N'Áo dài tay raglan - Cotton lụa', N'ao-dai-tay-raglan-cotton-lua-12', N'Áo dài tay raglan - Cotton lụa, màu xanh dương, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu cotton lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 750000, 615000, N'Cotton lụa', N'ACTIVE'),
(N'Áo dài lụa cao cấp - Lụa satin', N'ao-dai-lua-cao-cap-lua-satin-13', N'Áo dài lụa cao cấp - Lụa satin, màu trắng ngà, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu lụa satin, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 850000, NULL, N'Lụa satin', N'ACTIVE'),
(N'Áo dài cách tân hiện đại - Lụa tơ tằm', N'ao-dai-cach-tan-hien-dai-lua-to-tam-14', N'Áo dài cách tân hiện đại - Lụa tơ tằm, màu xanh dương, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu lụa tơ tằm, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 990000, NULL, N'Lụa tơ tằm', N'ACTIVE'),
(N'Áo dài lụa cao cấp - Cotton lụa', N'ao-dai-lua-cao-cap-cotton-lua-15', N'Áo dài lụa cao cấp - Cotton lụa, màu xanh dương, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu cotton lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1090000, 894000, N'Cotton lụa', N'ACTIVE'),
(N'Áo dài họa tiết hoa văn - Gấm', N'ao-dai-hoa-tiet-hoa-van-gam-16', N'Áo dài họa tiết hoa văn - Gấm, màu trắng ngà, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu gấm, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1190000, NULL, N'Gấm', N'ACTIVE'),
(N'Áo dài lụa cao cấp - The đũi', N'ao-dai-lua-cao-cap-the-dui-17', N'Áo dài lụa cao cấp - The đũi, màu đen, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu the đũi, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1290000, NULL, N'The đũi', N'ACTIVE'),
(N'Áo dài cách tân hiện đại - Lụa tơ tằm', N'ao-dai-cach-tan-hien-dai-lua-to-tam-18', N'Áo dài cách tân hiện đại - Lụa tơ tằm, màu trắng ngà, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu lụa tơ tằm, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1450000, 1189000, N'Lụa tơ tằm', N'ACTIVE'),
(N'Áo dài the đũi mộc mạc - The đũi', N'ao-dai-the-dui-moc-mac-the-dui-19', N'Áo dài the đũi mộc mạc - The đũi, màu vàng đồng, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu the đũi, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1590000, NULL, N'The đũi', N'ACTIVE'),
(N'Áo dài form rộng thoải mái - Lụa satin', N'ao-dai-form-rong-thoai-mai-lua-satin-20', N'Áo dài form rộng thoải mái - Lụa satin, màu vàng đồng, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu lụa satin, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 550000, NULL, N'Lụa satin', N'ACTIVE'),
(N'Áo dài dự lễ trang trọng - Cotton lụa', N'ao-dai-du-le-trang-trong-cotton-lua-21', N'Áo dài dự lễ trang trọng - Cotton lụa, màu vàng đồng, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu cotton lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 650000, 533000, N'Cotton lụa', N'ACTIVE'),
(N'Áo dài cách tân hiện đại - Lụa satin', N'ao-dai-cach-tan-hien-dai-lua-satin-22', N'Áo dài cách tân hiện đại - Lụa satin, màu xanh ngọc, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu lụa satin, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 750000, NULL, N'Lụa satin', N'ACTIVE'),
(N'Áo dài form rộng thoải mái - Cotton lụa', N'ao-dai-form-rong-thoai-mai-cotton-lua-23', N'Áo dài form rộng thoải mái - Cotton lụa, màu đỏ đô, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu cotton lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 850000, NULL, N'Cotton lụa', N'ACTIVE'),
(N'Áo dài truyền thống gấm - Cotton lụa', N'ao-dai-truyen-thong-gam-cotton-lua-24', N'Áo dài truyền thống gấm - Cotton lụa, màu đỏ đô, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu cotton lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 990000, 812000, N'Cotton lụa', N'ACTIVE'),
(N'Áo dài lụa cao cấp - Cotton lụa', N'ao-dai-lua-cao-cap-cotton-lua-25', N'Áo dài lụa cao cấp - Cotton lụa, màu đen, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu cotton lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1090000, NULL, N'Cotton lụa', N'ACTIVE'),
(N'Áo dài lụa cao cấp - Cotton lụa', N'ao-dai-lua-cao-cap-cotton-lua-26', N'Áo dài lụa cao cấp - Cotton lụa, màu đỏ đô, phù hợp lễ, tết, cưới hỏi, sự kiện truyền thống. Chất liệu cotton lụa, form dáng chuẩn, dễ phối đồ.', @cat_ao_dai, @brandLocal, 1190000, NULL, N'Cotton lụa', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_ao_dai
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_ao_dai;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_ao_dai n
CROSS APPLY (VALUES (N'S', N'Đỏ đô'), (N'M', N'Vàng đồng'), (N'L', N'Đỏ đô'), (N'XL', N'Vàng đồng')) AS x(size, color);
GO

-- ===== Áo tanktop (ao-tanktop) — 26 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_ao_tanktop INT = (SELECT category_id FROM categories WHERE slug = N'ao-tanktop');
DECLARE @new_ao_tanktop TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_ao_tanktop(product_id, slug)
VALUES
(N'Áo tanktop gân thun ôm dáng - Cotton 100%', N'ao-tanktop-gan-thun-om-dang-cotton-100-01', N'Áo tanktop gân thun ôm dáng - Cotton 100%, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 119000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo tanktop gym thể thao - Thun lạnh', N'ao-tanktop-gym-the-thao-thun-lanh-02', N'Áo tanktop gym thể thao - Thun lạnh, màu xám, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 139000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Áo tanktop cotton co giãn - Thun gân', N'ao-tanktop-cotton-co-gian-thun-gan-03', N'Áo tanktop cotton co giãn - Thun gân, màu rêu, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun gân, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 159000, 130000, N'Thun gân', N'ACTIVE'),
(N'Áo tanktop gân thun ôm dáng - Cotton 100%', N'ao-tanktop-gan-thun-om-dang-cotton-100-04', N'Áo tanktop gân thun ôm dáng - Cotton 100%, màu đen, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 179000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo tanktop cotton co giãn - Polyester lưới', N'ao-tanktop-cotton-co-gian-polyester-luoi-05', N'Áo tanktop cotton co giãn - Polyester lưới, màu xám, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu polyester lưới, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 199000, NULL, N'Polyester lưới', N'ACTIVE'),
(N'Áo tanktop form ôm cơ bắp - Cotton 100%', N'ao-tanktop-form-om-co-bap-cotton-100-06', N'Áo tanktop form ôm cơ bắp - Cotton 100%, màu xám, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 219000, 180000, N'Cotton 100%', N'ACTIVE'),
(N'Áo tanktop tập gym năng động - Polyester lưới', N'ao-tanktop-tap-gym-nang-dong-polyester-luoi-07', N'Áo tanktop tập gym năng động - Polyester lưới, màu xám, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu polyester lưới, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 229000, NULL, N'Polyester lưới', N'ACTIVE'),
(N'Áo tanktop basic trơn - Cotton 100%', N'ao-tanktop-basic-tron-cotton-100-08', N'Áo tanktop basic trơn - Cotton 100%, màu trắng, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 239000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo tanktop gym thể thao - Polyester lưới', N'ao-tanktop-gym-the-thao-polyester-luoi-09', N'Áo tanktop gym thể thao - Polyester lưới, màu đen, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu polyester lưới, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 249000, 204000, N'Polyester lưới', N'ACTIVE'),
(N'Áo tanktop tập gym năng động - Thun lạnh', N'ao-tanktop-tap-gym-nang-dong-thun-lanh-10', N'Áo tanktop tập gym năng động - Thun lạnh, màu rêu, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 99000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Áo tanktop form ôm cơ bắp - Polyester lưới', N'ao-tanktop-form-om-co-bap-polyester-luoi-11', N'Áo tanktop form ôm cơ bắp - Polyester lưới, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu polyester lưới, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 119000, NULL, N'Polyester lưới', N'ACTIVE'),
(N'Áo tanktop cotton co giãn - Cotton co giãn', N'ao-tanktop-cotton-co-gian-cotton-co-gian-12', N'Áo tanktop cotton co giãn - Cotton co giãn, màu đen, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 139000, 114000, N'Cotton co giãn', N'ACTIVE'),
(N'Áo tanktop thấm hút mồ hôi - Thun lạnh', N'ao-tanktop-tham-hut-mo-hoi-thun-lanh-13', N'Áo tanktop thấm hút mồ hôi - Thun lạnh, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 159000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Áo tanktop basic trơn - Cotton co giãn', N'ao-tanktop-basic-tron-cotton-co-gian-14', N'Áo tanktop basic trơn - Cotton co giãn, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 179000, NULL, N'Cotton co giãn', N'ACTIVE'),
(N'Áo tanktop in họa tiết thể thao - Thun gân', N'ao-tanktop-in-hoa-tiet-the-thao-thun-gan-15', N'Áo tanktop in họa tiết thể thao - Thun gân, màu trắng, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun gân, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 199000, 163000, N'Thun gân', N'ACTIVE'),
(N'Áo tanktop tập gym năng động - Thun gân', N'ao-tanktop-tap-gym-nang-dong-thun-gan-16', N'Áo tanktop tập gym năng động - Thun gân, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun gân, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 219000, NULL, N'Thun gân', N'ACTIVE'),
(N'Áo tanktop gân thun ôm dáng - Thun lạnh', N'ao-tanktop-gan-thun-om-dang-thun-lanh-17', N'Áo tanktop gân thun ôm dáng - Thun lạnh, màu xám, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 229000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Áo tanktop basic trơn - Thun gân', N'ao-tanktop-basic-tron-thun-gan-18', N'Áo tanktop basic trơn - Thun gân, màu rêu, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun gân, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 239000, 196000, N'Thun gân', N'ACTIVE'),
(N'Áo tanktop basic trơn - Thun lạnh', N'ao-tanktop-basic-tron-thun-lanh-19', N'Áo tanktop basic trơn - Thun lạnh, màu đen, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 249000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Áo tanktop form ôm cơ bắp - Thun lạnh', N'ao-tanktop-form-om-co-bap-thun-lanh-20', N'Áo tanktop form ôm cơ bắp - Thun lạnh, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 99000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Áo tanktop raw-cut không viền - Cotton co giãn', N'ao-tanktop-raw-cut-khong-vien-cotton-co-gian-21', N'Áo tanktop raw-cut không viền - Cotton co giãn, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 119000, 98000, N'Cotton co giãn', N'ACTIVE'),
(N'Áo tanktop thấm hút mồ hôi - Cotton 100%', N'ao-tanktop-tham-hut-mo-hoi-cotton-100-22', N'Áo tanktop thấm hút mồ hôi - Cotton 100%, màu trắng, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu cotton 100%, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 139000, NULL, N'Cotton 100%', N'ACTIVE'),
(N'Áo tanktop basic trơn - Thun lạnh', N'ao-tanktop-basic-tron-thun-lanh-23', N'Áo tanktop basic trơn - Thun lạnh, màu trắng, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 159000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Áo tanktop form ôm cơ bắp - Thun gân', N'ao-tanktop-form-om-co-bap-thun-gan-24', N'Áo tanktop form ôm cơ bắp - Thun gân, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun gân, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 179000, 147000, N'Thun gân', N'ACTIVE'),
(N'Áo tanktop cotton co giãn - Thun gân', N'ao-tanktop-cotton-co-gian-thun-gan-25', N'Áo tanktop cotton co giãn - Thun gân, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun gân, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 199000, NULL, N'Thun gân', N'ACTIVE'),
(N'Áo tanktop raw-cut không viền - Thun gân', N'ao-tanktop-raw-cut-khong-vien-thun-gan-26', N'Áo tanktop raw-cut không viền - Thun gân, màu xanh navy, phù hợp tập gym, chơi thể thao, mặc nhà. Chất liệu thun gân, form dáng chuẩn, dễ phối đồ.', @cat_ao_tanktop, @brandLocal, 219000, NULL, N'Thun gân', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_ao_tanktop
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_ao_tanktop;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_ao_tanktop n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Trắng'), (N'L', N'Đen'), (N'XL', N'Trắng')) AS x(size, color);
GO

-- ===== Áo polo (ao-polo) — 26 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_ao_polo INT = (SELECT category_id FROM categories WHERE slug = N'ao-polo');
DECLARE @new_ao_polo TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_ao_polo(product_id, slug)
VALUES
(N'Áo polo tay ngắn thể thao - Pique Cotton', N'ao-polo-tay-ngan-the-thao-pique-cotton-01', N'Áo polo tay ngắn thể thao - Pique Cotton, màu trắng, phù hợp đi làm, đi chơi, chơi golf. Chất liệu pique cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 249000, NULL, N'Pique Cotton', N'ACTIVE'),
(N'Áo polo cotton lạnh mềm mại - Polyester thể thao', N'ao-polo-cotton-lanh-mem-mai-polyester-the-thao-02', N'Áo polo cotton lạnh mềm mại - Polyester thể thao, màu trắng, phù hợp đi làm, đi chơi, chơi golf. Chất liệu polyester thể thao, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 269000, NULL, N'Polyester thể thao', N'ACTIVE'),
(N'Áo polo thêu logo ngực - Cotton lạnh', N'ao-polo-theu-logo-nguc-cotton-lanh-03', N'Áo polo thêu logo ngực - Cotton lạnh, màu đen, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cotton lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 289000, 237000, N'Cotton lạnh', N'ACTIVE'),
(N'Áo polo form slim ôm dáng - Cá sấu Cotton', N'ao-polo-form-slim-om-dang-ca-sau-cotton-04', N'Áo polo form slim ôm dáng - Cá sấu Cotton, màu đen, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cá sấu cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 319000, NULL, N'Cá sấu Cotton', N'ACTIVE'),
(N'Áo polo form slim ôm dáng - Cotton 4 chiều', N'ao-polo-form-slim-om-dang-cotton-4-chieu-05', N'Áo polo form slim ôm dáng - Cotton 4 chiều, màu xanh navy, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cotton 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 349000, NULL, N'Cotton 4 chiều', N'ACTIVE'),
(N'Áo polo tay ngắn thể thao - Pique Cotton', N'ao-polo-tay-ngan-the-thao-pique-cotton-06', N'Áo polo tay ngắn thể thao - Pique Cotton, màu be, phù hợp đi làm, đi chơi, chơi golf. Chất liệu pique cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 379000, 311000, N'Pique Cotton', N'ACTIVE'),
(N'Áo polo vải cá sấu - Cotton lạnh', N'ao-polo-vai-ca-sau-cotton-lanh-07', N'Áo polo vải cá sấu - Cotton lạnh, màu xám, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cotton lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 399000, NULL, N'Cotton lạnh', N'ACTIVE'),
(N'Áo polo form slim ôm dáng - Cotton lạnh', N'ao-polo-form-slim-om-dang-cotton-lanh-08', N'Áo polo form slim ôm dáng - Cotton lạnh, màu xanh navy, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cotton lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 429000, NULL, N'Cotton lạnh', N'ACTIVE'),
(N'Áo polo thêu logo ngực - Pique Cotton', N'ao-polo-theu-logo-nguc-pique-cotton-09', N'Áo polo thêu logo ngực - Pique Cotton, màu trắng, phù hợp đi làm, đi chơi, chơi golf. Chất liệu pique cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 459000, 376000, N'Pique Cotton', N'ACTIVE'),
(N'Áo polo pique basic - Pique Cotton', N'ao-polo-pique-basic-pique-cotton-10', N'Áo polo pique basic - Pique Cotton, màu đỏ đô, phù hợp đi làm, đi chơi, chơi golf. Chất liệu pique cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 219000, NULL, N'Pique Cotton', N'ACTIVE'),
(N'Áo polo form regular - Pique Cotton', N'ao-polo-form-regular-pique-cotton-11', N'Áo polo form regular - Pique Cotton, màu be, phù hợp đi làm, đi chơi, chơi golf. Chất liệu pique cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 249000, NULL, N'Pique Cotton', N'ACTIVE'),
(N'Áo polo tay ngắn thể thao - Cotton lạnh', N'ao-polo-tay-ngan-the-thao-cotton-lanh-12', N'Áo polo tay ngắn thể thao - Cotton lạnh, màu đen, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cotton lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 269000, 221000, N'Cotton lạnh', N'ACTIVE'),
(N'Áo polo phối viền cổ - Cá sấu Cotton', N'ao-polo-phoi-vien-co-ca-sau-cotton-13', N'Áo polo phối viền cổ - Cá sấu Cotton, màu trắng, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cá sấu cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 289000, NULL, N'Cá sấu Cotton', N'ACTIVE'),
(N'Áo polo kẻ sọc lịch lãm - Cotton 4 chiều', N'ao-polo-ke-soc-lich-lam-cotton-4-chieu-14', N'Áo polo kẻ sọc lịch lãm - Cotton 4 chiều, màu xanh navy, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cotton 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 319000, NULL, N'Cotton 4 chiều', N'ACTIVE'),
(N'Áo polo form regular - Cá sấu Cotton', N'ao-polo-form-regular-ca-sau-cotton-15', N'Áo polo form regular - Cá sấu Cotton, màu đỏ đô, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cá sấu cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 349000, 286000, N'Cá sấu Cotton', N'ACTIVE'),
(N'Áo polo pique basic - Cotton 4 chiều', N'ao-polo-pique-basic-cotton-4-chieu-16', N'Áo polo pique basic - Cotton 4 chiều, màu xanh navy, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cotton 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 379000, NULL, N'Cotton 4 chiều', N'ACTIVE'),
(N'Áo polo kẻ sọc lịch lãm - Polyester thể thao', N'ao-polo-ke-soc-lich-lam-polyester-the-thao-17', N'Áo polo kẻ sọc lịch lãm - Polyester thể thao, màu trắng, phù hợp đi làm, đi chơi, chơi golf. Chất liệu polyester thể thao, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 399000, NULL, N'Polyester thể thao', N'ACTIVE'),
(N'Áo polo kẻ sọc lịch lãm - Pique Cotton', N'ao-polo-ke-soc-lich-lam-pique-cotton-18', N'Áo polo kẻ sọc lịch lãm - Pique Cotton, màu trắng, phù hợp đi làm, đi chơi, chơi golf. Chất liệu pique cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 429000, 352000, N'Pique Cotton', N'ACTIVE'),
(N'Áo polo kẻ sọc lịch lãm - Cá sấu Cotton', N'ao-polo-ke-soc-lich-lam-ca-sau-cotton-19', N'Áo polo kẻ sọc lịch lãm - Cá sấu Cotton, màu xám, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cá sấu cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 459000, NULL, N'Cá sấu Cotton', N'ACTIVE'),
(N'Áo polo form slim ôm dáng - Polyester thể thao', N'ao-polo-form-slim-om-dang-polyester-the-thao-20', N'Áo polo form slim ôm dáng - Polyester thể thao, màu xám, phù hợp đi làm, đi chơi, chơi golf. Chất liệu polyester thể thao, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 219000, NULL, N'Polyester thể thao', N'ACTIVE'),
(N'Áo polo phối màu năng động - Cá sấu Cotton', N'ao-polo-phoi-mau-nang-dong-ca-sau-cotton-21', N'Áo polo phối màu năng động - Cá sấu Cotton, màu đỏ đô, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cá sấu cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 249000, 204000, N'Cá sấu Cotton', N'ACTIVE'),
(N'Áo polo vải cá sấu - Cotton lạnh', N'ao-polo-vai-ca-sau-cotton-lanh-22', N'Áo polo vải cá sấu - Cotton lạnh, màu xanh navy, phù hợp đi làm, đi chơi, chơi golf. Chất liệu cotton lạnh, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 269000, NULL, N'Cotton lạnh', N'ACTIVE'),
(N'Áo polo kẻ sọc lịch lãm - Polyester thể thao', N'ao-polo-ke-soc-lich-lam-polyester-the-thao-23', N'Áo polo kẻ sọc lịch lãm - Polyester thể thao, màu be, phù hợp đi làm, đi chơi, chơi golf. Chất liệu polyester thể thao, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 289000, NULL, N'Polyester thể thao', N'ACTIVE'),
(N'Áo polo thêu logo ngực - Pique Cotton', N'ao-polo-theu-logo-nguc-pique-cotton-24', N'Áo polo thêu logo ngực - Pique Cotton, màu đen, phù hợp đi làm, đi chơi, chơi golf. Chất liệu pique cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 319000, 262000, N'Pique Cotton', N'ACTIVE'),
(N'Áo polo form regular - Pique Cotton', N'ao-polo-form-regular-pique-cotton-25', N'Áo polo form regular - Pique Cotton, màu đỏ đô, phù hợp đi làm, đi chơi, chơi golf. Chất liệu pique cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 349000, NULL, N'Pique Cotton', N'ACTIVE'),
(N'Áo polo vải cá sấu - Pique Cotton', N'ao-polo-vai-ca-sau-pique-cotton-26', N'Áo polo vải cá sấu - Pique Cotton, màu đen, phù hợp đi làm, đi chơi, chơi golf. Chất liệu pique cotton, form dáng chuẩn, dễ phối đồ.', @cat_ao_polo, @brandLocal, 379000, NULL, N'Pique Cotton', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_ao_polo
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_ao_polo;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_ao_polo n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Trắng'), (N'L', N'Đen'), (N'XL', N'Trắng')) AS x(size, color);
GO

-- ===== Quần tây (quan-tay) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_tay INT = (SELECT category_id FROM categories WHERE slug = N'quan-tay');
DECLARE @new_quan_tay TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_tay(product_id, slug)
VALUES
(N'Quần tây basic một màu - Wool pha', N'quan-tay-basic-mot-mau-wool-pha-01', N'Quần tây basic một màu - Wool pha, màu đen, phù hợp đi làm công sở. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 329000, NULL, N'Wool pha', N'ACTIVE'),
(N'Quần tây không ly hiện đại - Polyester cao cấp', N'quan-tay-khong-ly-hien-dai-polyester-cao-cap-02', N'Quần tây không ly hiện đại - Polyester cao cấp, màu be, phù hợp đi làm công sở. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 359000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần tây họa tiết caro nhẹ - Wool pha', N'quan-tay-hoa-tiet-caro-nhe-wool-pha-03', N'Quần tây họa tiết caro nhẹ - Wool pha, màu nâu, phù hợp đi làm công sở. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 399000, 327000, N'Wool pha', N'ACTIVE'),
(N'Quần tây không ly hiện đại - Wool pha', N'quan-tay-khong-ly-hien-dai-wool-pha-04', N'Quần tây không ly hiện đại - Wool pha, màu xám, phù hợp đi làm công sở. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 429000, NULL, N'Wool pha', N'ACTIVE'),
(N'Quần tây xếp ly cổ điển - Wool pha', N'quan-tay-xep-ly-co-dien-wool-pha-05', N'Quần tây xếp ly cổ điển - Wool pha, màu xanh navy, phù hợp đi làm công sở. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 459000, NULL, N'Wool pha', N'ACTIVE'),
(N'Quần tây co giãn 4 chiều - Wool pha', N'quan-tay-co-gian-4-chieu-wool-pha-06', N'Quần tây co giãn 4 chiều - Wool pha, màu xanh navy, phù hợp đi làm công sở. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 499000, 409000, N'Wool pha', N'ACTIVE'),
(N'Quần tây form slim - Polyester cao cấp', N'quan-tay-form-slim-polyester-cao-cap-07', N'Quần tây form slim - Polyester cao cấp, màu be, phù hợp đi làm công sở. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 549000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần tây ống suông công sở - Polyester cao cấp', N'quan-tay-ong-suong-cong-so-polyester-cao-cap-08', N'Quần tây ống suông công sở - Polyester cao cấp, màu nâu, phù hợp đi làm công sở. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 599000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần tây form slim - Kaki cao cấp', N'quan-tay-form-slim-kaki-cao-cap-09', N'Quần tây form slim - Kaki cao cấp, màu đen, phù hợp đi làm công sở. Chất liệu kaki cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 650000, 533000, N'Kaki cao cấp', N'ACTIVE'),
(N'Quần tây form slim - Cotton pha spandex', N'quan-tay-form-slim-cotton-pha-spandex-10', N'Quần tây form slim - Cotton pha spandex, màu xám, phù hợp đi làm công sở. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 299000, NULL, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần tây xếp ly cổ điển - Cotton pha spandex', N'quan-tay-xep-ly-co-dien-cotton-pha-spandex-11', N'Quần tây xếp ly cổ điển - Cotton pha spandex, màu be, phù hợp đi làm công sở. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 329000, NULL, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần tây xếp ly cổ điển - Wool pha', N'quan-tay-xep-ly-co-dien-wool-pha-12', N'Quần tây xếp ly cổ điển - Wool pha, màu be, phù hợp đi làm công sở. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 359000, 294000, N'Wool pha', N'ACTIVE'),
(N'Quần tây co giãn 4 chiều - Polyester cao cấp', N'quan-tay-co-gian-4-chieu-polyester-cao-cap-13', N'Quần tây co giãn 4 chiều - Polyester cao cấp, màu be, phù hợp đi làm công sở. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 399000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần tây basic một màu - Kaki cao cấp', N'quan-tay-basic-mot-mau-kaki-cao-cap-14', N'Quần tây basic một màu - Kaki cao cấp, màu xanh navy, phù hợp đi làm công sở. Chất liệu kaki cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 429000, NULL, N'Kaki cao cấp', N'ACTIVE'),
(N'Quần tây họa tiết caro nhẹ - Cotton pha spandex', N'quan-tay-hoa-tiet-caro-nhe-cotton-pha-spandex-15', N'Quần tây họa tiết caro nhẹ - Cotton pha spandex, màu xám, phù hợp đi làm công sở. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 459000, 376000, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần tây basic một màu - Polyester cao cấp', N'quan-tay-basic-mot-mau-polyester-cao-cap-16', N'Quần tây basic một màu - Polyester cao cấp, màu nâu, phù hợp đi làm công sở. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 499000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần tây không ly hiện đại - Polyester cao cấp', N'quan-tay-khong-ly-hien-dai-polyester-cao-cap-17', N'Quần tây không ly hiện đại - Polyester cao cấp, màu xanh navy, phù hợp đi làm công sở. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 549000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần tây ống suông công sở - Cotton pha spandex', N'quan-tay-ong-suong-cong-so-cotton-pha-spandex-18', N'Quần tây ống suông công sở - Cotton pha spandex, màu nâu, phù hợp đi làm công sở. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 599000, 491000, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần tây form slim - Polyester cao cấp', N'quan-tay-form-slim-polyester-cao-cap-19', N'Quần tây form slim - Polyester cao cấp, màu xanh navy, phù hợp đi làm công sở. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 650000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần tây họa tiết caro nhẹ - Kaki cao cấp', N'quan-tay-hoa-tiet-caro-nhe-kaki-cao-cap-20', N'Quần tây họa tiết caro nhẹ - Kaki cao cấp, màu xanh navy, phù hợp đi làm công sở. Chất liệu kaki cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 299000, NULL, N'Kaki cao cấp', N'ACTIVE'),
(N'Quần tây basic một màu - Cotton pha spandex', N'quan-tay-basic-mot-mau-cotton-pha-spandex-21', N'Quần tây basic một màu - Cotton pha spandex, màu be, phù hợp đi làm công sở. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 329000, 270000, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần tây vải cao cấp Hàn Quốc - Kaki cao cấp', N'quan-tay-vai-cao-cap-han-quoc-kaki-cao-cap-22', N'Quần tây vải cao cấp Hàn Quốc - Kaki cao cấp, màu đen, phù hợp đi làm công sở. Chất liệu kaki cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 359000, NULL, N'Kaki cao cấp', N'ACTIVE'),
(N'Quần tây xếp ly cổ điển - Kaki cao cấp', N'quan-tay-xep-ly-co-dien-kaki-cao-cap-23', N'Quần tây xếp ly cổ điển - Kaki cao cấp, màu be, phù hợp đi làm công sở. Chất liệu kaki cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 399000, NULL, N'Kaki cao cấp', N'ACTIVE'),
(N'Quần tây vải cao cấp Hàn Quốc - Wool pha', N'quan-tay-vai-cao-cap-han-quoc-wool-pha-24', N'Quần tây vải cao cấp Hàn Quốc - Wool pha, màu be, phù hợp đi làm công sở. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 429000, 352000, N'Wool pha', N'ACTIVE'),
(N'Quần tây co giãn 4 chiều - Wool pha', N'quan-tay-co-gian-4-chieu-wool-pha-25', N'Quần tây co giãn 4 chiều - Wool pha, màu đen, phù hợp đi làm công sở. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 459000, NULL, N'Wool pha', N'ACTIVE'),
(N'Quần tây basic một màu - Polyester cao cấp', N'quan-tay-basic-mot-mau-polyester-cao-cap-26', N'Quần tây basic một màu - Polyester cao cấp, màu xám, phù hợp đi làm công sở. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 499000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần tây không ly hiện đại - Kaki cao cấp', N'quan-tay-khong-ly-hien-dai-kaki-cao-cap-27', N'Quần tây không ly hiện đại - Kaki cao cấp, màu xanh navy, phù hợp đi làm công sở. Chất liệu kaki cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 549000, 450000, N'Kaki cao cấp', N'ACTIVE'),
(N'Quần tây basic một màu - Polyester cao cấp', N'quan-tay-basic-mot-mau-polyester-cao-cap-28', N'Quần tây basic một màu - Polyester cao cấp, màu đen, phù hợp đi làm công sở. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_tay, @brandLocal, 599000, NULL, N'Polyester cao cấp', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_tay
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_tay;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_tay n
CROSS APPLY (VALUES (N'29', N'Đen'), (N'30', N'Xám'), (N'31', N'Đen'), (N'32', N'Xám')) AS x(size, color);
GO

-- ===== Quần jeans (quan-jeans) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_jeans INT = (SELECT category_id FROM categories WHERE slug = N'quan-jeans');
DECLARE @new_quan_jeans TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_jeans(product_id, slug)
VALUES
(N'Quần jeans wash sáng - Denim cotton', N'quan-jeans-wash-sang-denim-cotton-01', N'Quần jeans wash sáng - Denim cotton, màu xanh đậm, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 379000, NULL, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans ống suông regular - Denim cotton', N'quan-jeans-ong-suong-regular-denim-cotton-02', N'Quần jeans ống suông regular - Denim cotton, màu đen, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 419000, NULL, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans ống suông regular - Denim raw', N'quan-jeans-ong-suong-regular-denim-raw-03', N'Quần jeans ống suông regular - Denim raw, màu xám khói, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 449000, 368000, N'Denim raw', N'ACTIVE'),
(N'Quần jeans ống loe retro - Denim raw', N'quan-jeans-ong-loe-retro-denim-raw-04', N'Quần jeans ống loe retro - Denim raw, màu xanh nhạt, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 489000, NULL, N'Denim raw', N'ACTIVE'),
(N'Quần jeans ống suông regular - Denim co giãn', N'quan-jeans-ong-suong-regular-denim-co-gian-05', N'Quần jeans ống suông regular - Denim co giãn, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 529000, NULL, N'Denim co giãn', N'ACTIVE'),
(N'Quần jeans ống loe retro - Denim cotton', N'quan-jeans-ong-loe-retro-denim-cotton-06', N'Quần jeans ống loe retro - Denim cotton, màu xám khói, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 569000, 467000, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans wash sáng - Denim cotton', N'quan-jeans-wash-sang-denim-cotton-07', N'Quần jeans wash sáng - Denim cotton, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 599000, NULL, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans ống suông regular - Denim cotton', N'quan-jeans-ong-suong-regular-denim-cotton-08', N'Quần jeans ống suông regular - Denim cotton, màu xám khói, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 649000, NULL, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans wash sáng - Denim co giãn', N'quan-jeans-wash-sang-denim-co-gian-09', N'Quần jeans wash sáng - Denim co giãn, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 699000, 573000, N'Denim co giãn', N'ACTIVE'),
(N'Quần jeans skinny ôm dáng - Denim cotton', N'quan-jeans-skinny-om-dang-denim-cotton-10', N'Quần jeans skinny ôm dáng - Denim cotton, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 349000, NULL, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans denim co giãn thoải mái - Denim cotton', N'quan-jeans-denim-co-gian-thoai-mai-denim-cotton-11', N'Quần jeans denim co giãn thoải mái - Denim cotton, màu xanh đậm, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 379000, NULL, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans form baggy hiện đại - Denim raw', N'quan-jeans-form-baggy-hien-dai-denim-raw-12', N'Quần jeans form baggy hiện đại - Denim raw, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 419000, 344000, N'Denim raw', N'ACTIVE'),
(N'Quần jeans form baggy hiện đại - Denim raw', N'quan-jeans-form-baggy-hien-dai-denim-raw-13', N'Quần jeans form baggy hiện đại - Denim raw, màu đen, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 449000, NULL, N'Denim raw', N'ACTIVE'),
(N'Quần jeans slimfit trẻ trung - Denim cotton', N'quan-jeans-slimfit-tre-trung-denim-cotton-14', N'Quần jeans slimfit trẻ trung - Denim cotton, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 489000, NULL, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans denim co giãn thoải mái - Denim raw', N'quan-jeans-denim-co-gian-thoai-mai-denim-raw-15', N'Quần jeans denim co giãn thoải mái - Denim raw, màu đen, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 529000, 434000, N'Denim raw', N'ACTIVE'),
(N'Quần jeans wash sáng - Denim raw', N'quan-jeans-wash-sang-denim-raw-16', N'Quần jeans wash sáng - Denim raw, màu xanh đậm, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 569000, NULL, N'Denim raw', N'ACTIVE'),
(N'Quần jeans rách gối cá tính - Denim raw', N'quan-jeans-rach-goi-ca-tinh-denim-raw-17', N'Quần jeans rách gối cá tính - Denim raw, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 599000, NULL, N'Denim raw', N'ACTIVE'),
(N'Quần jeans wash tối - Denim raw', N'quan-jeans-wash-toi-denim-raw-18', N'Quần jeans wash tối - Denim raw, màu đen, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 649000, 532000, N'Denim raw', N'ACTIVE'),
(N'Quần jeans form baggy hiện đại - Denim co giãn', N'quan-jeans-form-baggy-hien-dai-denim-co-gian-19', N'Quần jeans form baggy hiện đại - Denim co giãn, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 699000, NULL, N'Denim co giãn', N'ACTIVE'),
(N'Quần jeans ống suông regular - Denim cotton', N'quan-jeans-ong-suong-regular-denim-cotton-20', N'Quần jeans ống suông regular - Denim cotton, màu xanh đậm, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 349000, NULL, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans ống suông regular - Denim co giãn', N'quan-jeans-ong-suong-regular-denim-co-gian-21', N'Quần jeans ống suông regular - Denim co giãn, màu xanh nhạt, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 379000, 311000, N'Denim co giãn', N'ACTIVE'),
(N'Quần jeans ống loe retro - Denim raw', N'quan-jeans-ong-loe-retro-denim-raw-22', N'Quần jeans ống loe retro - Denim raw, màu xanh đậm, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 419000, NULL, N'Denim raw', N'ACTIVE'),
(N'Quần jeans form baggy hiện đại - Denim co giãn', N'quan-jeans-form-baggy-hien-dai-denim-co-gian-23', N'Quần jeans form baggy hiện đại - Denim co giãn, màu xanh nhạt, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 449000, NULL, N'Denim co giãn', N'ACTIVE'),
(N'Quần jeans rách gối cá tính - Denim cotton', N'quan-jeans-rach-goi-ca-tinh-denim-cotton-24', N'Quần jeans rách gối cá tính - Denim cotton, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 489000, 401000, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans skinny ôm dáng - Denim raw', N'quan-jeans-skinny-om-dang-denim-raw-25', N'Quần jeans skinny ôm dáng - Denim raw, màu xanh rêu, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 529000, NULL, N'Denim raw', N'ACTIVE'),
(N'Quần jeans skinny ôm dáng - Denim raw', N'quan-jeans-skinny-om-dang-denim-raw-26', N'Quần jeans skinny ôm dáng - Denim raw, màu đen, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim raw, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 569000, NULL, N'Denim raw', N'ACTIVE'),
(N'Quần jeans slimfit trẻ trung - Denim cotton', N'quan-jeans-slimfit-tre-trung-denim-cotton-27', N'Quần jeans slimfit trẻ trung - Denim cotton, màu xám khói, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 599000, 491000, N'Denim cotton', N'ACTIVE'),
(N'Quần jeans ống loe retro - Denim cotton', N'quan-jeans-ong-loe-retro-denim-cotton-28', N'Quần jeans ống loe retro - Denim cotton, màu xanh nhạt, phù hợp đi chơi, đi học hằng ngày. Chất liệu denim cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_jeans, @brandLocal, 649000, NULL, N'Denim cotton', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_jeans
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_jeans;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_jeans n
CROSS APPLY (VALUES (N'29', N'Xanh đậm'), (N'30', N'Xanh nhạt'), (N'31', N'Xanh đậm'), (N'32', N'Xanh nhạt')) AS x(size, color);
GO

-- ===== Quần short (quan-short) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_short INT = (SELECT category_id FROM categories WHERE slug = N'quan-short');
DECLARE @new_quan_short TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_short(product_id, slug)
VALUES
(N'Quần short đi biển mát mẻ - Denim', N'quan-short-di-bien-mat-me-denim-01', N'Quần short đi biển mát mẻ - Denim, màu đen, phù hợp đi biển, đi chơi mùa hè. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 179000, NULL, N'Denim', N'ACTIVE'),
(N'Quần short thun form rộng - Kaki', N'quan-short-thun-form-rong-kaki-02', N'Quần short thun form rộng - Kaki, màu rêu, phù hợp đi biển, đi chơi mùa hè. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 199000, NULL, N'Kaki', N'ACTIVE'),
(N'Quần short basic trơn - Denim', N'quan-short-basic-tron-denim-03', N'Quần short basic trơn - Denim, màu đen, phù hợp đi biển, đi chơi mùa hè. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 219000, 180000, N'Denim', N'ACTIVE'),
(N'Quần short thun form rộng - Cotton thun', N'quan-short-thun-form-rong-cotton-thun-04', N'Quần short thun form rộng - Cotton thun, màu be, phù hợp đi biển, đi chơi mùa hè. Chất liệu cotton thun, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 239000, NULL, N'Cotton thun', N'ACTIVE'),
(N'Quần short jean cá tính - Polyester', N'quan-short-jean-ca-tinh-polyester-05', N'Quần short jean cá tính - Polyester, màu be, phù hợp đi biển, đi chơi mùa hè. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 259000, NULL, N'Polyester', N'ACTIVE'),
(N'Quần short kaki túi hộp - Polyester', N'quan-short-kaki-tui-hop-polyester-06', N'Quần short kaki túi hộp - Polyester, màu rêu, phù hợp đi biển, đi chơi mùa hè. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 279000, 229000, N'Polyester', N'ACTIVE'),
(N'Quần short đi biển mát mẻ - Cotton thun', N'quan-short-di-bien-mat-me-cotton-thun-07', N'Quần short đi biển mát mẻ - Cotton thun, màu xanh navy, phù hợp đi biển, đi chơi mùa hè. Chất liệu cotton thun, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 299000, NULL, N'Cotton thun', N'ACTIVE'),
(N'Quần short basic trơn - Polyester', N'quan-short-basic-tron-polyester-08', N'Quần short basic trơn - Polyester, màu đen, phù hợp đi biển, đi chơi mùa hè. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 329000, NULL, N'Polyester', N'ACTIVE'),
(N'Quần short thun form rộng - Denim', N'quan-short-thun-form-rong-denim-09', N'Quần short thun form rộng - Denim, màu đen, phù hợp đi biển, đi chơi mùa hè. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 349000, 286000, N'Denim', N'ACTIVE'),
(N'Quần short denim basic - Kaki', N'quan-short-denim-basic-kaki-10', N'Quần short denim basic - Kaki, màu xám, phù hợp đi biển, đi chơi mùa hè. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 159000, NULL, N'Kaki', N'ACTIVE'),
(N'Quần short kaki túi hộp - Cotton thun', N'quan-short-kaki-tui-hop-cotton-thun-11', N'Quần short kaki túi hộp - Cotton thun, màu rêu, phù hợp đi biển, đi chơi mùa hè. Chất liệu cotton thun, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 179000, NULL, N'Cotton thun', N'ACTIVE'),
(N'Quần short đi biển mát mẻ - Denim', N'quan-short-di-bien-mat-me-denim-12', N'Quần short đi biển mát mẻ - Denim, màu xanh navy, phù hợp đi biển, đi chơi mùa hè. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 199000, 163000, N'Denim', N'ACTIVE'),
(N'Quần short basic trơn - Polyester', N'quan-short-basic-tron-polyester-13', N'Quần short basic trơn - Polyester, màu rêu, phù hợp đi biển, đi chơi mùa hè. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 219000, NULL, N'Polyester', N'ACTIVE'),
(N'Quần short đi biển mát mẻ - Cotton thun', N'quan-short-di-bien-mat-me-cotton-thun-14', N'Quần short đi biển mát mẻ - Cotton thun, màu rêu, phù hợp đi biển, đi chơi mùa hè. Chất liệu cotton thun, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 239000, NULL, N'Cotton thun', N'ACTIVE'),
(N'Quần short đi biển mát mẻ - Kaki', N'quan-short-di-bien-mat-me-kaki-15', N'Quần short đi biển mát mẻ - Kaki, màu đen, phù hợp đi biển, đi chơi mùa hè. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 259000, 212000, N'Kaki', N'ACTIVE'),
(N'Quần short basic trơn - Kaki', N'quan-short-basic-tron-kaki-16', N'Quần short basic trơn - Kaki, màu be, phù hợp đi biển, đi chơi mùa hè. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 279000, NULL, N'Kaki', N'ACTIVE'),
(N'Quần short thể thao năng động - Denim', N'quan-short-the-thao-nang-dong-denim-17', N'Quần short thể thao năng động - Denim, màu rêu, phù hợp đi biển, đi chơi mùa hè. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 299000, NULL, N'Denim', N'ACTIVE'),
(N'Quần short thun form rộng - Kaki', N'quan-short-thun-form-rong-kaki-18', N'Quần short thun form rộng - Kaki, màu be, phù hợp đi biển, đi chơi mùa hè. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 329000, 270000, N'Kaki', N'ACTIVE'),
(N'Quần short basic trơn - Kaki', N'quan-short-basic-tron-kaki-19', N'Quần short basic trơn - Kaki, màu đen, phù hợp đi biển, đi chơi mùa hè. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 349000, NULL, N'Kaki', N'ACTIVE'),
(N'Quần short denim basic - Denim', N'quan-short-denim-basic-denim-20', N'Quần short denim basic - Denim, màu đen, phù hợp đi biển, đi chơi mùa hè. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 159000, NULL, N'Denim', N'ACTIVE'),
(N'Quần short ống rộng thoải mái - Cotton thun', N'quan-short-ong-rong-thoai-mai-cotton-thun-21', N'Quần short ống rộng thoải mái - Cotton thun, màu xanh navy, phù hợp đi biển, đi chơi mùa hè. Chất liệu cotton thun, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 179000, 147000, N'Cotton thun', N'ACTIVE'),
(N'Quần short thun form rộng - Denim', N'quan-short-thun-form-rong-denim-22', N'Quần short thun form rộng - Denim, màu be, phù hợp đi biển, đi chơi mùa hè. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 199000, NULL, N'Denim', N'ACTIVE'),
(N'Quần short kaki túi hộp - Kaki', N'quan-short-kaki-tui-hop-kaki-23', N'Quần short kaki túi hộp - Kaki, màu xám, phù hợp đi biển, đi chơi mùa hè. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 219000, NULL, N'Kaki', N'ACTIVE'),
(N'Quần short thun form rộng - Cotton thun', N'quan-short-thun-form-rong-cotton-thun-24', N'Quần short thun form rộng - Cotton thun, màu rêu, phù hợp đi biển, đi chơi mùa hè. Chất liệu cotton thun, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 239000, 196000, N'Cotton thun', N'ACTIVE'),
(N'Quần short thun form rộng - Cotton thun', N'quan-short-thun-form-rong-cotton-thun-25', N'Quần short thun form rộng - Cotton thun, màu xanh navy, phù hợp đi biển, đi chơi mùa hè. Chất liệu cotton thun, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 259000, NULL, N'Cotton thun', N'ACTIVE'),
(N'Quần short đi biển mát mẻ - Cotton thun', N'quan-short-di-bien-mat-me-cotton-thun-26', N'Quần short đi biển mát mẻ - Cotton thun, màu xám, phù hợp đi biển, đi chơi mùa hè. Chất liệu cotton thun, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 279000, NULL, N'Cotton thun', N'ACTIVE'),
(N'Quần short denim basic - Kaki', N'quan-short-denim-basic-kaki-27', N'Quần short denim basic - Kaki, màu be, phù hợp đi biển, đi chơi mùa hè. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 299000, 245000, N'Kaki', N'ACTIVE'),
(N'Quần short thể thao năng động - Kaki', N'quan-short-the-thao-nang-dong-kaki-28', N'Quần short thể thao năng động - Kaki, màu đen, phù hợp đi biển, đi chơi mùa hè. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_short, @brandLocal, 329000, NULL, N'Kaki', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_short
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_short;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_short n
CROSS APPLY (VALUES (N'29', N'Đen'), (N'30', N'Be'), (N'31', N'Đen'), (N'32', N'Be')) AS x(size, color);
GO

-- ===== Quần thể thao (quan-the-thao) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_the_thao INT = (SELECT category_id FROM categories WHERE slug = N'quan-the-thao');
DECLARE @new_quan_the_thao TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_the_thao(product_id, slug)
VALUES
(N'Quần thể thao training năng động - Polyester gió', N'quan-the-thao-training-nang-dong-polyester-gio-01', N'Quần thể thao training năng động - Polyester gió, màu xám, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 199000, NULL, N'Polyester gió', N'ACTIVE'),
(N'Quần thể thao phối sọc thể thao - Thun co giãn 4 chiều', N'quan-the-thao-phoi-soc-the-thao-thun-co-gian-4-chieu-02', N'Quần thể thao phối sọc thể thao - Thun co giãn 4 chiều, màu xanh navy, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun co giãn 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 219000, NULL, N'Thun co giãn 4 chiều', N'ACTIVE'),
(N'Quần thể thao chạy bộ thoáng khí - Thun co giãn 4 chiều', N'quan-the-thao-chay-bo-thoang-khi-thun-co-gian-4-chieu-03', N'Quần thể thao chạy bộ thoáng khí - Thun co giãn 4 chiều, màu đen, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun co giãn 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 239000, 196000, N'Thun co giãn 4 chiều', N'ACTIVE'),
(N'Quần thể thao gió thể thao nhẹ - Thun co giãn 4 chiều', N'quan-the-thao-gio-the-thao-nhe-thun-co-gian-4-chieu-04', N'Quần thể thao gió thể thao nhẹ - Thun co giãn 4 chiều, màu rêu, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun co giãn 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 259000, NULL, N'Thun co giãn 4 chiều', N'ACTIVE'),
(N'Quần thể thao jogger bo gấu - Polyester gió', N'quan-the-thao-jogger-bo-gau-polyester-gio-05', N'Quần thể thao jogger bo gấu - Polyester gió, màu đen, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 279000, NULL, N'Polyester gió', N'ACTIVE'),
(N'Quần thể thao phối sọc thể thao - Thun lạnh', N'quan-the-thao-phoi-soc-the-thao-thun-lanh-06', N'Quần thể thao phối sọc thể thao - Thun lạnh, màu xám, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 299000, 245000, N'Thun lạnh', N'ACTIVE'),
(N'Quần thể thao jogger bo gấu - Thun co giãn 4 chiều', N'quan-the-thao-jogger-bo-gau-thun-co-gian-4-chieu-07', N'Quần thể thao jogger bo gấu - Thun co giãn 4 chiều, màu đen, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun co giãn 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 329000, NULL, N'Thun co giãn 4 chiều', N'ACTIVE'),
(N'Quần thể thao jogger bo gấu - Thun lạnh', N'quan-the-thao-jogger-bo-gau-thun-lanh-08', N'Quần thể thao jogger bo gấu - Thun lạnh, màu rêu, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 359000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Quần thể thao training năng động - Thun co giãn 4 chiều', N'quan-the-thao-training-nang-dong-thun-co-gian-4-chieu-09', N'Quần thể thao training năng động - Thun co giãn 4 chiều, màu rêu, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun co giãn 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 399000, 327000, N'Thun co giãn 4 chiều', N'ACTIVE'),
(N'Quần thể thao jogger bo gấu - Thun co giãn 4 chiều', N'quan-the-thao-jogger-bo-gau-thun-co-gian-4-chieu-10', N'Quần thể thao jogger bo gấu - Thun co giãn 4 chiều, màu xanh navy, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun co giãn 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 179000, NULL, N'Thun co giãn 4 chiều', N'ACTIVE'),
(N'Quần thể thao phối sọc thể thao - Cotton nỉ', N'quan-the-thao-phoi-soc-the-thao-cotton-ni-11', N'Quần thể thao phối sọc thể thao - Cotton nỉ, màu đen, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu cotton nỉ, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 199000, NULL, N'Cotton nỉ', N'ACTIVE'),
(N'Quần thể thao gió thể thao nhẹ - Thun co giãn 4 chiều', N'quan-the-thao-gio-the-thao-nhe-thun-co-gian-4-chieu-12', N'Quần thể thao gió thể thao nhẹ - Thun co giãn 4 chiều, màu xám, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun co giãn 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 219000, 180000, N'Thun co giãn 4 chiều', N'ACTIVE'),
(N'Quần thể thao túi khóa kéo tiện lợi - Cotton nỉ', N'quan-the-thao-tui-khoa-keo-tien-loi-cotton-ni-13', N'Quần thể thao túi khóa kéo tiện lợi - Cotton nỉ, màu xanh navy, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu cotton nỉ, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 239000, NULL, N'Cotton nỉ', N'ACTIVE'),
(N'Quần thể thao jogger bo gấu - Cotton nỉ', N'quan-the-thao-jogger-bo-gau-cotton-ni-14', N'Quần thể thao jogger bo gấu - Cotton nỉ, màu xanh navy, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu cotton nỉ, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 259000, NULL, N'Cotton nỉ', N'ACTIVE'),
(N'Quần thể thao chạy bộ thoáng khí - Polyester gió', N'quan-the-thao-chay-bo-thoang-khi-polyester-gio-15', N'Quần thể thao chạy bộ thoáng khí - Polyester gió, màu rêu, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 279000, 229000, N'Polyester gió', N'ACTIVE'),
(N'Quần thể thao form suông basic - Thun lạnh', N'quan-the-thao-form-suong-basic-thun-lanh-16', N'Quần thể thao form suông basic - Thun lạnh, màu rêu, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 299000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Quần thể thao chạy bộ thoáng khí - Cotton nỉ', N'quan-the-thao-chay-bo-thoang-khi-cotton-ni-17', N'Quần thể thao chạy bộ thoáng khí - Cotton nỉ, màu đen, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu cotton nỉ, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 329000, NULL, N'Cotton nỉ', N'ACTIVE'),
(N'Quần thể thao chạy bộ thoáng khí - Cotton nỉ', N'quan-the-thao-chay-bo-thoang-khi-cotton-ni-18', N'Quần thể thao chạy bộ thoáng khí - Cotton nỉ, màu xanh navy, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu cotton nỉ, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 359000, 294000, N'Cotton nỉ', N'ACTIVE'),
(N'Quần thể thao gió thể thao nhẹ - Polyester gió', N'quan-the-thao-gio-the-thao-nhe-polyester-gio-19', N'Quần thể thao gió thể thao nhẹ - Polyester gió, màu xám, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 399000, NULL, N'Polyester gió', N'ACTIVE'),
(N'Quần thể thao chạy bộ thoáng khí - Thun co giãn 4 chiều', N'quan-the-thao-chay-bo-thoang-khi-thun-co-gian-4-chieu-20', N'Quần thể thao chạy bộ thoáng khí - Thun co giãn 4 chiều, màu xám, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun co giãn 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 179000, NULL, N'Thun co giãn 4 chiều', N'ACTIVE'),
(N'Quần thể thao jogger bo gấu - Polyester gió', N'quan-the-thao-jogger-bo-gau-polyester-gio-21', N'Quần thể thao jogger bo gấu - Polyester gió, màu rêu, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 199000, 163000, N'Polyester gió', N'ACTIVE'),
(N'Quần thể thao gió thể thao nhẹ - Cotton nỉ', N'quan-the-thao-gio-the-thao-nhe-cotton-ni-22', N'Quần thể thao gió thể thao nhẹ - Cotton nỉ, màu đen, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu cotton nỉ, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 219000, NULL, N'Cotton nỉ', N'ACTIVE'),
(N'Quần thể thao thun lạnh co giãn - Thun co giãn 4 chiều', N'quan-the-thao-thun-lanh-co-gian-thun-co-gian-4-chieu-23', N'Quần thể thao thun lạnh co giãn - Thun co giãn 4 chiều, màu rêu, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun co giãn 4 chiều, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 239000, NULL, N'Thun co giãn 4 chiều', N'ACTIVE'),
(N'Quần thể thao túi khóa kéo tiện lợi - Thun lạnh', N'quan-the-thao-tui-khoa-keo-tien-loi-thun-lanh-24', N'Quần thể thao túi khóa kéo tiện lợi - Thun lạnh, màu xanh navy, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 259000, 212000, N'Thun lạnh', N'ACTIVE'),
(N'Quần thể thao thun lạnh co giãn - Cotton nỉ', N'quan-the-thao-thun-lanh-co-gian-cotton-ni-25', N'Quần thể thao thun lạnh co giãn - Cotton nỉ, màu rêu, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu cotton nỉ, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 279000, NULL, N'Cotton nỉ', N'ACTIVE'),
(N'Quần thể thao gió thể thao nhẹ - Cotton nỉ', N'quan-the-thao-gio-the-thao-nhe-cotton-ni-26', N'Quần thể thao gió thể thao nhẹ - Cotton nỉ, màu xanh navy, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu cotton nỉ, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 299000, NULL, N'Cotton nỉ', N'ACTIVE'),
(N'Quần thể thao phối sọc thể thao - Polyester gió', N'quan-the-thao-phoi-soc-the-thao-polyester-gio-27', N'Quần thể thao phối sọc thể thao - Polyester gió, màu đen, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 329000, 270000, N'Polyester gió', N'ACTIVE'),
(N'Quần thể thao túi khóa kéo tiện lợi - Polyester gió', N'quan-the-thao-tui-khoa-keo-tien-loi-polyester-gio-28', N'Quần thể thao túi khóa kéo tiện lợi - Polyester gió, màu xám, phù hợp chơi thể thao, tập gym, mặc nhà. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_quan_the_thao, @brandLocal, 359000, NULL, N'Polyester gió', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_the_thao
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_the_thao;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_the_thao n
CROSS APPLY (VALUES (N'29', N'Đen'), (N'30', N'Xám'), (N'31', N'Đen'), (N'32', N'Xám')) AS x(size, color);
GO

-- ===== Quần slim fit (quan-slim-fit) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_slim_fit INT = (SELECT category_id FROM categories WHERE slug = N'quan-slim-fit');
DECLARE @new_quan_slim_fit TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_slim_fit(product_id, slug)
VALUES
(N'Quần slim fit co giãn thoải mái - Denim co giãn', N'quan-slim-fit-co-gian-thoai-mai-denim-co-gian-01', N'Quần slim fit co giãn thoải mái - Denim co giãn, màu nâu, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 319000, NULL, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit form ôm nhẹ - Denim co giãn', N'quan-slim-fit-form-om-nhe-denim-co-gian-02', N'Quần slim fit form ôm nhẹ - Denim co giãn, màu xám, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 349000, NULL, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit ống côn hiện đại - Kaki co giãn', N'quan-slim-fit-ong-con-hien-dai-kaki-co-gian-03', N'Quần slim fit ống côn hiện đại - Kaki co giãn, màu xám, phù hợp đi làm, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 379000, 311000, N'Kaki co giãn', N'ACTIVE'),
(N'Quần slim fit vải Tencel mềm mại - Denim co giãn', N'quan-slim-fit-vai-tencel-mem-mai-denim-co-gian-04', N'Quần slim fit vải Tencel mềm mại - Denim co giãn, màu đen, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 409000, NULL, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit denim slimfit - Cotton pha spandex', N'quan-slim-fit-denim-slimfit-cotton-pha-spandex-05', N'Quần slim fit denim slimfit - Cotton pha spandex, màu nâu, phù hợp đi làm, đi chơi. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 439000, NULL, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần slim fit âu slimfit lịch lãm - Cotton pha spandex', N'quan-slim-fit-au-slimfit-lich-lam-cotton-pha-spandex-06', N'Quần slim fit âu slimfit lịch lãm - Cotton pha spandex, màu xám, phù hợp đi làm, đi chơi. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 469000, 385000, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần slim fit form ôm nhẹ - Tencel', N'quan-slim-fit-form-om-nhe-tencel-07', N'Quần slim fit form ôm nhẹ - Tencel, màu xanh navy, phù hợp đi làm, đi chơi. Chất liệu tencel, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 499000, NULL, N'Tencel', N'ACTIVE'),
(N'Quần slim fit âu slimfit lịch lãm - Kaki co giãn', N'quan-slim-fit-au-slimfit-lich-lam-kaki-co-gian-08', N'Quần slim fit âu slimfit lịch lãm - Kaki co giãn, màu xám, phù hợp đi làm, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 549000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần slim fit kaki slimfit - Kaki co giãn', N'quan-slim-fit-kaki-slimfit-kaki-co-gian-09', N'Quần slim fit kaki slimfit - Kaki co giãn, màu xanh navy, phù hợp đi làm, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 599000, 491000, N'Kaki co giãn', N'ACTIVE'),
(N'Quần slim fit denim slimfit - Kaki co giãn', N'quan-slim-fit-denim-slimfit-kaki-co-gian-10', N'Quần slim fit denim slimfit - Kaki co giãn, màu xanh navy, phù hợp đi làm, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 289000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần slim fit denim slimfit - Kaki co giãn', N'quan-slim-fit-denim-slimfit-kaki-co-gian-11', N'Quần slim fit denim slimfit - Kaki co giãn, màu nâu, phù hợp đi làm, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 319000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần slim fit basic một màu - Denim co giãn', N'quan-slim-fit-basic-mot-mau-denim-co-gian-12', N'Quần slim fit basic một màu - Denim co giãn, màu nâu, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 349000, 286000, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit form ôm nhẹ - Cotton pha spandex', N'quan-slim-fit-form-om-nhe-cotton-pha-spandex-13', N'Quần slim fit form ôm nhẹ - Cotton pha spandex, màu nâu, phù hợp đi làm, đi chơi. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 379000, NULL, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần slim fit co giãn thoải mái - Tencel', N'quan-slim-fit-co-gian-thoai-mai-tencel-14', N'Quần slim fit co giãn thoải mái - Tencel, màu xám, phù hợp đi làm, đi chơi. Chất liệu tencel, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 409000, NULL, N'Tencel', N'ACTIVE'),
(N'Quần slim fit ống côn hiện đại - Cotton pha spandex', N'quan-slim-fit-ong-con-hien-dai-cotton-pha-spandex-15', N'Quần slim fit ống côn hiện đại - Cotton pha spandex, màu nâu, phù hợp đi làm, đi chơi. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 439000, 360000, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần slim fit basic một màu - Denim co giãn', N'quan-slim-fit-basic-mot-mau-denim-co-gian-16', N'Quần slim fit basic một màu - Denim co giãn, màu đen, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 469000, NULL, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit vải Tencel mềm mại - Kaki co giãn', N'quan-slim-fit-vai-tencel-mem-mai-kaki-co-gian-17', N'Quần slim fit vải Tencel mềm mại - Kaki co giãn, màu đen, phù hợp đi làm, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 499000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần slim fit kaki slimfit - Denim co giãn', N'quan-slim-fit-kaki-slimfit-denim-co-gian-18', N'Quần slim fit kaki slimfit - Denim co giãn, màu xanh navy, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 549000, 450000, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit form ôm nhẹ - Kaki co giãn', N'quan-slim-fit-form-om-nhe-kaki-co-gian-19', N'Quần slim fit form ôm nhẹ - Kaki co giãn, màu xanh navy, phù hợp đi làm, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 599000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần slim fit âu slimfit lịch lãm - Cotton pha spandex', N'quan-slim-fit-au-slimfit-lich-lam-cotton-pha-spandex-20', N'Quần slim fit âu slimfit lịch lãm - Cotton pha spandex, màu xanh navy, phù hợp đi làm, đi chơi. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 289000, NULL, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần slim fit ống côn hiện đại - Tencel', N'quan-slim-fit-ong-con-hien-dai-tencel-21', N'Quần slim fit ống côn hiện đại - Tencel, màu đen, phù hợp đi làm, đi chơi. Chất liệu tencel, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 319000, 262000, N'Tencel', N'ACTIVE'),
(N'Quần slim fit kaki slimfit - Tencel', N'quan-slim-fit-kaki-slimfit-tencel-22', N'Quần slim fit kaki slimfit - Tencel, màu nâu, phù hợp đi làm, đi chơi. Chất liệu tencel, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 349000, NULL, N'Tencel', N'ACTIVE'),
(N'Quần slim fit vải Tencel mềm mại - Denim co giãn', N'quan-slim-fit-vai-tencel-mem-mai-denim-co-gian-23', N'Quần slim fit vải Tencel mềm mại - Denim co giãn, màu xanh navy, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 379000, NULL, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit ống côn hiện đại - Denim co giãn', N'quan-slim-fit-ong-con-hien-dai-denim-co-gian-24', N'Quần slim fit ống côn hiện đại - Denim co giãn, màu nâu, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 409000, 335000, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit denim slimfit - Denim co giãn', N'quan-slim-fit-denim-slimfit-denim-co-gian-25', N'Quần slim fit denim slimfit - Denim co giãn, màu nâu, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 439000, NULL, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit kaki slimfit - Cotton pha spandex', N'quan-slim-fit-kaki-slimfit-cotton-pha-spandex-26', N'Quần slim fit kaki slimfit - Cotton pha spandex, màu xám, phù hợp đi làm, đi chơi. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 469000, NULL, N'Cotton pha spandex', N'ACTIVE'),
(N'Quần slim fit denim slimfit - Denim co giãn', N'quan-slim-fit-denim-slimfit-denim-co-gian-27', N'Quần slim fit denim slimfit - Denim co giãn, màu đen, phù hợp đi làm, đi chơi. Chất liệu denim co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 499000, 409000, N'Denim co giãn', N'ACTIVE'),
(N'Quần slim fit basic một màu - Tencel', N'quan-slim-fit-basic-mot-mau-tencel-28', N'Quần slim fit basic một màu - Tencel, màu xám, phù hợp đi làm, đi chơi. Chất liệu tencel, form dáng chuẩn, dễ phối đồ.', @cat_quan_slim_fit, @brandLocal, 549000, NULL, N'Tencel', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_slim_fit
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_slim_fit;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_slim_fit n
CROSS APPLY (VALUES (N'29', N'Đen'), (N'30', N'Xám'), (N'31', N'Đen'), (N'32', N'Xám')) AS x(size, color);
GO

-- ===== Quần kaki (quan-kaki) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_kaki INT = (SELECT category_id FROM categories WHERE slug = N'quan-kaki');
DECLARE @new_quan_kaki TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_kaki(product_id, slug)
VALUES
(N'Quần kaki ống suông cổ điển - Kaki dày dặn', N'quan-kaki-ong-suong-co-dien-kaki-day-dan-01', N'Quần kaki ống suông cổ điển - Kaki dày dặn, màu xám, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 279000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki phối túi hông - Kaki cotton', N'quan-kaki-phoi-tui-hong-kaki-cotton-02', N'Quần kaki phối túi hông - Kaki cotton, màu xám, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 299000, NULL, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki form slim hiện đại - Kaki cotton', N'quan-kaki-form-slim-hien-dai-kaki-cotton-03', N'Quần kaki form slim hiện đại - Kaki cotton, màu xám, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 329000, 270000, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki ống suông cổ điển - Kaki co giãn', N'quan-kaki-ong-suong-co-dien-kaki-co-gian-04', N'Quần kaki ống suông cổ điển - Kaki co giãn, màu be, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 359000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần kaki túi hộp cargo - Kaki dày dặn', N'quan-kaki-tui-hop-cargo-kaki-day-dan-05', N'Quần kaki túi hộp cargo - Kaki dày dặn, màu xanh rêu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 389000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki chinos trẻ trung - Kaki cotton', N'quan-kaki-chinos-tre-trung-kaki-cotton-06', N'Quần kaki chinos trẻ trung - Kaki cotton, màu xanh rêu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 419000, 344000, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki co giãn nhẹ thoải mái - Kaki cotton', N'quan-kaki-co-gian-nhe-thoai-mai-kaki-cotton-07', N'Quần kaki co giãn nhẹ thoải mái - Kaki cotton, màu nâu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 449000, NULL, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki basic công sở - Kaki dày dặn', N'quan-kaki-basic-cong-so-kaki-day-dan-08', N'Quần kaki basic công sở - Kaki dày dặn, màu đen, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 469000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki co giãn nhẹ thoải mái - Kaki cotton', N'quan-kaki-co-gian-nhe-thoai-mai-kaki-cotton-09', N'Quần kaki co giãn nhẹ thoải mái - Kaki cotton, màu xám, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 499000, 409000, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki màu trơn basic - Kaki dày dặn', N'quan-kaki-mau-tron-basic-kaki-day-dan-10', N'Quần kaki màu trơn basic - Kaki dày dặn, màu nâu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 259000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki túi hộp cargo - Kaki dày dặn', N'quan-kaki-tui-hop-cargo-kaki-day-dan-11', N'Quần kaki túi hộp cargo - Kaki dày dặn, màu đen, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 279000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki túi hộp cargo - Kaki dày dặn', N'quan-kaki-tui-hop-cargo-kaki-day-dan-12', N'Quần kaki túi hộp cargo - Kaki dày dặn, màu nâu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 299000, 245000, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki phối túi hông - Kaki cotton', N'quan-kaki-phoi-tui-hong-kaki-cotton-13', N'Quần kaki phối túi hông - Kaki cotton, màu be, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 329000, NULL, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki basic công sở - Kaki dày dặn', N'quan-kaki-basic-cong-so-kaki-day-dan-14', N'Quần kaki basic công sở - Kaki dày dặn, màu xám, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 359000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki co giãn nhẹ thoải mái - Kaki dày dặn', N'quan-kaki-co-gian-nhe-thoai-mai-kaki-day-dan-15', N'Quần kaki co giãn nhẹ thoải mái - Kaki dày dặn, màu be, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 389000, 319000, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki chinos trẻ trung - Kaki dày dặn', N'quan-kaki-chinos-tre-trung-kaki-day-dan-16', N'Quần kaki chinos trẻ trung - Kaki dày dặn, màu xám, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 419000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki màu trơn basic - Kaki co giãn', N'quan-kaki-mau-tron-basic-kaki-co-gian-17', N'Quần kaki màu trơn basic - Kaki co giãn, màu đen, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 449000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần kaki co giãn nhẹ thoải mái - Kaki co giãn', N'quan-kaki-co-gian-nhe-thoai-mai-kaki-co-gian-18', N'Quần kaki co giãn nhẹ thoải mái - Kaki co giãn, màu nâu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 469000, 385000, N'Kaki co giãn', N'ACTIVE'),
(N'Quần kaki chinos trẻ trung - Kaki dày dặn', N'quan-kaki-chinos-tre-trung-kaki-day-dan-19', N'Quần kaki chinos trẻ trung - Kaki dày dặn, màu nâu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 499000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki chinos trẻ trung - Kaki cotton', N'quan-kaki-chinos-tre-trung-kaki-cotton-20', N'Quần kaki chinos trẻ trung - Kaki cotton, màu nâu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 259000, NULL, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki ống suông cổ điển - Kaki cotton', N'quan-kaki-ong-suong-co-dien-kaki-cotton-21', N'Quần kaki ống suông cổ điển - Kaki cotton, màu nâu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 279000, 229000, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki basic công sở - Kaki dày dặn', N'quan-kaki-basic-cong-so-kaki-day-dan-22', N'Quần kaki basic công sở - Kaki dày dặn, màu nâu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 299000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki co giãn nhẹ thoải mái - Kaki dày dặn', N'quan-kaki-co-gian-nhe-thoai-mai-kaki-day-dan-23', N'Quần kaki co giãn nhẹ thoải mái - Kaki dày dặn, màu nâu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 329000, NULL, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki co giãn nhẹ thoải mái - Kaki dày dặn', N'quan-kaki-co-gian-nhe-thoai-mai-kaki-day-dan-24', N'Quần kaki co giãn nhẹ thoải mái - Kaki dày dặn, màu xanh rêu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 359000, 294000, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki túi hộp cargo - Kaki cotton', N'quan-kaki-tui-hop-cargo-kaki-cotton-25', N'Quần kaki túi hộp cargo - Kaki cotton, màu xanh rêu, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 389000, NULL, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki co giãn nhẹ thoải mái - Kaki cotton', N'quan-kaki-co-gian-nhe-thoai-mai-kaki-cotton-26', N'Quần kaki co giãn nhẹ thoải mái - Kaki cotton, màu be, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 419000, NULL, N'Kaki cotton', N'ACTIVE'),
(N'Quần kaki màu trơn basic - Kaki dày dặn', N'quan-kaki-mau-tron-basic-kaki-day-dan-27', N'Quần kaki màu trơn basic - Kaki dày dặn, màu đen, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki dày dặn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 449000, 368000, N'Kaki dày dặn', N'ACTIVE'),
(N'Quần kaki form slim hiện đại - Kaki co giãn', N'quan-kaki-form-slim-hien-dai-kaki-co-gian-28', N'Quần kaki form slim hiện đại - Kaki co giãn, màu be, phù hợp đi làm, đi học, đi chơi. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_kaki, @brandLocal, 469000, NULL, N'Kaki co giãn', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_kaki
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_kaki;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_kaki n
CROSS APPLY (VALUES (N'29', N'Be'), (N'30', N'Xanh rêu'), (N'31', N'Be'), (N'32', N'Xanh rêu')) AS x(size, color);
GO

-- ===== Quần âu (quan-au) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_au INT = (SELECT category_id FROM categories WHERE slug = N'quan-au');
DECLARE @new_quan_au TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_au(product_id, slug)
VALUES
(N'Quần âu công sở vest lịch lãm - Wool pha', N'quan-au-cong-so-vest-lich-lam-wool-pha-01', N'Quần âu công sở vest lịch lãm - Wool pha, màu đen, phù hợp đi làm công sở, dự tiệc. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 429000, NULL, N'Wool pha', N'ACTIVE'),
(N'Quần âu phối lưng liền - Tuyết mưa cao cấp', N'quan-au-phoi-lung-lien-tuyet-mua-cao-cap-02', N'Quần âu phối lưng liền - Tuyết mưa cao cấp, màu xám nhạt, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 459000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu phối lưng liền - Wool pha', N'quan-au-phoi-lung-lien-wool-pha-03', N'Quần âu phối lưng liền - Wool pha, màu xanh navy, phù hợp đi làm công sở, dự tiệc. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 499000, 409000, N'Wool pha', N'ACTIVE'),
(N'Quần âu không ly hiện đại - Wool pha', N'quan-au-khong-ly-hien-dai-wool-pha-04', N'Quần âu không ly hiện đại - Wool pha, màu xám nhạt, phù hợp đi làm công sở, dự tiệc. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 539000, NULL, N'Wool pha', N'ACTIVE'),
(N'Quần âu không ly hiện đại - Tuyết mưa cao cấp', N'quan-au-khong-ly-hien-dai-tuyet-mua-cao-cap-05', N'Quần âu không ly hiện đại - Tuyết mưa cao cấp, màu xám nhạt, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 579000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu phối lưng liền - Tuyết mưa cao cấp', N'quan-au-phoi-lung-lien-tuyet-mua-cao-cap-06', N'Quần âu phối lưng liền - Tuyết mưa cao cấp, màu đen, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 619000, 508000, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu phối lưng liền - Kaki Âu', N'quan-au-phoi-lung-lien-kaki-au-07', N'Quần âu phối lưng liền - Kaki Âu, màu xám than, phù hợp đi làm công sở, dự tiệc. Chất liệu kaki âu, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 659000, NULL, N'Kaki Âu', N'ACTIVE'),
(N'Quần âu xếp ly cao cấp - Polyester cao cấp', N'quan-au-xep-ly-cao-cap-polyester-cao-cap-08', N'Quần âu xếp ly cao cấp - Polyester cao cấp, màu xám than, phù hợp đi làm công sở, dự tiệc. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 719000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần âu không ly hiện đại - Kaki Âu', N'quan-au-khong-ly-hien-dai-kaki-au-09', N'Quần âu không ly hiện đại - Kaki Âu, màu đen, phù hợp đi làm công sở, dự tiệc. Chất liệu kaki âu, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 799000, 655000, N'Kaki Âu', N'ACTIVE'),
(N'Quần âu công sở vest lịch lãm - Tuyết mưa cao cấp', N'quan-au-cong-so-vest-lich-lam-tuyet-mua-cao-cap-10', N'Quần âu công sở vest lịch lãm - Tuyết mưa cao cấp, màu xám than, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 399000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu ống đứng chuẩn form - Polyester cao cấp', N'quan-au-ong-dung-chuan-form-polyester-cao-cap-11', N'Quần âu ống đứng chuẩn form - Polyester cao cấp, màu xanh navy, phù hợp đi làm công sở, dự tiệc. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 429000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần âu vải Ý cao cấp - Tuyết mưa cao cấp', N'quan-au-vai-y-cao-cap-tuyet-mua-cao-cap-12', N'Quần âu vải Ý cao cấp - Tuyết mưa cao cấp, màu xám nhạt, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 459000, 376000, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu phối lưng liền - Wool pha', N'quan-au-phoi-lung-lien-wool-pha-13', N'Quần âu phối lưng liền - Wool pha, màu đen, phù hợp đi làm công sở, dự tiệc. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 499000, NULL, N'Wool pha', N'ACTIVE'),
(N'Quần âu wool pha sang trọng - Tuyết mưa cao cấp', N'quan-au-wool-pha-sang-trong-tuyet-mua-cao-cap-14', N'Quần âu wool pha sang trọng - Tuyết mưa cao cấp, màu xanh navy, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 539000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu ống đứng chuẩn form - Kaki Âu', N'quan-au-ong-dung-chuan-form-kaki-au-15', N'Quần âu ống đứng chuẩn form - Kaki Âu, màu xanh navy, phù hợp đi làm công sở, dự tiệc. Chất liệu kaki âu, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 579000, 475000, N'Kaki Âu', N'ACTIVE'),
(N'Quần âu basic một màu - Kaki Âu', N'quan-au-basic-mot-mau-kaki-au-16', N'Quần âu basic một màu - Kaki Âu, màu xám than, phù hợp đi làm công sở, dự tiệc. Chất liệu kaki âu, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 619000, NULL, N'Kaki Âu', N'ACTIVE'),
(N'Quần âu basic một màu - Kaki Âu', N'quan-au-basic-mot-mau-kaki-au-17', N'Quần âu basic một màu - Kaki Âu, màu đen, phù hợp đi làm công sở, dự tiệc. Chất liệu kaki âu, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 659000, NULL, N'Kaki Âu', N'ACTIVE'),
(N'Quần âu vải Ý cao cấp - Wool pha', N'quan-au-vai-y-cao-cap-wool-pha-18', N'Quần âu vải Ý cao cấp - Wool pha, màu đen, phù hợp đi làm công sở, dự tiệc. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 719000, 590000, N'Wool pha', N'ACTIVE'),
(N'Quần âu ống đứng chuẩn form - Polyester cao cấp', N'quan-au-ong-dung-chuan-form-polyester-cao-cap-19', N'Quần âu ống đứng chuẩn form - Polyester cao cấp, màu xám than, phù hợp đi làm công sở, dự tiệc. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 799000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần âu vải Ý cao cấp - Tuyết mưa cao cấp', N'quan-au-vai-y-cao-cap-tuyet-mua-cao-cap-20', N'Quần âu vải Ý cao cấp - Tuyết mưa cao cấp, màu xám than, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 399000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu ống đứng chuẩn form - Kaki Âu', N'quan-au-ong-dung-chuan-form-kaki-au-21', N'Quần âu ống đứng chuẩn form - Kaki Âu, màu đen, phù hợp đi làm công sở, dự tiệc. Chất liệu kaki âu, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 429000, 352000, N'Kaki Âu', N'ACTIVE'),
(N'Quần âu ống đứng chuẩn form - Tuyết mưa cao cấp', N'quan-au-ong-dung-chuan-form-tuyet-mua-cao-cap-22', N'Quần âu ống đứng chuẩn form - Tuyết mưa cao cấp, màu xanh navy, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 459000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu ống đứng chuẩn form - Polyester cao cấp', N'quan-au-ong-dung-chuan-form-polyester-cao-cap-23', N'Quần âu ống đứng chuẩn form - Polyester cao cấp, màu đen, phù hợp đi làm công sở, dự tiệc. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 499000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần âu xếp ly cao cấp - Kaki Âu', N'quan-au-xep-ly-cao-cap-kaki-au-24', N'Quần âu xếp ly cao cấp - Kaki Âu, màu xám nhạt, phù hợp đi làm công sở, dự tiệc. Chất liệu kaki âu, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 539000, 442000, N'Kaki Âu', N'ACTIVE'),
(N'Quần âu wool pha sang trọng - Tuyết mưa cao cấp', N'quan-au-wool-pha-sang-trong-tuyet-mua-cao-cap-25', N'Quần âu wool pha sang trọng - Tuyết mưa cao cấp, màu xám than, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 579000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu wool pha sang trọng - Wool pha', N'quan-au-wool-pha-sang-trong-wool-pha-26', N'Quần âu wool pha sang trọng - Wool pha, màu xanh navy, phù hợp đi làm công sở, dự tiệc. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 619000, NULL, N'Wool pha', N'ACTIVE'),
(N'Quần âu xếp ly cao cấp - Tuyết mưa cao cấp', N'quan-au-xep-ly-cao-cap-tuyet-mua-cao-cap-27', N'Quần âu xếp ly cao cấp - Tuyết mưa cao cấp, màu xanh navy, phù hợp đi làm công sở, dự tiệc. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 659000, 540000, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Quần âu xếp ly cao cấp - Kaki Âu', N'quan-au-xep-ly-cao-cap-kaki-au-28', N'Quần âu xếp ly cao cấp - Kaki Âu, màu đen, phù hợp đi làm công sở, dự tiệc. Chất liệu kaki âu, form dáng chuẩn, dễ phối đồ.', @cat_quan_au, @brandLocal, 719000, NULL, N'Kaki Âu', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_au
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_au;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_au n
CROSS APPLY (VALUES (N'29', N'Đen'), (N'30', N'Xám than'), (N'31', N'Đen'), (N'32', N'Xám than')) AS x(size, color);
GO

-- ===== Quần regular fit (quan-regular-fit) — 28 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_regular_fit INT = (SELECT category_id FROM categories WHERE slug = N'quan-regular-fit');
DECLARE @new_quan_regular_fit TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_regular_fit(product_id, slug)
VALUES
(N'Quần regular fit vải cao cấp bền màu - Cotton pha', N'quan-regular-fit-vai-cao-cap-ben-mau-cotton-pha-01', N'Quần regular fit vải cao cấp bền màu - Cotton pha, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 299000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit phối túi sau - Cotton pha', N'quan-regular-fit-phoi-tui-sau-cotton-pha-02', N'Quần regular fit phối túi sau - Cotton pha, màu đen, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 329000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit form vừa vặn thoải mái - Cotton pha', N'quan-regular-fit-form-vua-van-thoai-mai-cotton-pha-03', N'Quần regular fit form vừa vặn thoải mái - Cotton pha, màu xám, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 359000, 294000, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit kaki regular - Cotton pha', N'quan-regular-fit-kaki-regular-cotton-pha-04', N'Quần regular fit kaki regular - Cotton pha, màu xám, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 389000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit basic một màu - Polyester', N'quan-regular-fit-basic-mot-mau-polyester-05', N'Quần regular fit basic một màu - Polyester, màu xám, phù hợp đi làm, đi học hằng ngày. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 419000, NULL, N'Polyester', N'ACTIVE'),
(N'Quần regular fit âu regular lịch lãm - Cotton pha', N'quan-regular-fit-au-regular-lich-lam-cotton-pha-06', N'Quần regular fit âu regular lịch lãm - Cotton pha, màu đen, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 449000, 368000, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit kaki regular - Kaki', N'quan-regular-fit-kaki-regular-kaki-07', N'Quần regular fit kaki regular - Kaki, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 479000, NULL, N'Kaki', N'ACTIVE'),
(N'Quần regular fit kaki regular - Denim', N'quan-regular-fit-kaki-regular-denim-08', N'Quần regular fit kaki regular - Denim, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 509000, NULL, N'Denim', N'ACTIVE'),
(N'Quần regular fit denim regular - Polyester', N'quan-regular-fit-denim-regular-polyester-09', N'Quần regular fit denim regular - Polyester, màu đen, phù hợp đi làm, đi học hằng ngày. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 549000, 450000, N'Polyester', N'ACTIVE'),
(N'Quần regular fit denim regular - Denim', N'quan-regular-fit-denim-regular-denim-10', N'Quần regular fit denim regular - Denim, màu be, phù hợp đi làm, đi học hằng ngày. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 279000, NULL, N'Denim', N'ACTIVE'),
(N'Quần regular fit phối túi sau - Denim', N'quan-regular-fit-phoi-tui-sau-denim-11', N'Quần regular fit phối túi sau - Denim, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 299000, NULL, N'Denim', N'ACTIVE'),
(N'Quần regular fit basic một màu - Polyester', N'quan-regular-fit-basic-mot-mau-polyester-12', N'Quần regular fit basic một màu - Polyester, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 329000, 270000, N'Polyester', N'ACTIVE'),
(N'Quần regular fit âu regular lịch lãm - Cotton pha', N'quan-regular-fit-au-regular-lich-lam-cotton-pha-13', N'Quần regular fit âu regular lịch lãm - Cotton pha, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 359000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit ống đứng basic - Denim', N'quan-regular-fit-ong-dung-basic-denim-14', N'Quần regular fit ống đứng basic - Denim, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 389000, NULL, N'Denim', N'ACTIVE'),
(N'Quần regular fit phối túi sau - Cotton pha', N'quan-regular-fit-phoi-tui-sau-cotton-pha-15', N'Quần regular fit phối túi sau - Cotton pha, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 419000, 344000, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit âu regular lịch lãm - Polyester', N'quan-regular-fit-au-regular-lich-lam-polyester-16', N'Quần regular fit âu regular lịch lãm - Polyester, màu xám, phù hợp đi làm, đi học hằng ngày. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 449000, NULL, N'Polyester', N'ACTIVE'),
(N'Quần regular fit basic một màu - Polyester', N'quan-regular-fit-basic-mot-mau-polyester-17', N'Quần regular fit basic một màu - Polyester, màu đen, phù hợp đi làm, đi học hằng ngày. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 479000, NULL, N'Polyester', N'ACTIVE'),
(N'Quần regular fit basic một màu - Kaki', N'quan-regular-fit-basic-mot-mau-kaki-18', N'Quần regular fit basic một màu - Kaki, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 509000, 417000, N'Kaki', N'ACTIVE'),
(N'Quần regular fit form vừa vặn thoải mái - Kaki', N'quan-regular-fit-form-vua-van-thoai-mai-kaki-19', N'Quần regular fit form vừa vặn thoải mái - Kaki, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu kaki, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 549000, NULL, N'Kaki', N'ACTIVE'),
(N'Quần regular fit form vừa vặn thoải mái - Cotton pha', N'quan-regular-fit-form-vua-van-thoai-mai-cotton-pha-20', N'Quần regular fit form vừa vặn thoải mái - Cotton pha, màu be, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 279000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit ống đứng basic - Cotton pha', N'quan-regular-fit-ong-dung-basic-cotton-pha-21', N'Quần regular fit ống đứng basic - Cotton pha, màu be, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 299000, 245000, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit ống đứng basic - Cotton pha', N'quan-regular-fit-ong-dung-basic-cotton-pha-22', N'Quần regular fit ống đứng basic - Cotton pha, màu xám, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 329000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần regular fit form vừa vặn thoải mái - Denim', N'quan-regular-fit-form-vua-van-thoai-mai-denim-23', N'Quần regular fit form vừa vặn thoải mái - Denim, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 359000, NULL, N'Denim', N'ACTIVE'),
(N'Quần regular fit kaki regular - Denim', N'quan-regular-fit-kaki-regular-denim-24', N'Quần regular fit kaki regular - Denim, màu be, phù hợp đi làm, đi học hằng ngày. Chất liệu denim, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 389000, 319000, N'Denim', N'ACTIVE'),
(N'Quần regular fit form vừa vặn thoải mái - Polyester', N'quan-regular-fit-form-vua-van-thoai-mai-polyester-25', N'Quần regular fit form vừa vặn thoải mái - Polyester, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 419000, NULL, N'Polyester', N'ACTIVE'),
(N'Quần regular fit ống đứng basic - Polyester', N'quan-regular-fit-ong-dung-basic-polyester-26', N'Quần regular fit ống đứng basic - Polyester, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 449000, NULL, N'Polyester', N'ACTIVE'),
(N'Quần regular fit denim regular - Polyester', N'quan-regular-fit-denim-regular-polyester-27', N'Quần regular fit denim regular - Polyester, màu xám, phù hợp đi làm, đi học hằng ngày. Chất liệu polyester, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 479000, 393000, N'Polyester', N'ACTIVE'),
(N'Quần regular fit basic một màu - Cotton pha', N'quan-regular-fit-basic-mot-mau-cotton-pha-28', N'Quần regular fit basic một màu - Cotton pha, màu xanh navy, phù hợp đi làm, đi học hằng ngày. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_regular_fit, @brandLocal, 509000, NULL, N'Cotton pha', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_regular_fit
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_regular_fit;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_regular_fit n
CROSS APPLY (VALUES (N'29', N'Đen'), (N'30', N'Xám'), (N'31', N'Đen'), (N'32', N'Xám')) AS x(size, color);
GO

-- ===== Quần fiero (quan-fiero) — 25 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_fiero INT = (SELECT category_id FROM categories WHERE slug = N'quan-fiero');
DECLARE @new_quan_fiero TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_fiero(product_id, slug)
VALUES
(N'Quần fiero ống côn hiện đại - Cotton co giãn', N'quan-fiero-ong-con-hien-dai-cotton-co-gian-01', N'Quần fiero ống côn hiện đại - Cotton co giãn, màu rêu, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 329000, NULL, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero ống đứng cá tính - Kaki Hàn Quốc', N'quan-fiero-ong-dung-ca-tinh-kaki-han-quoc-02', N'Quần fiero ống đứng cá tính - Kaki Hàn Quốc, màu rêu, phù hợp đi chơi, phối đồ năng động. Chất liệu kaki hàn quốc, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 359000, NULL, N'Kaki Hàn Quốc', N'ACTIVE'),
(N'Quần fiero ống côn hiện đại - Denim mềm', N'quan-fiero-ong-con-hien-dai-denim-mem-03', N'Quần fiero ống côn hiện đại - Denim mềm, màu xám, phù hợp đi chơi, phối đồ năng động. Chất liệu denim mềm, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 389000, 319000, N'Denim mềm', N'ACTIVE'),
(N'Quần fiero form basic năng động - Polyester cao cấp', N'quan-fiero-form-basic-nang-dong-polyester-cao-cap-04', N'Quần fiero form basic năng động - Polyester cao cấp, màu xanh navy, phù hợp đi chơi, phối đồ năng động. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 419000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần fiero ống đứng cá tính - Polyester cao cấp', N'quan-fiero-ong-dung-ca-tinh-polyester-cao-cap-05', N'Quần fiero ống đứng cá tính - Polyester cao cấp, màu đen, phù hợp đi chơi, phối đồ năng động. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 449000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần fiero phong cách streetwear - Denim mềm', N'quan-fiero-phong-cach-streetwear-denim-mem-06', N'Quần fiero phong cách streetwear - Denim mềm, màu rêu, phù hợp đi chơi, phối đồ năng động. Chất liệu denim mềm, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 479000, 393000, N'Denim mềm', N'ACTIVE'),
(N'Quần fiero phong cách streetwear - Polyester cao cấp', N'quan-fiero-phong-cach-streetwear-polyester-cao-cap-07', N'Quần fiero phong cách streetwear - Polyester cao cấp, màu rêu, phù hợp đi chơi, phối đồ năng động. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 519000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần fiero vải co giãn Hàn Quốc - Denim mềm', N'quan-fiero-vai-co-gian-han-quoc-denim-mem-08', N'Quần fiero vải co giãn Hàn Quốc - Denim mềm, màu đen, phù hợp đi chơi, phối đồ năng động. Chất liệu denim mềm, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 559000, NULL, N'Denim mềm', N'ACTIVE'),
(N'Quần fiero phối túi hộp - Cotton co giãn', N'quan-fiero-phoi-tui-hop-cotton-co-gian-09', N'Quần fiero phối túi hộp - Cotton co giãn, màu rêu, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 599000, 491000, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero ống côn hiện đại - Cotton co giãn', N'quan-fiero-ong-con-hien-dai-cotton-co-gian-10', N'Quần fiero ống côn hiện đại - Cotton co giãn, màu xanh navy, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 299000, NULL, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero phối dây rút cá tính - Cotton co giãn', N'quan-fiero-phoi-day-rut-ca-tinh-cotton-co-gian-11', N'Quần fiero phối dây rút cá tính - Cotton co giãn, màu đen, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 329000, NULL, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero vải co giãn Hàn Quốc - Cotton co giãn', N'quan-fiero-vai-co-gian-han-quoc-cotton-co-gian-12', N'Quần fiero vải co giãn Hàn Quốc - Cotton co giãn, màu xanh navy, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 359000, 294000, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero ống côn hiện đại - Cotton co giãn', N'quan-fiero-ong-con-hien-dai-cotton-co-gian-13', N'Quần fiero ống côn hiện đại - Cotton co giãn, màu đen, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 389000, NULL, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero vải co giãn Hàn Quốc - Kaki Hàn Quốc', N'quan-fiero-vai-co-gian-han-quoc-kaki-han-quoc-14', N'Quần fiero vải co giãn Hàn Quốc - Kaki Hàn Quốc, màu xanh navy, phù hợp đi chơi, phối đồ năng động. Chất liệu kaki hàn quốc, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 419000, NULL, N'Kaki Hàn Quốc', N'ACTIVE'),
(N'Quần fiero form basic năng động - Cotton co giãn', N'quan-fiero-form-basic-nang-dong-cotton-co-gian-15', N'Quần fiero form basic năng động - Cotton co giãn, màu xám, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 449000, 368000, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero phong cách streetwear - Kaki Hàn Quốc', N'quan-fiero-phong-cach-streetwear-kaki-han-quoc-16', N'Quần fiero phong cách streetwear - Kaki Hàn Quốc, màu xám, phù hợp đi chơi, phối đồ năng động. Chất liệu kaki hàn quốc, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 479000, NULL, N'Kaki Hàn Quốc', N'ACTIVE'),
(N'Quần fiero form basic năng động - Denim mềm', N'quan-fiero-form-basic-nang-dong-denim-mem-17', N'Quần fiero form basic năng động - Denim mềm, màu xanh navy, phù hợp đi chơi, phối đồ năng động. Chất liệu denim mềm, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 519000, NULL, N'Denim mềm', N'ACTIVE'),
(N'Quần fiero ống đứng cá tính - Cotton co giãn', N'quan-fiero-ong-dung-ca-tinh-cotton-co-gian-18', N'Quần fiero ống đứng cá tính - Cotton co giãn, màu đen, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 559000, 458000, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero phong cách streetwear - Cotton co giãn', N'quan-fiero-phong-cach-streetwear-cotton-co-gian-19', N'Quần fiero phong cách streetwear - Cotton co giãn, màu đen, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 599000, NULL, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero ống côn hiện đại - Kaki Hàn Quốc', N'quan-fiero-ong-con-hien-dai-kaki-han-quoc-20', N'Quần fiero ống côn hiện đại - Kaki Hàn Quốc, màu rêu, phù hợp đi chơi, phối đồ năng động. Chất liệu kaki hàn quốc, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 299000, NULL, N'Kaki Hàn Quốc', N'ACTIVE'),
(N'Quần fiero ống đứng cá tính - Polyester cao cấp', N'quan-fiero-ong-dung-ca-tinh-polyester-cao-cap-21', N'Quần fiero ống đứng cá tính - Polyester cao cấp, màu rêu, phù hợp đi chơi, phối đồ năng động. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 329000, 270000, N'Polyester cao cấp', N'ACTIVE'),
(N'Quần fiero ống đứng cá tính - Kaki Hàn Quốc', N'quan-fiero-ong-dung-ca-tinh-kaki-han-quoc-22', N'Quần fiero ống đứng cá tính - Kaki Hàn Quốc, màu đen, phù hợp đi chơi, phối đồ năng động. Chất liệu kaki hàn quốc, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 359000, NULL, N'Kaki Hàn Quốc', N'ACTIVE'),
(N'Quần fiero form basic năng động - Kaki Hàn Quốc', N'quan-fiero-form-basic-nang-dong-kaki-han-quoc-23', N'Quần fiero form basic năng động - Kaki Hàn Quốc, màu đen, phù hợp đi chơi, phối đồ năng động. Chất liệu kaki hàn quốc, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 389000, NULL, N'Kaki Hàn Quốc', N'ACTIVE'),
(N'Quần fiero phong cách streetwear - Cotton co giãn', N'quan-fiero-phong-cach-streetwear-cotton-co-gian-24', N'Quần fiero phong cách streetwear - Cotton co giãn, màu rêu, phù hợp đi chơi, phối đồ năng động. Chất liệu cotton co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 419000, 344000, N'Cotton co giãn', N'ACTIVE'),
(N'Quần fiero basic một màu - Denim mềm', N'quan-fiero-basic-mot-mau-denim-mem-25', N'Quần fiero basic một màu - Denim mềm, màu rêu, phù hợp đi chơi, phối đồ năng động. Chất liệu denim mềm, form dáng chuẩn, dễ phối đồ.', @cat_quan_fiero, @brandLocal, 449000, NULL, N'Denim mềm', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_fiero
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_fiero;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_fiero n
CROSS APPLY (VALUES (N'29', N'Đen'), (N'30', N'Xám'), (N'31', N'Đen'), (N'32', N'Xám')) AS x(size, color);
GO

-- ===== Quần cropped (quan-cropped) — 25 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_cropped INT = (SELECT category_id FROM categories WHERE slug = N'quan-cropped');
DECLARE @new_quan_cropped TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_cropped(product_id, slug)
VALUES
(N'Quần cropped form hiện đại - Kaki co giãn', N'quan-cropped-form-hien-dai-kaki-co-gian-01', N'Quần cropped form hiện đại - Kaki co giãn, màu be, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 279000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần cropped kiểu Hàn Quốc trẻ trung - Cotton pha', N'quan-cropped-kieu-han-quoc-tre-trung-cotton-pha-02', N'Quần cropped kiểu Hàn Quốc trẻ trung - Cotton pha, màu be, phù hợp đi chơi, đi học mùa hè. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 299000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần cropped linen mùa hè mát mẻ - Kaki mỏng', N'quan-cropped-linen-mua-he-mat-me-kaki-mong-03', N'Quần cropped linen mùa hè mát mẻ - Kaki mỏng, màu đen, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki mỏng, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 329000, 270000, N'Kaki mỏng', N'ACTIVE'),
(N'Quần cropped một màu tối giản - Kaki co giãn', N'quan-cropped-mot-mau-toi-gian-kaki-co-gian-04', N'Quần cropped một màu tối giản - Kaki co giãn, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 359000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần cropped phối gấu hiện đại - Kaki co giãn', N'quan-cropped-phoi-gau-hien-dai-kaki-co-gian-05', N'Quần cropped phối gấu hiện đại - Kaki co giãn, màu be, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 389000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần cropped ống đứng lửng - Kaki mỏng', N'quan-cropped-ong-dung-lung-kaki-mong-06', N'Quần cropped ống đứng lửng - Kaki mỏng, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki mỏng, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 419000, 344000, N'Kaki mỏng', N'ACTIVE'),
(N'Quần cropped phối gấu hiện đại - Kaki co giãn', N'quan-cropped-phoi-gau-hien-dai-kaki-co-gian-07', N'Quần cropped phối gấu hiện đại - Kaki co giãn, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 439000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần cropped basic ống suông - Linen', N'quan-cropped-basic-ong-suong-linen-08', N'Quần cropped basic ống suông - Linen, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 459000, NULL, N'Linen', N'ACTIVE'),
(N'Quần cropped phối túi hông - Linen', N'quan-cropped-phoi-tui-hong-linen-09', N'Quần cropped phối túi hông - Linen, màu đen, phù hợp đi chơi, đi học mùa hè. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 499000, 409000, N'Linen', N'ACTIVE'),
(N'Quần cropped ống đứng lửng - Cotton pha', N'quan-cropped-ong-dung-lung-cotton-pha-10', N'Quần cropped ống đứng lửng - Cotton pha, màu đen, phù hợp đi chơi, đi học mùa hè. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 259000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần cropped phối gấu hiện đại - Cotton pha', N'quan-cropped-phoi-gau-hien-dai-cotton-pha-11', N'Quần cropped phối gấu hiện đại - Cotton pha, màu xám, phù hợp đi chơi, đi học mùa hè. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 279000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần cropped phối gấu hiện đại - Kaki mỏng', N'quan-cropped-phoi-gau-hien-dai-kaki-mong-12', N'Quần cropped phối gấu hiện đại - Kaki mỏng, màu be, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki mỏng, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 299000, 245000, N'Kaki mỏng', N'ACTIVE'),
(N'Quần cropped phối gấu hiện đại - Linen', N'quan-cropped-phoi-gau-hien-dai-linen-13', N'Quần cropped phối gấu hiện đại - Linen, màu be, phù hợp đi chơi, đi học mùa hè. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 329000, NULL, N'Linen', N'ACTIVE'),
(N'Quần cropped một màu tối giản - Cotton pha', N'quan-cropped-mot-mau-toi-gian-cotton-pha-14', N'Quần cropped một màu tối giản - Cotton pha, màu xám, phù hợp đi chơi, đi học mùa hè. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 359000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần cropped form hiện đại - Linen', N'quan-cropped-form-hien-dai-linen-15', N'Quần cropped form hiện đại - Linen, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 389000, 319000, N'Linen', N'ACTIVE'),
(N'Quần cropped phối gấu hiện đại - Kaki mỏng', N'quan-cropped-phoi-gau-hien-dai-kaki-mong-16', N'Quần cropped phối gấu hiện đại - Kaki mỏng, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki mỏng, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 419000, NULL, N'Kaki mỏng', N'ACTIVE'),
(N'Quần cropped form hiện đại - Kaki co giãn', N'quan-cropped-form-hien-dai-kaki-co-gian-17', N'Quần cropped form hiện đại - Kaki co giãn, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 439000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần cropped ống đứng lửng - Linen', N'quan-cropped-ong-dung-lung-linen-18', N'Quần cropped ống đứng lửng - Linen, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 459000, 376000, N'Linen', N'ACTIVE'),
(N'Quần cropped một màu tối giản - Kaki co giãn', N'quan-cropped-mot-mau-toi-gian-kaki-co-gian-19', N'Quần cropped một màu tối giản - Kaki co giãn, màu xám, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 499000, NULL, N'Kaki co giãn', N'ACTIVE'),
(N'Quần cropped ống đứng lửng - Linen', N'quan-cropped-ong-dung-lung-linen-20', N'Quần cropped ống đứng lửng - Linen, màu đen, phù hợp đi chơi, đi học mùa hè. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 259000, NULL, N'Linen', N'ACTIVE'),
(N'Quần cropped basic ống suông - Kaki mỏng', N'quan-cropped-basic-ong-suong-kaki-mong-21', N'Quần cropped basic ống suông - Kaki mỏng, màu đen, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki mỏng, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 279000, 229000, N'Kaki mỏng', N'ACTIVE'),
(N'Quần cropped kiểu Hàn Quốc trẻ trung - Cotton pha', N'quan-cropped-kieu-han-quoc-tre-trung-cotton-pha-22', N'Quần cropped kiểu Hàn Quốc trẻ trung - Cotton pha, màu đen, phù hợp đi chơi, đi học mùa hè. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 299000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần cropped phối gấu hiện đại - Cotton pha', N'quan-cropped-phoi-gau-hien-dai-cotton-pha-23', N'Quần cropped phối gấu hiện đại - Cotton pha, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu cotton pha, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 329000, NULL, N'Cotton pha', N'ACTIVE'),
(N'Quần cropped phối túi hông - Kaki co giãn', N'quan-cropped-phoi-tui-hong-kaki-co-gian-24', N'Quần cropped phối túi hông - Kaki co giãn, màu xám, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki co giãn, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 359000, 294000, N'Kaki co giãn', N'ACTIVE'),
(N'Quần cropped một màu tối giản - Kaki mỏng', N'quan-cropped-mot-mau-toi-gian-kaki-mong-25', N'Quần cropped một màu tối giản - Kaki mỏng, màu xanh rêu, phù hợp đi chơi, đi học mùa hè. Chất liệu kaki mỏng, form dáng chuẩn, dễ phối đồ.', @cat_quan_cropped, @brandLocal, 389000, NULL, N'Kaki mỏng', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_cropped
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_cropped;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_cropped n
CROSS APPLY (VALUES (N'29', N'Be'), (N'30', N'Đen'), (N'31', N'Be'), (N'32', N'Đen')) AS x(size, color);
GO

-- ===== Quần boxer (quan-boxer) — 5 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_boxer INT = (SELECT category_id FROM categories WHERE slug = N'quan-boxer');
DECLARE @new_quan_boxer TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_boxer(product_id, slug)
VALUES
(N'Quần boxer trơn basic - Thun lạnh', N'quan-boxer-tron-basic-thun-lanh-01', N'Quần boxer trơn basic - Thun lạnh, màu trắng, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_quan_boxer, @brandLocal, 99000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Quần boxer thun lạnh co giãn - Modal', N'quan-boxer-thun-lanh-co-gian-modal-02', N'Quần boxer thun lạnh co giãn - Modal, màu đen, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu modal, form dáng chuẩn, dễ phối đồ.', @cat_quan_boxer, @brandLocal, 119000, NULL, N'Modal', N'ACTIVE'),
(N'Quần boxer họa tiết caro - Modal', N'quan-boxer-hoa-tiet-caro-modal-03', N'Quần boxer họa tiết caro - Modal, màu trắng, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu modal, form dáng chuẩn, dễ phối đồ.', @cat_quan_boxer, @brandLocal, 139000, 114000, N'Modal', N'ACTIVE'),
(N'Quần boxer họa tiết caro - Thun lạnh', N'quan-boxer-hoa-tiet-caro-thun-lanh-04', N'Quần boxer họa tiết caro - Thun lạnh, màu xám, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_quan_boxer, @brandLocal, 159000, NULL, N'Thun lạnh', N'ACTIVE'),
(N'Quần boxer họa tiết caro - Cotton', N'quan-boxer-hoa-tiet-caro-cotton-05', N'Quần boxer họa tiết caro - Cotton, màu xám, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_boxer, @brandLocal, 179000, NULL, N'Cotton', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_boxer
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_boxer;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_boxer n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Xám'), (N'L', N'Đen'), (N'XL', N'Xám')) AS x(size, color);
GO

-- ===== Áo lót (ao-lot) — 5 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_ao_lot INT = (SELECT category_id FROM categories WHERE slug = N'ao-lot');
DECLARE @new_ao_lot TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_ao_lot(product_id, slug)
VALUES
(N'Áo lót thấm hút mồ hôi - Modal', N'ao-lot-tham-hut-mo-hoi-modal-01', N'Áo lót thấm hút mồ hôi - Modal, màu trắng, phù hợp mặc hằng ngày bên trong. Chất liệu modal, form dáng chuẩn, dễ phối đồ.', @cat_ao_lot, @brandLocal, 89000, NULL, N'Modal', N'ACTIVE'),
(N'Áo lót ba lỗ mát mẻ - Modal', N'ao-lot-ba-lo-mat-me-modal-02', N'Áo lót ba lỗ mát mẻ - Modal, màu đen, phù hợp mặc hằng ngày bên trong. Chất liệu modal, form dáng chuẩn, dễ phối đồ.', @cat_ao_lot, @brandLocal, 99000, NULL, N'Modal', N'ACTIVE'),
(N'Áo lót form ôm vừa vặn - Cotton pha spandex', N'ao-lot-form-om-vua-van-cotton-pha-spandex-03', N'Áo lót form ôm vừa vặn - Cotton pha spandex, màu đen, phù hợp mặc hằng ngày bên trong. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_ao_lot, @brandLocal, 119000, 98000, N'Cotton pha spandex', N'ACTIVE'),
(N'Áo lót ba lỗ mát mẻ - Cotton pha spandex', N'ao-lot-ba-lo-mat-me-cotton-pha-spandex-04', N'Áo lót ba lỗ mát mẻ - Cotton pha spandex, màu trắng, phù hợp mặc hằng ngày bên trong. Chất liệu cotton pha spandex, form dáng chuẩn, dễ phối đồ.', @cat_ao_lot, @brandLocal, 139000, NULL, N'Cotton pha spandex', N'ACTIVE'),
(N'Áo lót cổ tròn basic - Modal', N'ao-lot-co-tron-basic-modal-05', N'Áo lót cổ tròn basic - Modal, màu đen, phù hợp mặc hằng ngày bên trong. Chất liệu modal, form dáng chuẩn, dễ phối đồ.', @cat_ao_lot, @brandLocal, 159000, NULL, N'Modal', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_ao_lot
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_ao_lot;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_ao_lot n
CROSS APPLY (VALUES (N'S', N'Trắng'), (N'M', N'Đen'), (N'L', N'Trắng'), (N'XL', N'Đen')) AS x(size, color);
GO

-- ===== Quần brief (quan-brief) — 5 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_quan_brief INT = (SELECT category_id FROM categories WHERE slug = N'quan-brief');
DECLARE @new_quan_brief TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_quan_brief(product_id, slug)
VALUES
(N'Quần brief cotton co giãn - Cotton', N'quan-brief-cotton-co-gian-cotton-01', N'Quần brief cotton co giãn - Cotton, màu đen, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_brief, @brandLocal, 89000, NULL, N'Cotton', N'ACTIVE'),
(N'Quần brief cotton co giãn - Cotton', N'quan-brief-cotton-co-gian-cotton-02', N'Quần brief cotton co giãn - Cotton, màu trắng, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_brief, @brandLocal, 99000, NULL, N'Cotton', N'ACTIVE'),
(N'Quần brief modal mềm mại - Thun lạnh', N'quan-brief-modal-mem-mai-thun-lanh-03', N'Quần brief modal mềm mại - Thun lạnh, màu xám, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu thun lạnh, form dáng chuẩn, dễ phối đồ.', @cat_quan_brief, @brandLocal, 119000, 98000, N'Thun lạnh', N'ACTIVE'),
(N'Quần brief basic trơn - Cotton', N'quan-brief-basic-tron-cotton-04', N'Quần brief basic trơn - Cotton, màu đen, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_quan_brief, @brandLocal, 129000, NULL, N'Cotton', N'ACTIVE'),
(N'Quần brief modal mềm mại - Modal', N'quan-brief-modal-mem-mai-modal-05', N'Quần brief modal mềm mại - Modal, màu đen, phù hợp mặc hằng ngày, thấm hút tốt. Chất liệu modal, form dáng chuẩn, dễ phối đồ.', @cat_quan_brief, @brandLocal, 149000, NULL, N'Modal', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_quan_brief
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_quan_brief;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_quan_brief n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Xám'), (N'L', N'Đen'), (N'XL', N'Xám')) AS x(size, color);
GO

-- ===== Bộ suit (bo-suit) — 13 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_bo_suit INT = (SELECT category_id FROM categories WHERE slug = N'bo-suit');
DECLARE @new_bo_suit TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_bo_suit(product_id, slug)
VALUES
(N'Bộ suit phối gile 3 món - Wool pha', N'bo-suit-phoi-gile-3-mon-wool-pha-01', N'Bộ suit phối gile 3 món - Wool pha, màu nâu rêu, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 1690000, NULL, N'Wool pha', N'ACTIVE'),
(N'Bộ suit slimfit dự tiệc - Polyester cao cấp', N'bo-suit-slimfit-du-tiec-polyester-cao-cap-02', N'Bộ suit slimfit dự tiệc - Polyester cao cấp, màu xanh navy, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 1890000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Bộ suit công sở 2 lớp lịch lãm - Wool pha', N'bo-suit-cong-so-2-lop-lich-lam-wool-pha-03', N'Bộ suit công sở 2 lớp lịch lãm - Wool pha, màu xanh navy, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 2090000, 1714000, N'Wool pha', N'ACTIVE'),
(N'Bộ suit vest cưới cao cấp - Kaki Âu cao cấp', N'bo-suit-vest-cuoi-cao-cap-kaki-au-cao-cap-04', N'Bộ suit vest cưới cao cấp - Kaki Âu cao cấp, màu xanh navy, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu kaki âu cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 2290000, NULL, N'Kaki Âu cao cấp', N'ACTIVE'),
(N'Bộ suit wool pha sang trọng - Polyester cao cấp', N'bo-suit-wool-pha-sang-trong-polyester-cao-cap-05', N'Bộ suit wool pha sang trọng - Polyester cao cấp, màu nâu rêu, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 2490000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Bộ suit vest dạ hội trang trọng - Polyester cao cấp', N'bo-suit-vest-da-hoi-trang-trong-polyester-cao-cap-06', N'Bộ suit vest dạ hội trang trọng - Polyester cao cấp, màu xám than, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 2790000, 2288000, N'Polyester cao cấp', N'ACTIVE'),
(N'Bộ suit form Hàn Quốc hiện đại - Wool pha', N'bo-suit-form-han-quoc-hien-dai-wool-pha-07', N'Bộ suit form Hàn Quốc hiện đại - Wool pha, màu nâu rêu, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 2990000, NULL, N'Wool pha', N'ACTIVE'),
(N'Bộ suit wool pha sang trọng - Tuyết mưa cao cấp', N'bo-suit-wool-pha-sang-trong-tuyet-mua-cao-cap-08', N'Bộ suit wool pha sang trọng - Tuyết mưa cao cấp, màu đen, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 3390000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Bộ suit wool pha sang trọng - Kaki Âu cao cấp', N'bo-suit-wool-pha-sang-trong-kaki-au-cao-cap-09', N'Bộ suit wool pha sang trọng - Kaki Âu cao cấp, màu xanh navy, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu kaki âu cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 3990000, 3272000, N'Kaki Âu cao cấp', N'ACTIVE'),
(N'Bộ suit slimfit dự tiệc - Wool pha', N'bo-suit-slimfit-du-tiec-wool-pha-10', N'Bộ suit slimfit dự tiệc - Wool pha, màu xám than, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 1490000, NULL, N'Wool pha', N'ACTIVE'),
(N'Bộ suit vest cưới cao cấp - Tuyết mưa cao cấp', N'bo-suit-vest-cuoi-cao-cap-tuyet-mua-cao-cap-11', N'Bộ suit vest cưới cao cấp - Tuyết mưa cao cấp, màu đen, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 1690000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE'),
(N'Bộ suit vest dạ hội trang trọng - Wool pha', N'bo-suit-vest-da-hoi-trang-trong-wool-pha-12', N'Bộ suit vest dạ hội trang trọng - Wool pha, màu xám than, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 1890000, 1550000, N'Wool pha', N'ACTIVE'),
(N'Bộ suit phối gile 3 món - Tuyết mưa cao cấp', N'bo-suit-phoi-gile-3-mon-tuyet-mua-cao-cap-13', N'Bộ suit phối gile 3 món - Tuyết mưa cao cấp, màu xám than, phù hợp cưới hỏi, dự tiệc, đi làm. Chất liệu tuyết mưa cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_bo_suit, @brandLocal, 2090000, NULL, N'Tuyết mưa cao cấp', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_bo_suit
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_bo_suit;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_bo_suit n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Xanh navy'), (N'L', N'Đen'), (N'XL', N'Xanh navy')) AS x(size, color);
GO

-- ===== Blazer (blazer) — 13 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_blazer INT = (SELECT category_id FROM categories WHERE slug = N'blazer');
DECLARE @new_blazer TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_blazer(product_id, slug)
VALUES
(N'Blazer basic một màu - Polyester cao cấp', N'blazer-basic-mot-mau-polyester-cao-cap-01', N'Blazer basic một màu - Polyester cao cấp, màu xám, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 990000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Blazer linen mùa hè thoáng mát - Polyester cao cấp', N'blazer-linen-mua-he-thoang-mat-polyester-cao-cap-02', N'Blazer linen mùa hè thoáng mát - Polyester cao cấp, màu be, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1090000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Blazer 2 hàng khuy sang trọng - Linen', N'blazer-2-hang-khuy-sang-trong-linen-03', N'Blazer 2 hàng khuy sang trọng - Linen, màu xanh navy, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1190000, 976000, N'Linen', N'ACTIVE'),
(N'Blazer unstructured mềm mại - Linen', N'blazer-unstructured-mem-mai-linen-04', N'Blazer unstructured mềm mại - Linen, màu be, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu linen, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1290000, NULL, N'Linen', N'ACTIVE'),
(N'Blazer basic một màu - Tuyết mưa', N'blazer-basic-mot-mau-tuyet-mua-05', N'Blazer basic một màu - Tuyết mưa, màu đen, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu tuyết mưa, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1450000, NULL, N'Tuyết mưa', N'ACTIVE'),
(N'Blazer unstructured mềm mại - Tuyết mưa', N'blazer-unstructured-mem-mai-tuyet-mua-06', N'Blazer unstructured mềm mại - Tuyết mưa, màu xanh navy, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu tuyết mưa, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1590000, 1304000, N'Tuyết mưa', N'ACTIVE'),
(N'Blazer 2 hàng khuy sang trọng - Polyester cao cấp', N'blazer-2-hang-khuy-sang-trong-polyester-cao-cap-07', N'Blazer 2 hàng khuy sang trọng - Polyester cao cấp, màu xanh navy, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1690000, NULL, N'Polyester cao cấp', N'ACTIVE'),
(N'Blazer 1 hàng khuy cổ điển - Tuyết mưa', N'blazer-1-hang-khuy-co-dien-tuyet-mua-08', N'Blazer 1 hàng khuy cổ điển - Tuyết mưa, màu đen, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu tuyết mưa, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1890000, NULL, N'Tuyết mưa', N'ACTIVE'),
(N'Blazer họa tiết caro lịch lãm - Polyester cao cấp', N'blazer-hoa-tiet-caro-lich-lam-polyester-cao-cap-09', N'Blazer họa tiết caro lịch lãm - Polyester cao cấp, màu xám, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1990000, 1632000, N'Polyester cao cấp', N'ACTIVE'),
(N'Blazer 1 hàng khuy cổ điển - Wool pha', N'blazer-1-hang-khuy-co-dien-wool-pha-10', N'Blazer 1 hàng khuy cổ điển - Wool pha, màu xanh navy, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 890000, NULL, N'Wool pha', N'ACTIVE'),
(N'Blazer basic một màu - Tuyết mưa', N'blazer-basic-mot-mau-tuyet-mua-11', N'Blazer basic một màu - Tuyết mưa, màu be, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu tuyết mưa, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 990000, NULL, N'Tuyết mưa', N'ACTIVE'),
(N'Blazer 2 hàng khuy sang trọng - Wool pha', N'blazer-2-hang-khuy-sang-trong-wool-pha-12', N'Blazer 2 hàng khuy sang trọng - Wool pha, màu xám, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu wool pha, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1090000, 894000, N'Wool pha', N'ACTIVE'),
(N'Blazer họa tiết caro lịch lãm - Polyester cao cấp', N'blazer-hoa-tiet-caro-lich-lam-polyester-cao-cap-13', N'Blazer họa tiết caro lịch lãm - Polyester cao cấp, màu đen, phù hợp đi làm, dự tiệc, sự kiện. Chất liệu polyester cao cấp, form dáng chuẩn, dễ phối đồ.', @cat_blazer, @brandLocal, 1190000, NULL, N'Polyester cao cấp', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_blazer
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_blazer;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_blazer n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Xanh navy'), (N'L', N'Đen'), (N'XL', N'Xanh navy')) AS x(size, color);
GO

-- ===== Đồ giữ nhiệt (do-giu-nhiet) — 5 sản phẩm (áo + quần giữ nhiệt) =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_do_giu_nhiet INT = (SELECT category_id FROM categories WHERE slug = N'do-giu-nhiet');
DECLARE @new_do_giu_nhiet TABLE (product_id BIGINT, slug NVARCHAR(220), kind NVARCHAR(10));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug, (CASE WHEN inserted.product_name LIKE N'Áo%' THEN N'top' ELSE N'bottom' END) INTO @new_do_giu_nhiet(product_id, slug, kind)
VALUES
(N'Áo giữ nhiệt cổ tròn tay dài - Thun nỉ giữ nhiệt', N'ao-giu-nhiet-co-tron-tay-dai-thun-ni-giu-nhiet-01', N'Áo giữ nhiệt cổ tròn tay dài - Thun nỉ giữ nhiệt, màu đen, giữ ấm hiệu quả mùa đông, chất liệu thun nỉ giữ nhiệt, form ôm vừa vặn.', @cat_do_giu_nhiet, @brandLocal, 149000, NULL, N'Thun nỉ giữ nhiệt', N'ACTIVE'),
(N'Áo giữ nhiệt cổ lọ ôm ấm - Polyester giữ nhiệt', N'ao-giu-nhiet-co-lo-om-am-polyester-giu-nhiet-02', N'Áo giữ nhiệt cổ lọ ôm ấm - Polyester giữ nhiệt, màu xám, giữ ấm hiệu quả mùa đông, chất liệu polyester giữ nhiệt, form ôm vừa vặn.', @cat_do_giu_nhiet, @brandLocal, 179000, NULL, N'Polyester giữ nhiệt', N'ACTIVE'),
(N'Quần giữ nhiệt ống dài - Thun nỉ giữ nhiệt', N'quan-giu-nhiet-ong-dai-thun-ni-giu-nhiet-03', N'Quần giữ nhiệt ống dài - Thun nỉ giữ nhiệt, màu đen, giữ ấm hiệu quả mùa đông, chất liệu thun nỉ giữ nhiệt, form ôm vừa vặn.', @cat_do_giu_nhiet, @brandLocal, 199000, NULL, N'Thun nỉ giữ nhiệt', N'ACTIVE'),
(N'Quần giữ nhiệt bó sát - Cotton pha nhiệt', N'quan-giu-nhiet-bo-sat-cotton-pha-nhiet-04', N'Quần giữ nhiệt bó sát - Cotton pha nhiệt, màu be, giữ ấm hiệu quả mùa đông, chất liệu cotton pha nhiệt, form ôm vừa vặn.', @cat_do_giu_nhiet, @brandLocal, 229000, NULL, N'Cotton pha nhiệt', N'ACTIVE'),
(N'Áo giữ nhiệt cổ tròn tay dài - Cotton pha nhiệt', N'ao-giu-nhiet-co-tron-tay-dai-cotton-pha-nhiet-05', N'Áo giữ nhiệt cổ tròn tay dài - Cotton pha nhiệt, màu be, giữ ấm hiệu quả mùa đông, chất liệu cotton pha nhiệt, form ôm vừa vặn.', @cat_do_giu_nhiet, @brandLocal, 259000, NULL, N'Cotton pha nhiệt', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_do_giu_nhiet;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_do_giu_nhiet n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Đen'), (N'L', N'Xám'), (N'XL', N'Xám')) AS x(size, color)
WHERE n.kind = N'top'
UNION ALL
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_do_giu_nhiet n
CROSS APPLY (VALUES (N'29', N'Đen'), (N'30', N'Đen'), (N'31', N'Xám'), (N'32', N'Xám')) AS x(size, color)
WHERE n.kind = N'bottom';
GO

-- ===== Bộ đồ (bo-do) — 15 sản phẩm =====
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');
DECLARE @cat_bo_do INT = (SELECT category_id FROM categories WHERE slug = N'bo-do');
DECLARE @new_bo_do TABLE (product_id BIGINT, slug NVARCHAR(220));

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
OUTPUT inserted.product_id, inserted.slug INTO @new_bo_do(product_id, slug)
VALUES
(N'Bộ đồ pyjama mặc nhà - Cotton', N'bo-do-pyjama-mac-nha-cotton-01', N'Bộ đồ pyjama mặc nhà - Cotton, màu xanh navy, phù hợp mặc nhà, tập luyện thể thao. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 399000, NULL, N'Cotton', N'ACTIVE'),
(N'Bộ đồ pyjama mặc nhà - Polyester gió', N'bo-do-pyjama-mac-nha-polyester-gio-02', N'Bộ đồ pyjama mặc nhà - Polyester gió, màu xanh navy, phù hợp mặc nhà, tập luyện thể thao. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 449000, NULL, N'Polyester gió', N'ACTIVE'),
(N'Bộ đồ pyjama mặc nhà - Cotton', N'bo-do-pyjama-mac-nha-cotton-03', N'Bộ đồ pyjama mặc nhà - Cotton, màu xám, phù hợp mặc nhà, tập luyện thể thao. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 499000, 409000, N'Cotton', N'ACTIVE'),
(N'Bộ đồ pyjama mặc nhà - Polyester gió', N'bo-do-pyjama-mac-nha-polyester-gio-04', N'Bộ đồ pyjama mặc nhà - Polyester gió, màu đen, phù hợp mặc nhà, tập luyện thể thao. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 549000, NULL, N'Polyester gió', N'ACTIVE'),
(N'Bộ đồ gió thể thao nhẹ - Cotton', N'bo-do-gio-the-thao-nhe-cotton-05', N'Bộ đồ gió thể thao nhẹ - Cotton, màu xám, phù hợp mặc nhà, tập luyện thể thao. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 599000, NULL, N'Cotton', N'ACTIVE'),
(N'Bộ đồ nỉ bo gấu ấm áp - Thun nỉ', N'bo-do-ni-bo-gau-am-ap-thun-ni-06', N'Bộ đồ nỉ bo gấu ấm áp - Thun nỉ, màu xanh navy, phù hợp mặc nhà, tập luyện thể thao. Chất liệu thun nỉ, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 649000, 532000, N'Thun nỉ', N'ACTIVE'),
(N'Bộ đồ basic mặc nhà thoải mái - Polyester gió', N'bo-do-basic-mac-nha-thoai-mai-polyester-gio-07', N'Bộ đồ basic mặc nhà thoải mái - Polyester gió, màu xanh navy, phù hợp mặc nhà, tập luyện thể thao. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 699000, NULL, N'Polyester gió', N'ACTIVE'),
(N'Bộ đồ thể thao 2 mảnh năng động - Polyester gió', N'bo-do-the-thao-2-manh-nang-dong-polyester-gio-08', N'Bộ đồ thể thao 2 mảnh năng động - Polyester gió, màu xám, phù hợp mặc nhà, tập luyện thể thao. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 349000, NULL, N'Polyester gió', N'ACTIVE'),
(N'Bộ đồ thể thao 2 mảnh năng động - Cotton', N'bo-do-the-thao-2-manh-nang-dong-cotton-09', N'Bộ đồ thể thao 2 mảnh năng động - Cotton, màu xám, phù hợp mặc nhà, tập luyện thể thao. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 399000, 327000, N'Cotton', N'ACTIVE'),
(N'Bộ đồ basic mặc nhà thoải mái - Cotton', N'bo-do-basic-mac-nha-thoai-mai-cotton-10', N'Bộ đồ basic mặc nhà thoải mái - Cotton, màu đen, phù hợp mặc nhà, tập luyện thể thao. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 449000, NULL, N'Cotton', N'ACTIVE'),
(N'Bộ đồ gió thể thao nhẹ - Polyester gió', N'bo-do-gio-the-thao-nhe-polyester-gio-11', N'Bộ đồ gió thể thao nhẹ - Polyester gió, màu xanh navy, phù hợp mặc nhà, tập luyện thể thao. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 499000, NULL, N'Polyester gió', N'ACTIVE'),
(N'Bộ đồ basic mặc nhà thoải mái - Polyester gió', N'bo-do-basic-mac-nha-thoai-mai-polyester-gio-12', N'Bộ đồ basic mặc nhà thoải mái - Polyester gió, màu xám, phù hợp mặc nhà, tập luyện thể thao. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 549000, 450000, N'Polyester gió', N'ACTIVE'),
(N'Bộ đồ pyjama mặc nhà - Cotton', N'bo-do-pyjama-mac-nha-cotton-13', N'Bộ đồ pyjama mặc nhà - Cotton, màu đen, phù hợp mặc nhà, tập luyện thể thao. Chất liệu cotton, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 599000, NULL, N'Cotton', N'ACTIVE'),
(N'Bộ đồ thể thao 2 mảnh năng động - Thun nỉ', N'bo-do-the-thao-2-manh-nang-dong-thun-ni-14', N'Bộ đồ thể thao 2 mảnh năng động - Thun nỉ, màu xám, phù hợp mặc nhà, tập luyện thể thao. Chất liệu thun nỉ, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 649000, NULL, N'Thun nỉ', N'ACTIVE'),
(N'Bộ đồ nỉ bo gấu ấm áp - Polyester gió', N'bo-do-ni-bo-gau-am-ap-polyester-gio-15', N'Bộ đồ nỉ bo gấu ấm áp - Polyester gió, màu đen, phù hợp mặc nhà, tập luyện thể thao. Chất liệu polyester gió, form dáng chuẩn, dễ phối đồ.', @cat_bo_do, @brandLocal, 699000, 573000, N'Polyester gió', N'ACTIVE');

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'/700/900', 1, 0 FROM @new_bo_do
UNION ALL
SELECT product_id, N'https://picsum.photos/seed/' + slug + N'-b/700/900', 0, 1 FROM @new_bo_do;

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT n.product_id, x.size, x.color, CONCAT('SKU-', n.product_id, '-', x.size), 20 + (ABS(CHECKSUM(NEWID())) % 80)
FROM @new_bo_do n
CROSS APPLY (VALUES (N'S', N'Đen'), (N'M', N'Xám'), (N'L', N'Đen'), (N'XL', N'Xám')) AS x(size, color);
GO


-- Voucher mẫu để test checkout ngay (khớp 2 mã đã cấu hình sẵn trong AdminVouchersPage demo)
INSERT INTO vouchers (code, discount_type, discount_value, min_order_value, max_discount_amount, usage_limit, is_active)
VALUES
(N'GIAM10', N'PERCENT', 10, 200000, 50000, 100, 1),
(N'GIAM50K', N'AMOUNT', 50000, 300000, NULL, 50, 1);
GO

-- =====================================================
-- Bổ sung: trạng thái trả hàng + BÁN TẠI QUẦY (POS) + PHÍ VẬN CHUYỂN
-- =====================================================

DECLARE @constraintName NVARCHAR(200);
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns col
    ON col.object_id = cc.parent_object_id AND col.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID('dbo.orders')
  AND col.name = 'status';

IF @constraintName IS NOT NULL
BEGIN
    DECLARE @dropSql NVARCHAR(400) = N'ALTER TABLE dbo.orders DROP CONSTRAINT ' + QUOTENAME(@constraintName);
    EXEC sp_executesql @dropSql;
END
GO

ALTER TABLE dbo.orders
    ADD CONSTRAINT CK_orders_status
    CHECK (status IN ('PENDING','CONFIRMED','SHIPPING','DELIVERED','COMPLETED','CANCELLED','RETURN_REQUESTED','RETURNED'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.orders') AND name = 'return_reason')
BEGIN
    ALTER TABLE dbo.orders ADD return_reason NVARCHAR(500) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.orders') AND name = 'order_type')
BEGIN
    ALTER TABLE dbo.orders ADD order_type NVARCHAR(10) NOT NULL DEFAULT 'ONLINE';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_orders_order_type')
BEGIN
    ALTER TABLE dbo.orders ADD CONSTRAINT CK_orders_order_type CHECK (order_type IN ('ONLINE','POS'));
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.orders') AND name = 'cashier_id')
BEGIN
    ALTER TABLE dbo.orders ADD cashier_id BIGINT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_orders_cashier')
BEGIN
    ALTER TABLE dbo.orders ADD CONSTRAINT FK_orders_cashier FOREIGN KEY (cashier_id) REFERENCES users(user_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.orders') AND name = 'shipping_fee')
BEGIN
    ALTER TABLE dbo.orders ADD shipping_fee DECIMAL(12,2) NOT NULL DEFAULT 0;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.orders') AND name = 'user_id' AND is_nullable = 0)
    ALTER TABLE dbo.orders ALTER COLUMN user_id BIGINT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.orders') AND name = 'receiver_name')
    ALTER TABLE dbo.orders ALTER COLUMN receiver_name NVARCHAR(100) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.orders') AND name = 'phone')
    ALTER TABLE dbo.orders ALTER COLUMN phone NVARCHAR(20) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.orders') AND name = 'shipping_address')
    ALTER TABLE dbo.orders ALTER COLUMN shipping_address NVARCHAR(500) NULL;
GO