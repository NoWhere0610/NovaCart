import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { IconShieldCog, IconPackage, IconUserCircle, IconShoppingBag, IconSearch, IconX, IconHeart } from '@tabler/icons-react'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { apiClient } from '../api/apiClient'
import CategoryMegaMenu, { type MegaMenuCategory } from './CategoryMegaMenu'
import { DEMO_CATEGORIES } from '../data/demoCategories'

// Class dùng chung cho mọi nút chỉ có icon.
// focus-visible: cần ring riêng để nhận biết khi điều hướng bằng bàn phím (Tab).
const ICON_BUTTON_CLASS =
  'p-2 -m-2 rounded-full text-stone-700 hover:text-gold-dark hover:bg-stone-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark'

/**
 * Header dùng chung cho mọi trang (trừ login/register và khu vực admin).
 * CategoryMegaMenu load danh mục từ API /home/categories, fallback DEMO_CATEGORIES nếu lỗi.
 */
export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { cartCount } = useCart()
  const isAdmin = user?.roles.includes('ADMIN') ?? false
  // Nút vào trang quản trị: cả ADMIN lẫn STAFF -- quyền THẬT theo từng trang/hành động cụ thể
  // do backend (ma trận role_permission) quyết định, ở đây chỉ quyết có cho vào khu vực /admin không.
  const canAccessAdmin = isAdmin || (user?.roles.includes('STAFF') ?? false)
  const [categories, setCategories] = useState<MegaMenuCategory[]>(DEMO_CATEGORIES)
  // Ô tìm kiếm chính ẩn trên mobile -- thêm nút icon riêng, bấm vào xổ hàng tìm kiếm full-width dưới header.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)
  // Desktop + mobile dùng chung 1 state vì không hiển thị cùng lúc.
  const [searchValue, setSearchValue] = useState('')
  const [searchParams] = useSearchParams()
  // True chỉ sau khi user thật sự gõ -- tránh nhầm "chưa gõ gì" với "vừa xoá hết", nếu không effect
  // dưới sẽ xoá nhầm keyword có sẵn trên URL ngay lúc mount.
  const hasTypedRef = useRef(false)

  // Tự tìm sau khi ngừng gõ (debounce 450ms) thay vì bắt buộc bấm Enter.
  useEffect(() => {
    if (!hasTypedRef.current) return
    const timer = setTimeout(() => {
      const trimmed = searchValue.trim()
      if (trimmed) {
        navigate(`/shop?keyword=${encodeURIComponent(trimmed)}`)
      } else if (searchParams.get('keyword')) {
        // Ô tìm kiếm vừa bị xoá trắng khi URL đang có keyword -- dọn luôn keyword khỏi URL.
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
    // Enter tìm ngay, không đợi debounce.
    if (e.key === 'Enter' && searchValue.trim()) {
      navigate(`/shop?keyword=${encodeURIComponent(searchValue.trim())}`)
      setMobileSearchOpen(false)
    }
  }
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
            {/* Mega-menu 2 cấp: hover nhóm cha để hiện các loại con. */}
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
            {canAccessAdmin && (
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
            <button onClick={() => navigate('/cart')} aria-label="Giỏ hàng" className={`relative ${ICON_BUTTON_CLASS}`}>
              <IconShoppingBag size={20} stroke={1.7} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 font-semibold text-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
            <div className="relative flex items-center" onMouseLeave={() => setAccountMenuOpen(false)}>
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
                  <div className="w-44 bg-white border border-stone-200 shadow-xl py-1">
                    <Link
                      to="/account"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-gold-dark transition-colors"
                    >
                      <IconUserCircle size={16} stroke={1.7} />
                      Tài khoản
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-gold-dark transition-colors"
                    >
                      <IconPackage size={16} stroke={1.7} />
                      Đơn hàng của tôi
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
