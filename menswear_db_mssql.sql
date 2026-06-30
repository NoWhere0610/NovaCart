-- =====================================================
-- DATABASE: Website bán quần áo nam (JavaWeb + SQL + React)
-- DBMS: Microsoft SQL Server (T-SQL)
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
-- 5. GIỎ HÀNG (CART) - gợi ý thêm
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
-- 6. ĐƠN HÀNG (ORDER) - gợi ý thêm
-- =====================================================

CREATE TABLE orders (
    order_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    address_id      BIGINT NULL,
    order_code      NVARCHAR(50) UNIQUE,
    total_amount    DECIMAL(14,2) NOT NULL,
    status          NVARCHAR(20) DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','CONFIRMED','SHIPPING','COMPLETED','CANCELLED')),
    payment_method  NVARCHAR(20) DEFAULT 'COD'
                        CHECK (payment_method IN ('COD','BANK_TRANSFER','MOMO','VNPAY')),
    payment_status  NVARCHAR(20) DEFAULT 'UNPAID'
                        CHECK (payment_status IN ('UNPAID','PAID','REFUNDED')),
    note            NVARCHAR(255),
    created_at      DATETIME2 DEFAULT SYSDATETIME(),
    updated_at      DATETIME2 DEFAULT SYSDATETIME(),
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
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id)
);
GO

-- =====================================================
-- 7. ĐÁNH GIÁ SẢN PHẨM (REVIEW) - gợi ý thêm
-- =====================================================

CREATE TABLE reviews (
    review_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    product_id  BIGINT NOT NULL,
    user_id     BIGINT NOT NULL,
    rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     NVARCHAR(MAX),
    created_at  DATETIME2 DEFAULT SYSDATETIME(),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
GO

-- =====================================================
-- 8. MÃ GIẢM GIÁ (VOUCHER) - gợi ý thêm
-- =====================================================

CREATE TABLE vouchers (
    voucher_id      INT IDENTITY(1,1) PRIMARY KEY,
    code            NVARCHAR(50) UNIQUE NOT NULL,
    discount_type   NVARCHAR(10) NOT NULL CHECK (discount_type IN ('PERCENT','AMOUNT')),
    discount_value  DECIMAL(12,2) NOT NULL,
    min_order_value DECIMAL(12,2) DEFAULT 0,
    start_date      DATE,
    end_date        DATE,
    usage_limit     INT DEFAULT 0,
    is_active       BIT DEFAULT 1
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

-- Admin mặc định (password nên hash bằng BCrypt khi insert thật, đây chỉ là placeholder)
INSERT INTO users (username, password, email, full_name, is_active)
VALUES (N'admin', N'$2a$10$hashedpasswordplaceholder', N'admin@menswear.com', N'Quản trị viên', 1);
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
