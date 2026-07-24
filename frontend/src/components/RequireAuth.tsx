import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Khác với ProtectedRoute cũ (chỉ bảo vệ vài trang như /cart, /orders),
 * component này bọc NGOÀI CÙNG toàn bộ site bán hàng — người dùng phải
 * đăng nhập mới xem được BẤT KỲ trang nào (kể cả trang chủ, danh mục,
 * chi tiết sản phẩm). Chỉ /login và /register là ngoại lệ, nằm NGOÀI
 * component này trong App.tsx.
 */
export default function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}