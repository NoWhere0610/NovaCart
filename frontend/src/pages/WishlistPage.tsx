import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IconChevronLeft, IconChevronRight, IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { getWishlistApi, type WishlistProductDto } from '../api/wishlistApi'
import { useWishlist } from '../contexts/WishlistContext'
import BackButton from '../components/BackButton'

const PAGE_SIZE = 24

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

export default function WishlistPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0)
  const { isWishlisted, toggle } = useWishlist()

  const [products, setProducts] = useState<WishlistProductDto[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await getWishlistApi(page, PAGE_SIZE)
      setProducts(res.content)
      setTotalPages(res.totalPages)
      setTotalElements(res.totalElements)
    } catch {
      setError('Không thể tải danh sách yêu thích. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  // Bỏ tim ngay tại trang này -> ẩn khỏi danh sách luôn (không cần đợi tải lại trang), vì
  // WishlistContext chỉ theo dõi trạng thái TOÀN CỤC, không tự động xoá khỏi mảng "products" cục bộ.
  function handleRemove(productId: number) {
    toggle(productId)
    setProducts((prev) => prev.filter((p) => p.productId !== productId))
    setTotalElements((prev) => Math.max(0, prev - 1))
  }

  function goToPage(p: number) {
    const next: Record<string, string> = {}
    if (p > 0) next.page = String(p)
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-[1600px] mx-auto">
        <BackButton />

        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-stone-900">Sản phẩm yêu thích</h1>
          <p className="text-stone-500 text-sm mt-1">{totalElements} sản phẩm</p>
        </div>

        {loading ? (
          <p className="text-stone-500">Đang tải...</p>
        ) : error ? (
          <div className="bg-white border border-stone-200 p-10 text-center">
            <p className="text-stone-700 mb-4">{error}</p>
            <button
              onClick={load}
              className="bg-stone-900 border-gold-metallic gold-glow text-white text-sm font-semibold px-6 py-2.5"
            >
              Thử lại
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-stone-200 p-10 text-center">
            <IconHeart size={40} stroke={1.3} className="mx-auto mb-3 text-stone-300" />
            <p className="text-stone-500 mb-4">Bạn chưa lưu sản phẩm nào.</p>
            <Link to="/shop" className="text-gold-dark font-medium underline">
              Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((p) => (
                <div key={p.productId} className="group relative">
                  <button
                    onClick={() => handleRemove(p.productId)}
                    aria-label="Bỏ khỏi yêu thích"
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 hover:bg-white text-red-600 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
                  >
                    {isWishlisted(p.productId) ? (
                      <IconHeartFilled size={18} />
                    ) : (
                      <IconHeart size={18} stroke={1.8} />
                    )}
                  </button>
                  <Link to={`/products/${p.productId}`} className="block">
                    <div className="aspect-[3/4] bg-stone-200 overflow-hidden mb-3 shadow-sm group-hover:shadow-md transition-shadow">
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt={p.productName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">
                          Chưa có ảnh
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-stone-900 font-medium">{p.productName}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      {p.salePrice ? (
                        <>
                          <span className="text-sm font-semibold text-red-600">{formatVnd(p.salePrice)}</span>
                          <span className="text-xs text-stone-400 line-through">{formatVnd(p.price)}</span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-stone-900">{formatVnd(p.price)}</span>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 0}
                  aria-label="Trang trước"
                  className="p-2 border border-stone-300 text-stone-600 hover:border-gold hover:text-gold-dark disabled:opacity-30 disabled:hover:border-stone-300 disabled:hover:text-stone-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
                >
                  <IconChevronLeft size={16} stroke={2} />
                </button>
                <span className="text-sm text-stone-600 px-2">
                  Trang {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  aria-label="Trang sau"
                  className="p-2 border border-stone-300 text-stone-600 hover:border-gold hover:text-gold-dark disabled:opacity-30 disabled:hover:border-stone-300 disabled:hover:text-stone-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
                >
                  <IconChevronRight size={16} stroke={2} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
