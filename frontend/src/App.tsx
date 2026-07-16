import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AccountPage from './pages/AccountPage'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'

/**
 * Khai báo toàn bộ route của app tại 1 nơi duy nhất.
 * AuthProvider bọc ngoài cùng để MỌI trang (kể cả public) đều đọc được
 * trạng thái đăng nhập hiện tại qua hook useAuth().
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Route công khai - ai cũng xem được */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Nhóm route bắt buộc đăng nhập - ProtectedRoute tự redirect về
              /login nếu chưa có accessToken hợp lệ. Sau này thêm /checkout,
              /orders... chỉ cần khai báo thêm <Route> vào trong nhóm này. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App