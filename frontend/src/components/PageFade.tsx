import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Bọc quanh <Outlet /> để tạo animation fade + trượt nhẹ lên mỗi khi chuyển trang/tab. Key theo
 * pathname (không phải toàn bộ location) để KHÔNG re-trigger fade khi chỉ đổi
 * query string trong cùng 1 trang (vd phân trang/filter ở ShopPage).
 * Dùng "page-fade-slide" riêng (không phải "page-fade" của lưới sản phẩm ShopPage) -- chuyển trang thật
 * nên có cảm giác sang hơn (dịch nhẹ lên), lọc sản phẩm thì nên nhẹ/nhanh, không dịch chuyển.
 */
export default function PageFade({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-fade-slide">
      {children}
    </div>
  )
}
