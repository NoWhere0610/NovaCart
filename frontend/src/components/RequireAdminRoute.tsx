import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Bọc quanh toàn bộ nhóm route /admin/*. Khác với ProtectedRoute (chỉ cần
 * đăng nhập), route này còn đòi hỏi user.roles phải chứa 'ADMIN' — nếu
 * không, coi như route không tồn tại với họ (redirect thẳng về trang chủ).
 *
 * Lưu ý: đây chỉ là lớp bảo vệ Ở PHÍA GIAO DIỆN (UX) — lớp bảo vệ THẬT SỰ
 * nằm ở backend (SecurityConfig: hasRole("ADMIN") cho /api/admin/**).
 */
export default function RequireAdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.roles.includes('ADMIN')) return <Navigate to="/" replace />

  return <Outlet />
}