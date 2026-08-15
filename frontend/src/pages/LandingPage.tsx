import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { apiClient } from '../api/apiClient'
import { useWishlist } from '../contexts/WishlistContext'
import { getRecentlyViewedIds } from '../utils/recentlyViewed'

// 3 ảnh Pexels luân phiên tự động ở nửa phải Hero.
const HERO_IMAGES = [
  'https://images.pexels.com/photos/8052262/pexels-photo-8052262.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/2897883/pexels-photo-2897883.jpeg?auto=compress&cs=tinysrgb&w=1200',
]
const HERO_IMAGE_INTERVAL_MS = 5000

interface CategoryDto {
  categoryId: number
  categoryName: string
  slug: string
  imageUrl?: string | null
  children?: CategoryDto[]
}

interface ProductDto {
  productId: number
  productName: string
  slug: string
  price: number
  salePrice: number | null
  thumbnailUrl: string | null
  categoryName: string | null
  brandName: string | null
}

interface PageResponse<T> {
  content: T[]
}

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

function ProductCard({ product, dark = false }: { product: ProductDto; dark?: boolean }) {
  const onSale = product.salePrice != null
  const { isWishlisted, toggle } = useWishlist()
  const wishlisted = isWishlisted(product.productId)
  return (
    <Link to={`/products/${product.productId}`} className="group block">
      <div className="relative aspect-[3/4] bg-stone-200 overflow-hidden mb-3 shadow-sm group-hover:shadow-md transition-shadow">
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt={product.productName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">Chưa có ảnh</div>
        )}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggle(product.productId)
          }}
          aria-label={wishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 hover:bg-white text-red-600 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
        >
          {wishlisted ? <IconHeartFilled size={16} /> : <IconHeart size={16} stroke={1.8} />}
        </button>
      </div>
      <p className={`text-[11px] uppercase tracking-widest mb-1 ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
        {/* "No Brand" là giá trị thật trong DB -- coi tương đương "chưa có brand", không hiện nguyên văn. */}
        {product.brandName && product.brandName !== 'No Brand' ? product.brandName : product.categoryName}
      </p>
      <p className={`text-sm font-medium ${dark ? 'text-stone-50' : 'text-stone-900'}`}>{product.productName}</p>
      <div className="flex items-baseline gap-2 mt-1">
        {onSale ? (
          <>
            <span className="text-sm font-semibold text-red-600">{formatVnd(product.salePrice!)}</span>
            <span className="text-xs text-stone-400 line-through">{formatVnd(product.price)}</span>
          </>
        ) : (
          <span className={`text-sm font-semibold ${dark ? 'text-stone-50' : 'text-stone-900'}`}>
            {formatVnd(product.price)}
          </span>
        )}
      </div>
    </Link>
  )
}

function SectionHeading({
  eyebrow,
  title,
  dark = false,
  action,
}: {
  eyebrow: string
  title: string
  dark?: boolean
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div>
        <p className={`text-[11px] uppercase tracking-[0.25em] ${dark ? 'text-gold' : 'text-gold-dark'}`}>{eyebrow}</p>
        <h2 className={`font-display text-2xl md:text-3xl font-semibold tracking-tight ${dark ? 'text-stone-50' : 'text-stone-900'}`}>
          {title}
        </h2>
      </div>
      <div className={`flex-1 h-px ml-2 ${dark ? 'bg-stone-700' : 'bg-stone-300'}`} />
      {action && (
        <button onClick={action.onClick} className="text-xs text-stone-500 hover:text-gold-dark underline shrink-0">
          {action.label}
        </button>
      )}
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [newest, setNewest] = useState<ProductDto[]>([])
  const [sale, setSale] = useState<ProductDto[]>([])
  const [recentlyViewed, setRecentlyViewed] = useState<ProductDto[]>([])
  const [heroImageIndex, setHeroImageIndex] = useState(0)
  // true nếu bất kỳ API nào trong 3 API trang chủ lỗi -- báo trang có thể thiếu nội dung do lỗi tải.
  const [homeDataError, setHomeDataError] = useState(false)

  // /home/categories trả về danh mục cha, không có ảnh riêng (ảnh gắn ở danh mục lá) -- làm phẳng ra lá để có ảnh, giới hạn 10 mục.
  const displayCategories = categories
    .flatMap((c) => (c.children && c.children.length > 0 ? c.children : [c]))
    .slice(0, 10)

  function loadHomeData() {
    setHomeDataError(false)
    apiClient
      .get<CategoryDto[]>('/home/categories')
      .then((res) => setCategories(res.data))
      .catch(() => setHomeDataError(true))
    apiClient
      .get<PageResponse<ProductDto>>('/home/products/newest', { params: { page: 0, size: 10 } })
      .then((res) => setNewest(res.data.content))
      .catch(() => setHomeDataError(true))
    apiClient
      .get<PageResponse<ProductDto>>('/home/products/sale', { params: { page: 0, size: 4 } })
      .then((res) => setSale(res.data.content))
      .catch(() => setHomeDataError(true))
  }

  useEffect(() => {
    loadHomeData()

    // "Đã xem gần đây" -- lỗi ở đây không tính vào homeDataError, chỉ là nội dung phụ.
    const recentIds = getRecentlyViewedIds()
    if (recentIds.length > 0) {
      apiClient
        .get<ProductDto[]>('/home/products/by-ids', { params: { ids: recentIds.join(',') } })
        .then((res) => setRecentlyViewed(res.data))
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroImageIndex((i) => (i + 1) % HERO_IMAGES.length)
    }, HERO_IMAGE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div>
      {/* Header/danh mục sản phẩm dùng chung qua Header.tsx (Layout) — không lặp lại ở đây. */}
      <section className="grid grid-cols-1 md:grid-cols-2 bg-stone-900 min-h-150 md:min-h-170">
        <div className="relative flex flex-col justify-center px-8 md:px-16 py-16 text-stone-50">
          {/* Khung ánh kim inset, 4 góc kẻ vượt ra ngoài để "cắt nhau" thay vì khép vuông gọn. */}
          <div className="absolute inset-6 md:inset-10 pointer-events-none opacity-40">
            <span className="absolute -left-3 -right-3 top-0 h-px gold-metallic-h" />
            <span className="absolute -left-3 -right-3 bottom-0 h-px gold-metallic-h" />
            <span className="absolute -top-3 -bottom-3 left-0 w-px gold-metallic-v" />
            <span className="absolute -top-3 -bottom-3 right-0 w-px gold-metallic-v" />
          </div>
          <p className="text-gold text-xs font-semibold tracking-widest uppercase mb-4">Bộ sưu tập mới</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-6">
            Phong cách
            <br />
            chuẩn form
            <br />
            mỗi ngày.
          </h1>
          <p className="text-stone-300 max-w-md mb-8">
            Trang phục nam tối giản, chất liệu bền và form dáng chuẩn — từ áo sơ mi công sở đến
            streetwear hằng ngày.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/shop')}
              className="bg-stone-900 border-gold-metallic gold-glow text-white text-sm font-semibold px-6 py-3"
            >
              Mua ngay
            </button>
            <button
              onClick={() => navigate('/categories')}
              className="border border-stone-400 hover:border-gold-metallic transition-colors text-stone-50 text-sm font-semibold px-6 py-3"
            >
              Xem danh mục
            </button>
          </div>
        </div>

        <div className="relative hidden md:block overflow-hidden">
          {HERO_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt="Phong cách thời trang nam NovaCart"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                i === heroImageIndex ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-stone-900/40" />
        </div>
      </section>

      {homeDataError && (
        <div className="max-w-[1600px] mx-auto px-6 pt-6">
          <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 text-sm text-red-700 px-4 py-3">
            <span>Một số nội dung trang chủ chưa tải được. Trang có thể đang thiếu danh mục/sản phẩm.</span>
            <button onClick={loadHomeData} className="font-medium underline whitespace-nowrap">
              Thử lại
            </button>
          </div>
        </div>
      )}

      {displayCategories.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-6 py-16">
          <SectionHeading
            eyebrow="Bắt đầu từ đây"
            title="Danh mục sản phẩm"
            action={{ label: 'Xem tất cả danh mục', onClick: () => navigate('/categories') }}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {displayCategories.map((c) => (
              <button
                key={c.categoryId}
                onClick={() => navigate(`/shop?category=${c.slug}`)}
                className="group relative aspect-[4/5] overflow-hidden bg-stone-200 text-left shadow-sm hover:shadow-lg transition-shadow"
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.categoryName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-stone-200" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-gold-metallic transition-colors" />
                <span className="absolute bottom-3 left-3 right-3 text-white font-display text-sm font-semibold">
                  {c.categoryName}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* bg-cream xen kẽ nền trắng các section trên/dưới, tạo nhịp khi cuộn mà không đổi màu chữ. */}
      {newest.length > 0 && (
        <section className="bg-cream border-t border-stone-200">
          <div className="max-w-[1600px] mx-auto px-6 py-16">
            <SectionHeading eyebrow="Vừa lên kệ" title="Sản phẩm mới nhất" />
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
              {newest.map((p) => (
                <ProductCard key={p.productId} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Banner lifestyle -- khoảng thở giữa 2 lưới sản phẩm liên tiếp. */}
      {newest.length > 0 && recentlyViewed.length > 0 && (
        <section className="relative h-80 md:h-105 overflow-hidden">
          <img
            src="https://images.pexels.com/photos/6326369/pexels-photo-6326369.jpeg?auto=compress&cs=tinysrgb&w=1600"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-stone-900/80 via-stone-900/15 to-transparent" />
          <div className="relative h-full max-w-[1600px] mx-auto px-6 flex items-end pb-10">
            <div>
              <p className="text-gold text-xs font-semibold tracking-widest uppercase mb-2">Phong cách mỗi ngày</p>
              <h2 className="font-display text-2xl md:text-3xl font-semibold text-stone-50 max-w-md">
                Chọn đúng món đồ, tự tin mọi lúc.
              </h2>
            </div>
          </div>
        </section>
      )}

      {recentlyViewed.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-6 py-16 border-t border-stone-200">
          <SectionHeading eyebrow="Tiếp tục xem" title="Đã xem gần đây" />
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
            {recentlyViewed.map((p) => (
              <ProductCard key={p.productId} product={p} />
            ))}
          </div>
        </section>
      )}

      {sale.length > 0 && (
        <section className="py-16 bg-stone-900">
          <div className="max-w-[1600px] mx-auto px-6">
            <SectionHeading eyebrow="Số lượng có hạn" title="Đang giảm giá" dark />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
              {sale.map((p) => (
                <ProductCard key={p.productId} product={p} dark />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
