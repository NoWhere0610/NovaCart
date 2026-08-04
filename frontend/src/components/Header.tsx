import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { IconShieldCog, IconPackage, IconUserCircle, IconShoppingBag, IconSearch, IconX, IconHeart } from '@tabler/icons-react'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { apiClient } from '../api/apiClient'
import CategoryMegaMenu, { type MegaMenuCategory } from './CategoryMegaMenu'
import { DEMO_CATEGORIES } from '../data/demoCategories'

// Class dùng chung cho MỌI nút chỉ có icon (không có chữ) — nền tròn mờ hiện khi hover + đổi màu
// icon sang gold, thay vì chỉ đổi màu chữ nhạt như trước (khó nhận ra đã hover hay chưa).
// focus-visible: các nút chỉ có icon KHÔNG có state hover thay thế khi điều hướng bằng bàn phím -- nếu
// không có ring riêng, người dùng Tab qua sẽ không thấy đang ở nút nào.
const ICON_BUTTON_CLASS =
  'p-2 -m-2 rounded-full text-stone-700 hover:text-gold-dark hover:bg-stone-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark'

/**
 * Header dùng chung cho MỌI trang (trừ login/register và khu vực admin).
 * Cố định về bố cục — chỉ nội dung bên dưới header mới thay đổi theo từng trang.
 *
 * Dùng CategoryMegaMenu (danh mục cha -> con, load từ API /home/categories,
 * fallback DEMO_CATEGORIES nếu API lỗi) thay vì dropdown phẳng cũ, để khớp
 * với phần "Danh mục sản phẩm" từng có riêng ở LandingPage — giờ chỉ còn
 * MỘT header duy nhất, tránh trùng lặp.
 */
export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { cartCount } = useCart()
  const isAdmin = user?.roles.includes('ADMIN') ?? false
  const [categories, setCategories] = useState<MegaMenuCategory[]>(DEMO_CATEGORIES)
  // Ô tìm kiếm chính bị "hidden sm:block" -- trên mobile (đa số traffic mua sắm online) khách KHÔNG có
  // cách nào tìm sản phẩm qua header. Thêm nút icon riêng cho mobile, bấm vào xổ ra 1 hàng tìm kiếm
  // full-width ngay dưới header thay vì nhồi thêm input cố định (không đủ chỗ cạnh mega-menu + các icon
  // khác trên màn hình hẹp).
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)
  // Ô tìm kiếm (desktop + mobile) dùng CHUNG 1 state -- không hiện cùng lúc (responsive ẩn/hiện theo
  // breakpoint) nên chia sẻ state không gây xung đột, đỡ phải đồng bộ 2 state riêng.
  const [searchValue, setSearchValue] = useState('')
  const [searchParams] = useSearchParams()
  // Chỉ true SAU KHI người dùng thật sự gõ vào ô (set trong onChange) -- searchValue rỗng lúc MỚI MOUNT
  // (chưa gõ gì) và searchValue rỗng SAU KHI người dùng tự xoá hết đều khiến searchValue === '' như
  // nhau, nhưng ý nghĩa khác hẳn: 1 cái là "chưa làm gì", 1 cái là "vừa xoá tìm kiếm, cần dọn keyword
  // khỏi URL". Không có cờ này, effect bên dưới sẽ xoá nhầm keyword có sẵn trên URL (vd khách bấm link
  // chia sẻ .../shop?keyword=X) ngay khi Header vừa mount, dù họ chưa đụng vào ô tìm kiếm.
  const hasTypedRef = useRef(false)

  // Tự tìm sau khi ngừng gõ (debounce 450ms) thay vì bắt buộc bấm Enter -- huỷ hẹn giờ cũ mỗi lần gõ
  // thêm ký tự (cleanup của useEffect), chỉ hẹn giờ MỚI chạy khi đã ngừng gõ đủ lâu.
  useEffect(() => {
    if (!hasTypedRef.current) return
    const timer = setTimeout(() => {
      const trimmed = searchValue.trim()
      if (trimmed) {
        navigate(`/shop?keyword=${encodeURIComponent(trimmed)}`)
      } else if (searchParams.get('keyword')) {
        // Ô tìm kiếm vừa bị xoá trắng TRONG LÚC url hiện tại đang có keyword (đang xem kết quả tìm
        // kiếm) -- dọn luôn keyword khỏi URL, không để trang đứng yên với kết quả tìm kiếm cũ.
        navigate('/shop')
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [searchValue, navigate, searchParams])

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    hasTypedRef.current = true
    setSearchValue(e.target.value)
  }

  function handleSearchEnter(e: KeyboardEvent<HTMLInputElement>) {
    // Enter vẫn tìm NGAY, không đợi debounce -- cho khách quen gõ xong bấm Enter luôn thay vì chờ.
    if (e.key === 'Enter' && searchValue.trim()) {
      navigate(`/shop?keyword=${encodeURIComponent(searchValue.trim())}`)
      setMobileSearchOpen(false)
    }
  }
  // "Đăng xuất" trước đây nằm rời ngoài nav dạng text link, dễ bấm nhầm và không theo pattern thường
  // gặp (gộp vào menu con của icon Tài khoản) -- gộp vào đây, các icon khác (Yêu thích/Đơn hàng/Giỏ
  // hàng) vẫn giữ nguyên rời như cũ theo đúng phạm vi đã thống nhất.
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  useEffect(() => {
    if (mobileSearchOpen) mobileSearchInputRef.current?.focus()
  }, [mobileSearchOpen])

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<MegaMenuCategory[]>('/home/categories')
      .then((res) => {
        if (!cancelled && res.data && res.data.length > 0) setCategories(res.data)
      })
      .catch(() => {
        /* giữ nguyên danh mục demo nếu API lỗi */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <header className="sticky top-0 z-40 bg-stone-50 border-b border-stone-200">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-6">
            {/* Danh mục sản phẩm — mega-menu 2 cấp: di chuột vào để xổ xuống
                các nhóm danh mục, rồi di chuột vào 1 nhóm để hiện bên cạnh
                các loại con thuộc nhóm đó. */}
            <CategoryMegaMenu
              categories={categories}
              onSelect={(c) => navigate(`/shop?category=${c.slug}`)}
            />

            <Link to="/" className="flex items-center gap-2">
              <span className="font-display text-2xl font-bold tracking-tight text-stone-900">NOVACART</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <input
              placeholder="Tìm sản phẩm..."
              value={searchValue}
              onChange={handleSearchChange}
              onKeyDown={handleSearchEnter}
              className="hidden sm:block w-48 border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-gold"
            />
            <button
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="Tìm sản phẩm"
              className={`sm:hidden ${ICON_BUTTON_CLASS}`}
            >
              <IconSearch size={20} stroke={1.7} />
            </button>
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden sm:flex items-center gap-1.5 bg-stone-900 border-gold-metallic gold-glow text-white text-xs font-semibold px-3 py-1.5"
              >
                <IconShieldCog size={16} stroke={1.9} />
                Quản trị
              </Link>
            )}
            <button onClick={() => navigate('/wishlist')} aria-label="Sản phẩm yêu thích" className={ICON_BUTTON_CLASS}>
              <IconHeart size={20} stroke={1.7} />
            </button>
            <button onClick={() => navigate('/orders')} aria-label="Đơn hàng của tôi" className={ICON_BUTTON_CLASS}>
              <IconPackage size={20} stroke={1.7} />
            </button>
            <div className="relative" onMouseLeave={() => setAccountMenuOpen(false)}>
              <button
                onClick={() => setAccountMenuOpen((v) => !v)}
                aria-label="Tài khoản"
                aria-expanded={accountMenuOpen}
                className={ICON_BUTTON_CLASS}
              >
                <IconUserCircle size={20} stroke={1.7} />
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-full pt-2 z-50">
                  <div className="w-40 bg-white border border-stone-200 shadow-xl py-1">
                    <Link
                      to="/account"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-gold-dark transition-colors"
                    >
                      Tài khoản
                    </Link>
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false)
                        logout()
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-gold-dark transition-colors"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => navigate('/cart')} aria-label="Giỏ hàng" className={`relative ${ICON_BUTTON_CLASS}`}>
              <IconShoppingBag size={20} stroke={1.7} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 font-semibold text-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="sm:hidden pb-3 flex items-center gap-2">
            <input
              ref={mobileSearchInputRef}
              placeholder="Tìm sản phẩm..."
              value={searchValue}
              onChange={handleSearchChange}
              onKeyDown={handleSearchEnter}
              className="flex-1 border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-gold"
            />
            <button
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Đóng tìm kiếm"
              className={ICON_BUTTON_CLASS}
            >
              <IconX size={18} stroke={1.7} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
