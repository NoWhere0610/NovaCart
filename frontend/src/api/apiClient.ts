import axios from 'axios'

// Base URL của backend Spring Boot. Nên đưa qua biến môi trường (.env) khi
// deploy thật (VITE_API_BASE_URL), để dev/staging/production trỏ khác nhau
// mà không cần sửa code.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor REQUEST: tự động gắn "Authorization: Bearer <token>" vào MỌI
// request nếu đã đăng nhập, thay vì phải tự thêm header thủ công ở từng nơi gọi API.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor RESPONSE: nếu backend trả 401 (token hết hạn/không hợp lệ) thì
// tự động đăng xuất + đá về trang login, tránh mỗi trang phải tự bắt lỗi 401 riêng.
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