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

// Backend trả 401 (token hết hạn/không hợp lệ) thì tự đăng xuất + đá về trang login.
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