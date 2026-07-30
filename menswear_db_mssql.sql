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

-- Danh mục mẫu
INSERT INTO categories (category_name, slug) VALUES
(N'Áo thun', N'ao-thun'),
(N'Áo sơ mi', N'ao-so-mi'),
(N'Quần jean', N'quan-jean'),
(N'Quần tây', N'quan-tay'),
(N'Áo khoác', N'ao-khoac');
GO

-- Thương hiệu mẫu
INSERT INTO brands (brand_name) VALUES (N'Local Brand'), (N'No Brand');
GO

-- Sản phẩm mẫu để trang chủ/giỏ hàng có dữ liệu test ngay (bản gốc không có
-- sản phẩm nào cả nên trang chủ sẽ trống trơn nếu không thêm phần này)
DECLARE @catAoThun INT = (SELECT category_id FROM categories WHERE slug = N'ao-thun');
DECLARE @catAoSoMi INT = (SELECT category_id FROM categories WHERE slug = N'ao-so-mi');
DECLARE @catQuanJean INT = (SELECT category_id FROM categories WHERE slug = N'quan-jean');
DECLARE @brandLocal INT = (SELECT brand_id FROM brands WHERE brand_name = N'Local Brand');

INSERT INTO products (product_name, slug, description, category_id, brand_id, price, sale_price, material, status)
VALUES
(N'Áo thun basic cotton', N'ao-thun-basic-cotton-001', N'Áo thun cotton 100%, form regular fit, thoáng mát.', @catAoThun, @brandLocal, 199000, 149000, N'Cotton 100%', N'ACTIVE'),
(N'Áo sơ mi trắng công sở', N'ao-so-mi-trang-cong-so-002', N'Sơ mi trắng vải Oxford, phù hợp đi làm/đi học.', @catAoSoMi, @brandLocal, 350000, NULL, N'Oxford', N'ACTIVE'),
(N'Quần jean slim fit', N'quan-jean-slim-fit-003', N'Quần jean xanh đậm, form slim fit trẻ trung.', @catQuanJean, @brandLocal, 450000, 399000, N'Denim', N'ACTIVE');
GO

INSERT INTO product_images (product_id, image_url, is_thumbnail, display_order)
SELECT product_id, N'https://picsum.photos/seed/' + CAST(product_id AS NVARCHAR) + N'/600/800', 1, 0
FROM products WHERE slug IN (N'ao-thun-basic-cotton-001', N'ao-so-mi-trang-cong-so-002', N'quan-jean-slim-fit-003');
GO

INSERT INTO product_variants (product_id, size, color, sku, stock_quantity)
SELECT product_id, size, color, CONCAT('SKU-', product_id, '-', size, '-', color), 50
FROM products
CROSS APPLY (VALUES ('S', N'Đen'), ('M', N'Đen'), ('L', N'Trắng')) AS v(size, color)
WHERE slug IN (N'ao-thun-basic-cotton-001', N'ao-so-mi-trang-cong-so-002', N'quan-jean-slim-fit-003');
GO

-- Voucher mẫu để test checkout ngay (khớp 2 mã đã cấu hình sẵn trong AdminVouchersPage demo)
INSERT INTO vouchers (code, discount_type, discount_value, min_order_value, max_discount_amount, usage_limit, is_active)
VALUES
(N'GIAM10', N'PERCENT', 10, 200000, 50000, 100, 1),
(N'GIAM50K', N'AMOUNT', 50000, 300000, NULL, 50, 1);
GO


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