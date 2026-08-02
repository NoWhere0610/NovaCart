import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../api/apiClient'
import CategoryMegaMenu, { type MegaMenuCategory } from './CategoryMegaMenu'
import { DEMO_CATEGORIES } from '../data/demoCategories'

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
  const isAdmin = user?.roles.includes('ADMIN') ?? false
  const [categories, setCategories] = useState<MegaMenuCategory[]>(DEMO_CATEGORIES)

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
    <header className="bg-stone-50 border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-6">
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
              <span className="text-2xl font-bold tracking-tight text-stone-900">MENSWEAR</span>
              <span className="text-[10px] uppercase tracking-widest text-stone-400 border-l border-stone-300 pl-2">
                For Him
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <input
              placeholder="Tìm sản phẩm..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/shop?keyword=${(e.target as HTMLInputElement).value}`)
              }}
              className="hidden sm:block w-48 border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-stone-900"
            />
            {isAdmin && (
              <Link
                to="/admin"
                className="hidden sm:flex items-center gap-1.5 bg-orange-700 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 3 6v6c0 5 4 8.5 9 10 5-1.5 9-5 9-10V6l-9-4Z" />
                </svg>
                Quản trị
              </Link>
            )}
            <button onClick={() => navigate('/orders')} aria-label="Đơn hàng của tôi" className="text-stone-700 hover:text-stone-900">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h6" />
              </svg>
            </button>
            <button onClick={() => navigate('/cart')} aria-label="Giỏ hàng" className="text-stone-700 hover:text-stone-900">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 7h12l-1 13H7L6 7z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </svg>
            </button>
            <button onClick={logout} className="text-xs text-stone-400 hover:text-stone-700 underline">
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
