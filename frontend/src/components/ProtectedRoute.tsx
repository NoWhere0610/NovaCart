import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Bọc quanh các route yêu cầu đăng nhập (vd: /account, /checkout, /orders).
 * Dùng <Outlet/> của react-router để render route con -> chỉ cần khai báo
 * 1 lần trong App.tsx cho cả nhóm route, không phải wrap từng trang riêng lẻ.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // Đang khôi phục phiên đăng nhập từ localStorage -> chưa vội kết luận gì,
  // tránh trường hợp redirect nhầm về /login rồi mới nhận ra thật ra đã login
  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    // Lưu lại trang định vào (location) để sau khi login xong quay lại đúng chỗ
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}