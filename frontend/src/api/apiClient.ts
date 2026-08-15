import axios from 'axios'

// Base URL backend Spring Boot, lấy từ .env (VITE_API_BASE_URL) khi deploy thật.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Tự động gắn "Authorization: Bearer <token>" vào mọi request nếu đã đăng nhập.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Backend trả 401 (chưa đăng nhập / token hết hạn-không hợp lệ) thì tự đăng xuất + đá về trang login.
// KHÔNG xử lý 403 ở đây -- SecurityConfig backend giờ đã tắt "ẩn danh tự động" nên 403 chỉ còn đúng 1
// nghĩa: đã đăng nhập thật nhưng không đủ quyền cho hành động này (vd nhân viên thiếu quyền trong ma
// trận) -- KHÔNG nên đăng xuất người dùng vì việc đó, chỉ cần hiện đúng thông báo lỗi.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('currentUser')
      // Chỉ redirect nếu KHÔNG đang ở sẵn trang login (tránh loop redirect)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)