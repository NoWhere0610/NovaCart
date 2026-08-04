import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IconChevronLeft, IconChevronRight, IconChevronDown, IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { apiClient } from '../api/apiClient'
import { useWishlist } from '../contexts/WishlistContext'
import { colorToHex } from '../utils/colorSwatches'
import BackButton from '../components/BackButton'
import Breadcrumb from '../components/Breadcrumb'

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
  totalPages: number
  currentPage: number
  totalElements: number
}

const PAGE_SIZE = 24

// Bộ size/màu chuẩn để chọn lọc — khớp với danh sách dùng ở ProductDetailPage (FULL_SIZES/FULL_COLORS),
// không tách file dùng chung riêng vì đây là hằng số tĩnh đơn giản, trùng lặp 1 chỗ không đáng kể.
const FILTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL']
const FILTER_COLORS = [
  'Đen', 'Trắng', 'Xám', 'Xanh Navy', 'Xanh Dương', 'Xanh Lá', 'Xanh Rêu',
  'Be', 'Nâu', 'Kem', 'Đỏ', 'Cam', 'Vàng', 'Hồng', 'Tím', 'Bạc',
]

// Mốc giá chọn nhanh -- đa số khách lọc theo khoảng chung chung, không cần gõ số chính xác. min/max để
// '' (rỗng) nghĩa là không giới hạn đầu đó (giống 2 ô nhập tay để trống).
const PRICE_PRESETS = [
  { label: 'Dưới 200k', min: '', max: '200000' },
  { label: '200k - 500k', min: '200000', max: '500000' },
  { label: '500k - 1 triệu', min: '500000', max: '1000000' },
  { label: 'Trên 1 triệu', min: '1000000', max: '' },
]

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categorySlug = searchParams.get('category') ?? ''
  const keyword = searchParams.get('keyword') ?? ''
  const minPriceParam = searchParams.get('minPrice') ?? ''
  const maxPriceParam = searchParams.get('maxPrice') ?? ''
  const sizeParam = searchParams.get('size') ?? ''
  const colorParam = searchParams.get('color') ?? ''
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0)
  const hasRefinementFilter = Boolean(minPriceParam || maxPriceParam || sizeParam || colorParam)
  const { isWishlisted, toggle: toggleWishlist } = useWishlist()
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!categoryDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [categoryDropdownOpen])

  // Cây danh mục 2 cấp như trả về từ API (nhóm cha + danh mục con)
  const [categoryTree, setCategoryTree] = useState<CategoryDto[]>([])
  // Làm phẳng cây (cha + con) để tra cứu theo slug và để tương thích với
  // các danh mục lá không có nhóm cha (VD: "Bộ đồ")
  const flatCategories: CategoryDto[] = categoryTree.flatMap((g) => [g, ...(g.children ?? [])])

  const [products, setProducts] = useState<ProductDto[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(true)

  // Input giá là state RIÊNG (không đọc/ghi thẳng URL mỗi phím gõ) -- chỉ đẩy vào URL (kéo theo gọi
  // API) khi bấm "Áp dụng", tránh spam request theo từng ký tự gõ. Đồng bộ lại từ URL khi filter đổi
  // từ nơi khác (vd bấm "Xoá lọc", back/forward trình duyệt).
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam)
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam)
  useEffect(() => {
    setMinPriceInput(minPriceParam)
    setMaxPriceInput(maxPriceParam)
  }, [minPriceParam, maxPriceParam])

  useEffect(() => {
    apiClient.get<CategoryDto[]>('/home/categories').then((res) => setCategoryTree(res.data))
  }, [])

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, keyword, minPriceParam, maxPriceParam, sizeParam, colorParam, categoryTree, page])

  async function loadProducts() {
    // Đợi danh mục load xong mới biết categorySlug ứng với categoryId nào -- gọi sớm hơn sẽ lọc sai
    // (coi như "Tất cả") trong khoảnh khắc categoryTree còn rỗng.
    if (categorySlug && flatCategories.length === 0) return
    setLoading(true)
    try {
      const cat = categorySlug ? flatCategories.find((c) => c.slug === categorySlug) : undefined
      const res = await apiClient.get<PageResponse<ProductDto>>('/home/products/filter', {
        params: {
          categoryId: cat?.categoryId,
          keyword: keyword || undefined,
          minPrice: minPriceParam || undefined,
          maxPrice: maxPriceParam || undefined,
          size: sizeParam || undefined,
          color: colorParam || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
      })
      setProducts(res.data.content)
      setTotalPages(res.data.totalPages)
      setTotalElements(res.data.totalElements)
    } catch {
      setProducts([])
      setTotalPages(0)
      setTotalElements(0)
    } finally {
      setLoading(false)
    }
  }

  // Cập nhật 1 phần bộ lọc, GIỮ NGUYÊN các phần còn lại đang có trên URL (trừ khi tự truyền đè) -- luôn
  // quay về trang 1 (không giữ page cũ, tránh lọc xong rơi vào trang trống).
  function updateFilters(changes: {
    category?: string
    keyword?: string
    minPrice?: string
    maxPrice?: string
    size?: string
    color?: string
  }) {
    const merged = {
      category: categorySlug,
      keyword,
      minPrice: minPriceParam,
      maxPrice: maxPriceParam,
      size: sizeParam,
      color: colorParam,
      ...changes,
    }
    const next: Record<string, string> = {}
    if (merged.category) next.category = merged.category
    if (merged.keyword) next.keyword = merged.keyword
    if (merged.minPrice) next.minPrice = merged.minPrice
    if (merged.maxPrice) next.maxPrice = merged.maxPrice
    if (merged.size) next.size = merged.size
    if (merged.color) next.color = merged.color
    setSearchParams(next)
  }

  function goToPage(p: number) {
    const next: Record<string, string> = {}
    if (categorySlug) next.category = categorySlug
    if (keyword) next.keyword = keyword
    if (minPriceParam) next.minPrice = minPriceParam
    if (maxPriceParam) next.maxPrice = maxPriceParam
    if (sizeParam) next.size = sizeParam
    if (colorParam) next.color = colorParam
    if (p > 0) next.page = String(p)
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const currentCategoryName = flatCategories.find((c) => c.slug === categorySlug)?.categoryName

  return (
    <div className="min-h-screen bg-stone-50 bg-herringbone px-4 py-10">
      <div className="max-w-[1600px] mx-auto">
        <BackButton />

        <Breadcrumb
          items={[
            { label: 'Trang chủ', to: '/' },
            currentCategoryName || keyword ? { label: 'Shop', to: '/shop' } : { label: 'Shop' },
            ...(currentCategoryName
              ? [{ label: currentCategoryName }]
              : keyword
                ? [{ label: `Kết quả cho "${keyword}"` }]
                : []),
          ]}
        />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-semibold text-stone-900">
              {keyword ? `Kết quả cho "${keyword}"` : currentCategoryName || 'Tất cả sản phẩm'}
            </h1>
            <p className="text-stone-500 text-sm mt-1">{totalElements} sản phẩm</p>
          </div>
        </div>

        <div className="flex gap-8">
          {/* sticky top-24 -- Header cũng sticky (h-20 + border ~ 81px), để hở 1 khoảng nhỏ bên dưới
              header khi sidebar "dính" lại lúc cuộn. max-h + overflow-y-auto phòng trường hợp màn hình
              thấp (laptop nhỏ) không đủ chỗ hiện hết bộ lọc mà vẫn giữ được vị trí dính. */}
          <aside className="w-56 flex-shrink-0 hidden md:block bg-white border border-stone-200 p-4 self-start sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <p className="text-xs font-semibold text-stone-500 uppercase mb-3">Danh mục</p>
            {/* Dropdown TỰ DỰNG thay vì <select> gốc -- hộp xổ ra của <select> do OS/trình duyệt vẽ,
                không style được màu tô khi hover/chọn (luôn ra xanh mặc định bất kể CSS), lệch hẳn khỏi
                theme đen-trắng-vàng. Tự dựng bằng button + panel như CategoryMegaMenu/dropdown Tài khoản
                ở Header thì kiểm soát được toàn bộ màu sắc.
                Đóng bằng click-ra-ngoài (xem useEffect bên dưới) thay vì onMouseLeave -- mở bằng CLICK
                thì đóng cũng nên theo click, không phụ thuộc hover: khoảng cách (mt-1) giữa nút và bảng
                dropdown là vùng KHÔNG thuộc phần tử nào, nếu đóng theo hover thì di chuột qua đúng
                khoảng đó (lúc chuyển từ nút xuống bảng) sẽ bị coi là "rời" và tự đóng mất. */}
            <div className="relative" ref={categoryDropdownRef}>
              <button
                type="button"
                onClick={() => setCategoryDropdownOpen((v) => !v)}
                aria-expanded={categoryDropdownOpen}
                className="w-full flex items-center justify-between border border-stone-300 px-3 py-2 text-sm bg-white hover:border-gold-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
              >
                <span className={currentCategoryName ? 'text-stone-900 font-medium' : 'text-stone-600'}>
                  {currentCategoryName || 'Tất cả'}
                </span>
                <IconChevronDown size={14} stroke={2} className="text-stone-400 shrink-0" />
              </button>

              {categoryDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-stone-200 shadow-xl max-h-96 overflow-y-auto py-1">
                  <button
                    type="button"
                    onClick={() => {
                      updateFilters({ category: '', keyword: '' })
                      setCategoryDropdownOpen(false)
                    }}
                    className={`block w-full text-left text-sm px-3 py-2 border-l-4 transition-colors ${
                      !categorySlug
                        ? 'border-gold bg-gold/10 text-stone-900 font-semibold'
                        : 'border-transparent text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Tất cả
                  </button>

                  {categoryTree.map((group) => (
                    <div key={group.categoryId}>
                      {group.children && group.children.length > 0 ? (
                        <>
                          {/* bg-stone-100 + font đậm hơn (bold) + padding riêng -- trước đây tiêu đề
                              nhóm chỉ là chữ xám nhạt, nhìn gần giống các mục bấm được bên dưới, dễ
                              nhầm là 1 lựa chọn. Thêm nền + border-b tách hẳn ra thành dải tiêu đề. */}
                          <p className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 mt-1 bg-stone-100 border-b border-stone-200 text-stone-600">
                            {group.categoryName}
                          </p>
                          {group.children.map((c) => (
                            <button
                              key={c.categoryId}
                              type="button"
                              onClick={() => {
                                updateFilters({ category: c.slug, keyword: '' })
                                setCategoryDropdownOpen(false)
                              }}
                              className={`block w-full text-left text-sm px-3 py-1.5 border-l-4 transition-colors ${
                                categorySlug === c.slug
                                  ? 'border-gold bg-gold/10 text-stone-900 font-semibold'
                                  : 'border-transparent text-stone-600 hover:bg-stone-100'
                              }`}
                            >
                              {c.categoryName}
                            </button>
                          ))}
                        </>
                      ) : (
                        // Nhóm KHÔNG có con (hiếm, danh mục gốc không phân cấp) -- vẫn phải chọn được,
                        // khớp hành vi mega-menu ở Header (CategoryMegaMenu.tsx).
                        <button
                          type="button"
                          onClick={() => {
                            updateFilters({ category: group.slug, keyword: '' })
                            setCategoryDropdownOpen(false)
                          }}
                          className={`block w-full text-left text-sm px-3 py-2 border-l-4 transition-colors ${
                            categorySlug === group.slug
                              ? 'border-gold bg-gold/10 text-stone-900 font-semibold'
                              : 'border-transparent text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          {group.categoryName}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-stone-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-stone-500 uppercase">Bộ lọc</p>
                {hasRefinementFilter && (
                  <button
                    onClick={() => updateFilters({ minPrice: '', maxPrice: '', size: '', color: '' })}
                    className="text-xs text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
                  >
                    Xoá lọc
                  </button>
                )}
              </div>

              <p className="text-xs text-stone-500 mb-1.5">Khoảng giá (đ)</p>

              {/* Chọn nhanh -- đa số khách không cần gõ tay, bấm 1 phát là xong. Vẫn giữ 2 ô nhập tay
                  bên dưới cho ai cần khoảng giá riêng không khớp mốc có sẵn. */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PRICE_PRESETS.map((preset) => {
                  const active = minPriceParam === preset.min && maxPriceParam === preset.max
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => updateFilters({ minPrice: preset.min, maxPrice: preset.max })}
                      className={`text-xs px-2.5 py-1 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark ${
                        active
                          ? 'border-gold bg-gold/10 text-stone-900 font-semibold'
                          : 'border-stone-300 text-stone-600 hover:border-gold-dark'
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 mb-2">
                {/* type="text" + inputMode="numeric" thay vì type="number" -- number input không nhận
                    được dấu chấm ngăn cách nghìn (100.000) mà chỉ nhận chuỗi số thuần, nên không tự
                    format hiển thị được. Đổi sang text tự parse/format tay còn được luôn 1 lợi ích phụ:
                    input text không có mũi tên tăng/giảm như number, khỏi cần CSS ẩn riêng. */}
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Từ"
                  value={minPriceInput ? Number(minPriceInput).toLocaleString('vi-VN') : ''}
                  onChange={(e) => setMinPriceInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full min-w-0 border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-gold"
                />
                <span className="text-stone-400 text-xs shrink-0">-</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Đến"
                  value={maxPriceInput ? Number(maxPriceInput).toLocaleString('vi-VN') : ''}
                  onChange={(e) => setMaxPriceInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full min-w-0 border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-gold"
                />
              </div>
              <button
                onClick={() => updateFilters({ minPrice: minPriceInput, maxPrice: maxPriceInput })}
                className="w-full border border-stone-300 hover:border-gold-dark text-stone-600 hover:text-gold-dark text-xs font-medium py-1.5 mb-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
              >
                Áp dụng giá
              </button>

              <p className="text-xs text-stone-500 mb-1.5">Size</p>
              <select
                value={sizeParam}
                onChange={(e) => updateFilters({ size: e.target.value })}
                className="w-full border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-gold bg-white mb-4"
              >
                <option value="">Tất cả size</option>
                {FILTER_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <p className="text-xs text-stone-500 mb-1.5">
                Màu sắc{colorParam ? `: ${colorParam}` : ''}
              </p>
              {/* Ô màu thật (swatch) thay vì <select> chỉ đọc tên -- bấm lại đúng màu đang chọn để bỏ lọc
                  màu đó (khớp hành vi "Tất cả" của select cũ khi chọn option rỗng). */}
              <div className="flex gap-2 flex-wrap">
                {FILTER_COLORS.map((c) => {
                  const selected = colorParam === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateFilters({ color: selected ? '' : c })}
                      title={c}
                      aria-label={c}
                      className={`w-7 h-7 rounded-full border border-stone-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark hover:scale-110 ${
                        selected ? 'ring-2 ring-offset-2 ring-stone-900' : ''
                      }`}
                      style={{ backgroundColor: colorToHex(c) }}
                    />
                  )
                })}
              </div>
            </div>
          </aside>

          <div className="flex-1">
            {/* loading && products.length === 0 (KHÔNG chỉ "loading") -- y hệt lỗi review trước đó: nếu
                cứ thấy loading là thay hẳn lưới bằng dòng "Đang tải..." thì MỖI LẦN đổi filter, lưới cũ
                (đang hiện tốt) bị giật xoá đi rồi mới hiện lưới mới, co-giãn y hệt bug submit đánh giá.
                Chỉ hiện "Đang tải..." lúc CHƯA có sản phẩm nào (lần đầu vào trang) -- các lần đổi filter
                sau, giữ nguyên lưới cũ hiển thị cho tới khi có dữ liệu mới, không có khoảng trống ở giữa. */}
            {loading && products.length === 0 ? (
              <p className="text-stone-500">Đang tải sản phẩm...</p>
            ) : products.length === 0 ? (
              <div className="bg-white border border-stone-200 p-10 text-center text-stone-500">
                Không tìm thấy sản phẩm nào phù hợp.
              </div>
            ) : (
              <>
                <div
                  key={`${categorySlug}-${keyword}-${minPriceParam}-${maxPriceParam}-${sizeParam}-${colorParam}-${page}`}
                  className="page-fade grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                  {products.map((p) => (
                    <Link key={p.productId} to={`/products/${p.productId}`} className="group block">
                      <div className="relative aspect-[3/4] bg-stone-200 overflow-hidden mb-3 shadow-sm group-hover:shadow-md transition-shadow">
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
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggleWishlist(p.productId)
                          }}
                          aria-label={isWishlisted(p.productId) ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 hover:bg-white text-red-600 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
                        >
                          {isWishlisted(p.productId) ? <IconHeartFilled size={16} /> : <IconHeart size={16} stroke={1.8} />}
                        </button>
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

                    {totalPages <= 7 ? (
                      Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => goToPage(i)}
                          className={`w-9 h-9 text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark ${
                            i === page
                              ? 'bg-stone-900 border-stone-900 text-white'
                              : 'border-stone-300 text-stone-600 hover:border-gold hover:text-gold-dark'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))
                    ) : (
                      <span className="text-sm text-stone-600 px-2">
                        Trang {page + 1} / {totalPages}
                      </span>
                    )}

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
      </div>
    </div>
  )
}
