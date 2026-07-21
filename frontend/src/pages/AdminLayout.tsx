import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/admin/products', label: 'Sản phẩm' },
  { to: '/admin/categories', label: 'Danh mục & Thương hiệu' },
  { to: '/admin/vouchers', label: 'Mã giảm giá' },
  { to: '/admin/orders', label: 'Đơn hàng' },
  { to: '/admin/users', label: 'Người dùng' },
]

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-stone-100 flex">
      <aside className="w-56 bg-stone-900 text-stone-200 flex-shrink-0 py-6">
        <div className="px-5 mb-8">
          <p className="text-lg font-bold text-white">NovaCart</p>
          <p className="text-xs text-stone-400">Trang quản trị</p>
        </div>
        <nav className="space-y-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 text-sm ${
                  isActive ? 'bg-orange-700 text-white' : 'text-stone-300 hover:bg-stone-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
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