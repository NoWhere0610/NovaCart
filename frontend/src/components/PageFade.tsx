import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Bọc quanh <Outlet /> để fade + trượt nhẹ khi chuyển trang. Key theo pathname (không phải
 * toàn bộ location) để không re-trigger khi chỉ đổi query string (vd phân trang ở ShopPage).
 */
export default function PageFade({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-fade-slide">
      {children}
    </div>
  )
}
