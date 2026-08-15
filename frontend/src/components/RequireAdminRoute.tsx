import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Bọc quanh route /admin/* cần bảo vệ. Mặc định CHỈ ADMIN (dùng cho Kho tồn hàng/Người dùng — khớp
 * đúng SecurityConfig backend, 2 khu vực này luôn khoá cứng ADMIN, không qua ma trận STAFF). Truyền
 * `allowStaff` cho khu vực chung /admin -- quyền THẬT theo từng hành động cụ thể vẫn do backend
 * (@PreAuthorize + ma trận role_permission) quyết định, đây chỉ là lớp UX để không hiện nhầm trang.
 *
 * Lưu ý: đây chỉ là lớp bảo vệ Ở PHÍA GIAO DIỆN (UX) — lớp bảo vệ THẬT SỰ nằm ở backend.
 */
export default function RequireAdminRoute({ allowStaff = false }: { allowStaff?: boolean }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const roles = user?.roles ?? []
  const allowed = roles.includes('ADMIN') || (allowStaff && roles.includes('STAFF'))
  if (!allowed) return <Navigate to="/" replace />

  return <Outlet />
}