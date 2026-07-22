import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getMyCartApi } from "./api/cartApi";
import { useAuth } from "./contexts/AuthContext";

const API_BASE = "http://localhost:8080/api/home";

interface Category {
  categoryId: number;
  categoryName: string;
  slug: string;
}

interface ProductDto {
  productId: number;
  productName: string;
  slug: string;
  price: number;
  salePrice: number | null;
  thumbnailUrl: string | null;
  categoryName: string | null;
  brandName: string | null;
}

interface PageResponse<T> {
  content: T[];
  currentPage: number;
  totalPages: number;
  totalElements: number;
  last: boolean;
}

const formatVND = (n: number | null | undefined): string =>
  n == null
    ? ""
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(n);

const DEMO_CATEGORIES: Category[] = [
  { categoryId: 1, categoryName: "Áo thun", slug: "ao-thun" },
  { categoryId: 2, categoryName: "Áo sơ mi", slug: "ao-so-mi" },
  { categoryId: 3, categoryName: "Quần jean", slug: "quan-jean" },
  { categoryId: 4, categoryName: "Quần tây", slug: "quan-tay" },
  { categoryId: 5, categoryName: "Áo khoác", slug: "ao-khoac" },
];

const demoProduct = (
  id: number,
  name: string,
  price: number,
  sale: number | null,
): ProductDto => ({
  productId: id,
  productName: name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  price,
  salePrice: sale,
  thumbnailUrl: null,
  categoryName: "Áo thun",
  brandName: "Local Brand",
});

const DEMO_NEWEST: ProductDto[] = [
  demoProduct(1, "Áo thun cotton basic", 259000, null),
  demoProduct(2, "Sơ mi linen form rộng", 459000, 369000),
  demoProduct(3, "Quần jean slimfit", 549000, null),
  demoProduct(4, "Áo khoác bomber", 699000, 599000),
  demoProduct(5, "Quần tây ống suông", 489000, null),
  demoProduct(6, "Áo polo pique", 329000, null),
  demoProduct(7, "Áo thun in họa tiết", 279000, 229000),
  demoProduct(8, "Sơ mi caro flannel", 399000, null),
];

const DEMO_SALE: ProductDto[] = DEMO_NEWEST.filter((p) => p.salePrice != null);

interface HomeData {
  categories: Category[];
  newest: ProductDto[];
  sale: ProductDto[];
  loading: boolean;
  usingDemo: boolean;
}

function useHomeData(): HomeData {
  const [categories, setCategories] = useState<Category[]>(DEMO_CATEGORIES);
  const [newest, setNewest] = useState<ProductDto[]>(DEMO_NEWEST);
  const [sale, setSale] = useState<ProductDto[]>(DEMO_SALE);
  const [loading, setLoading] = useState<boolean>(true);
  const [usingDemo, setUsingDemo] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [catRes, newRes, saleRes] = await Promise.all([
          fetch(`${API_BASE}/categories`),
          fetch(`${API_BASE}/products/newest?page=0&size=8`),
          fetch(`${API_BASE}/products/sale?page=0&size=4`),
        ]);
        if (!catRes.ok || !newRes.ok || !saleRes.ok)
          throw new Error("API error");

        const cat: Category[] = await catRes.json();
        const newP: PageResponse<ProductDto> = await newRes.json();
        const saleP: PageResponse<ProductDto> = await saleRes.json();

        if (!cancelled) {
          setCategories(cat);
          setNewest(newP.content);
          setSale(saleP.content);
          setUsingDemo(false);
        }
      } catch {
        if (!cancelled) setUsingDemo(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, newest, sale, loading, usingDemo };
}

function TapeNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-stone-900 text-xs font-semibold tracking-wide">
      {String(n).padStart(2, "0")}
    </span>
  );
}

function ProductCard({ product }: { product: ProductDto }) {
  const onSale = product.salePrice != null;
  return (
    <Link to={`/products/${product.productId}`} className="group block">
      <div className="relative aspect-3/4 bg-stone-200 overflow-hidden">
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt={product.productName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
            Chưa có ảnh
          </div>
        )}
        {onSale && (
          <span className="absolute top-3 left-3 bg-orange-700 text-stone-50 text-[11px] font-semibold tracking-wide px-2 py-1">
            SALE
          </span>
        )}
      </div>
      <div className="pt-3 pb-1">
        <p className="text-[11px] uppercase tracking-widest text-stone-500 mb-1">
          {product.brandName || product.categoryName}
        </p>
        <h3 className="text-sm font-medium text-stone-900 leading-snug line-clamp-2">
          {product.productName}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2">
          {onSale ? (
            <>
              <span className="text-sm font-semibold text-orange-700">
                {formatVND(product.salePrice)}
              </span>
              <span className="text-xs text-stone-400 line-through">
                {formatVND(product.price)}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-stone-900">
              {formatVND(product.price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function SectionHeading({
  index,
  eyebrow,
  title,
}: {
  index: number;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <TapeNumber n={index} />
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          {eyebrow}
        </p>
        <h2 className="text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight">
          {title}
        </h2>
      </div>
      <div className="flex-1 h-px bg-stone-300 ml-2" />
    </div>
  );
}

function TopBar() {
  return (
    <div className="bg-stone-900 text-stone-300 text-xs">
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
        <span>Miễn phí vận chuyển cho đơn từ 500.000đ</span>
        <span className="hidden sm:inline">Hotline: 1900 0000</span>
      </div>
    </div>
  );
}

function Header({
  categories,
  onSearch,
}: {
  categories: Category[];
  onSearch: (keyword: string) => void;
}) {
  const [keyword, setKeyword] = useState<string>("");
  const [cartCount, setCartCount] = useState(0);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setCartCount(0);
      return;
    }

    getMyCartApi()
      .then((cart) => setCartCount(cart.totalQuantity))
      .catch(() => setCartCount(0));
  }, [isAuthenticated]);

  return (
    <header className="bg-stone-50 border-b border-stone-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          <a href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-stone-900">
              MENSWEAR
            </span>
            <span className="hidden sm:block text-[10px] tracking-[0.3em] text-stone-500 self-end pb-1">
              FOR HIM
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-stone-700">
            {categories.slice(0, 6).map((c) => (
              <a
                key={c.categoryId}
                href={`/category/${c.slug}`}
                className="hover:text-orange-700 transition-colors"
              >
                {c.categoryName}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearch(keyword);
              }}
              className="hidden md:flex items-center border border-stone-300 px-3 h-10 w-56"
            >
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm sản phẩm..."
                className="w-full bg-transparent outline-none text-sm text-stone-800 placeholder-stone-400"
              />
              <button
                type="submit"
                aria-label="Tìm kiếm"
                className="text-stone-500 hover:text-stone-900"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            </form>

            <button
              aria-label="Tài khoản"
              onClick={() => navigate(isAuthenticated ? "/account" : "/login")}
              className="text-stone-700 hover:text-stone-900"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
              </svg>
            </button>
            <button
              aria-label="Giỏ hàng"
              onClick={() => navigate(isAuthenticated ? "/cart" : "/login")}
              className="relative text-stone-700 hover:text-stone-900"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M6 7h12l-1 13H7L6 7z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </svg>
              {isAuthenticated && cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-700 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-stone-900 text-stone-50">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center py-16 md:py-24">
        <div>
          <p className="text-[11px] tracking-[0.3em] text-orange-400 mb-4">
            BỘ SƯU TẬP MỚI
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
            May đo
            <br />
            phong cách
            <br />
            của riêng bạn.
          </h1>
          <p className="text-stone-400 text-sm md:text-base max-w-md mb-8">
            Trang phục nam tối giản, chất liệu bền và form dáng chuẩn — từ áo sơ
            mi công sở đến streetwear hằng ngày.
          </p>
          <div className="flex gap-3">
            <a
              href="#newest"
              className="bg-orange-700 hover:bg-orange-600 transition-colors text-stone-50 text-sm font-semibold px-6 py-3"
            >
              Mua ngay
            </a>
            <a
              href="#categories"
              className="border border-stone-600 hover:border-stone-400 transition-colors text-sm font-semibold px-6 py-3"
            >
              Xem danh mục
            </a>
          </div>
        </div>

        <div className="relative aspect-4/5 bg-stone-800 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-between p-6 text-stone-500 text-[10px] tracking-widest">
            <span>S</span>
            <span>M</span>
            <span>L</span>
            <span>XL</span>
          </div>
          <span className="text-stone-600 text-sm">
            [ Ảnh sản phẩm nổi bật ]
          </span>
        </div>
      </div>
    </section>
  );
}

function CategoryStrip({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (category: Category) => void;
}) {
  return (
    <section id="categories" className="bg-stone-50 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeading
          index={1}
          eyebrow="Bắt đầu từ đây"
          title="Loại quần áo"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((c) => (
            <button
              key={c.categoryId}
              onClick={() => onSelect(c)}
              className="group border border-stone-300 hover:border-stone-900 transition-colors px-4 py-8 text-left"
            >
              <p className="text-sm font-semibold text-stone-900 mb-1">
                {c.categoryName}
              </p>
              <span className="text-xs text-stone-500 group-hover:text-orange-700 inline-flex items-center gap-1">
                Xem ngay
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function NewestProducts({ products }: { products: ProductDto[] }) {
  return (
    <section id="newest" className="py-16 border-t border-stone-200">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeading
          index={2}
          eyebrow="Vừa lên kệ"
          title="Sản phẩm mới nhất"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
          {products.map((p) => (
            <ProductCard key={p.productId} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SaleBanner({ products }: { products: ProductDto[] }) {
  if (!products || products.length === 0) return null;
  return (
    <section className="py-16 bg-stone-900 text-stone-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-8">
          <TapeNumber n={3} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-orange-400">
              Số lượng có hạn
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Đang giảm giá
            </h2>
          </div>
          <div className="flex-1 h-px bg-stone-700 ml-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
          {products.map((p) => (
            <div
              key={p.productId}
              className="[&_h3]:text-stone-50 [&_p]:text-stone-400"
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter() {
  return (
    <section className="py-16 bg-stone-50 border-t border-stone-200">
      <div className="mx-auto px-6 text-center max-w-xl">
        <h2 className="text-2xl font-semibold text-stone-900 mb-2">
          Nhận ưu đãi sớm nhất
        </h2>
        <p className="text-sm text-stone-500 mb-6">
          Đăng ký email để nhận thông tin bộ sưu tập mới và mã giảm giá.
        </p>
        <form className="flex max-w-md mx-auto border border-stone-300">
          <input
            type="email"
            placeholder="email@cuaban.com"
            className="flex-1 px-4 py-3 text-sm outline-none bg-transparent text-stone-800 placeholder-stone-400"
          />
          <button
            type="submit"
            className="bg-stone-900 text-stone-50 text-sm font-semibold px-6"
          >
            Đăng ký
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-400 py-12">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8 text-sm">
        <div>
          <p className="text-stone-50 font-bold text-lg mb-3">MENSWEAR</p>
          <p>Thời trang nam tối giản, chất liệu bền cho mọi ngày.</p>
        </div>
        <div>
          <p className="text-stone-200 font-semibold mb-3">Hỗ trợ</p>
          <ul className="space-y-2">
            <li>Hướng dẫn chọn size</li>
            <li>Chính sách đổi trả</li>
            <li>Vận chuyển</li>
          </ul>
        </div>
        <div>
          <p className="text-stone-200 font-semibold mb-3">Về chúng tôi</p>
          <ul className="space-y-2">
            <li>Câu chuyện thương hiệu</li>
            <li>Cửa hàng</li>
            <li>Tuyển dụng</li>
          </ul>
        </div>
        <div>
          <p className="text-stone-200 font-semibold mb-3">Liên hệ</p>
          <p>1900 0000</p>
          <p>support@menswear.com</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-10 pt-6 border-t border-stone-800 text-xs">
        © {new Date().getFullYear()} Menswear. Đồ án tốt nghiệp.
      </div>
    </footer>
  );
}

export default function HomePage() {
  const { categories, newest, sale, loading, usingDemo } = useHomeData();

  const handleSearch = useCallback((keyword: string) => {
    if (!keyword.trim()) return;
    window.location.href = `/search?keyword=${encodeURIComponent(keyword)}`;
  }, []);

  const handleSelectCategory = useCallback((category: Category) => {
    window.location.href = `/category/${category.slug}`;
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {usingDemo && !loading && (
        <div className="bg-orange-100 text-orange-800 text-xs text-center py-2 px-4">
          Đang hiển thị dữ liệu mẫu — không kết nối được API tại {API_BASE}
        </div>
      )}
      <TopBar />
      <Header categories={categories} onSearch={handleSearch} />
      <Hero />
      <CategoryStrip categories={categories} onSelect={handleSelectCategory} />
      <NewestProducts products={newest} />
      <SaleBanner products={sale} />
      <Newsletter />
      <Footer />
    </div>
  );
}
