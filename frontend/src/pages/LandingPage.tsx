import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = [
  { slug: 'ao-thun', label: 'Áo thun' },
  { slug: 'ao-so-mi', label: 'Áo sơ mi' },
  { slug: 'quan-jean', label: 'Quần jean' },
  { slug: 'quan-tay', label: 'Quần tây' },
  { slug: 'ao-khoac', label: 'Áo khoác' },
]

// Ảnh nổi bật cho hero — dùng picsum (luôn tải được, ổn định) thay vì
// Unsplash Source (dịch vụ đã ngừng bảo trì chính thức, hay lỗi 503).
// Khi có ảnh sản phẩm thật, đổi URL này thành ảnh chụp thật của shop.
const HERO_IMAGE = 'https://picsum.photos/seed/menswear-hero/900/1100'

export default function LandingPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [showCategories, setShowCategories] = useState(false)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-stone-50 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-6">
              {/* Nút Danh mục — dropdown xổ xuống khi bấm, thay cho dàn ngang cũ */}
              <div
                className="relative"
                onBlur={(e) => {
                  // Đóng dropdown khi click ra ngoài toàn bộ khối này (không phải
                  // đang click vào 1 item bên trong nó)
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setShowCategories(false)
                  }
                }}
              >
                <button
                  onClick={() => setShowCategories((v) => !v)}
                  className="flex items-center gap-2 text-sm text-stone-700 hover:text-stone-900 border border-stone-300 px-3 py-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Danh mục sản phẩm
                </button>

                {showCategories && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-stone-200 shadow-lg z-50">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => {
                          setShowCategories(false)
                          navigate(`/shop?category=${c.slug}`)
                        }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
              <button onClick={() => navigate('/account')} aria-label="Tài khoản" className="text-stone-700 hover:text-stone-900">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
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

      <section className="flex-1 grid grid-cols-1 md:grid-cols-2 bg-stone-900">
        <div className="flex flex-col justify-center px-8 md:px-16 py-16 text-stone-50">
          <p className="text-orange-500 text-xs font-semibold tracking-widest uppercase mb-4">
            Bộ sưu tập mới
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            May đo
            <br />
            phong cách
            <br />
            của riêng bạn.
          </h1>
          <p className="text-stone-300 max-w-md mb-8">
            Trang phục nam tối giản, chất liệu bền và form dáng chuẩn — từ áo sơ mi công sở đến
            streetwear hằng ngày.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/shop')}
              className="bg-orange-700 hover:bg-orange-600 transition-colors text-white text-sm font-semibold px-6 py-3"
            >
              Mua ngay
            </button>
            <button
              onClick={() => navigate('/categories')}
              className="border border-stone-400 hover:border-stone-50 transition-colors text-stone-50 text-sm font-semibold px-6 py-3"
            >
              Xem danh mục
            </button>
          </div>
        </div>

        <div className="relative hidden md:block overflow-hidden">
          <img src={HERO_IMAGE} alt="Sản phẩm nổi bật" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-stone-900/40" />
        </div>
      </section>
    </div>
  )
}