import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Icon inline SVG (không phụ thuộc thư viện ngoài như lucide-react, vì project
// hiện chưa cài — tránh bắt người dùng phải chạy lại "npm install").
function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  )
}

function IconWarehouse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21v-4h6v4" />
    </svg>
  )
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M20.5 12.5 12 21l-9-9V4h8l9.5 8.5Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconTicket() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M13 5v2M13 17v2M13 10v4" />
    </svg>
  )
}

function IconOrders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M6 2 4 6v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4" />
      <path d="M4 6h16" />
      <path d="M9 10a3 3 0 0 0 6 0" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.5a3.2 3.2 0 0 1 0 6.2" />
      <path d="M15.5 14.2a6.5 6.5 0 0 1 6 5.8" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 3v18h18" />
      <path d="M7 16v-4M12 16V8M17 16v-7" />
    </svg>
  )
}

function IconPos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <path d="M7 13h4" />
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/admin/statistics', label: 'Thống kê', icon: IconChart },
  { to: '/admin/pos', label: 'Bán tại quầy (POS)', icon: IconPos },
  { to: '/admin/products', label: 'Sản phẩm', icon: IconBox },
  { to: '/admin/inventory', label: 'Kho tồn hàng', icon: IconWarehouse, adminOnly: true },
  { to: '/admin/categories', label: 'Danh mục & Thương hiệu', icon: IconTag },
  { to: '/admin/vouchers', label: 'Mã giảm giá', icon: IconTicket },
  { to: '/admin/orders', label: 'Đơn hàng', icon: IconOrders },
  { to: '/admin/users', label: 'Người dùng', icon: IconUsers },
]

export default function AdminLayout() {
  const { user } = useAuth()
  const isAdmin = user?.roles.includes('ADMIN') ?? false

  // "Kho tồn hàng" chỉ hiện với role ADMIN — role khác (vd STAFF) không thấy
  // mục này trong menu, chứ không chỉ disable. Lớp chặn thật sự vẫn nằm ở
  // route guard (RequireAdminRoute, chặn kép) + backend hasRole("ADMIN")
  // cho /api/admin/inventory/**; ẩn ở UI chỉ là lớp trải nghiệm thêm.
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="min-h-screen bg-stone-100 flex">
      <aside className="w-56 bg-stone-900 text-stone-200 flex-shrink-0 py-6">
        <div className="px-5 mb-8">
          <p className="text-lg font-bold text-white">NovaCart</p>
          <p className="text-xs text-stone-400">Trang quản trị</p>
        </div>
        <nav className="space-y-1 px-3">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 text-sm ${
                    isActive ? 'bg-orange-700 text-white' : 'text-stone-300 hover:bg-stone-800'
                  }`
                }
              >
                <Icon />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="px-3 mt-8">
          <NavLink to="/" className="block px-3 py-2 text-sm text-stone-400 hover:text-stone-200">
            ← Về trang bán hàng
          </NavLink>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  )
}