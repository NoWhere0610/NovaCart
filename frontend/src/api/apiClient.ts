import axios from 'axios'

// Base URL backend Spring Boot, lấy từ .env (VITE_API_BASE_URL) khi deploy thật.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // axios KHÔNG có timeout mặc định -> request treo là treo vô hạn, người dùng chỉ thấy trạng thái
  // "đang tải" mãi mãi mà không có lỗi nào để hiển thị. Đặt rộng tay vì lượt hỏi chatbot có thể mất vài
  // chục giây (backend gọi kit -> kit gọi Gemini 3 lượt nối tiếp, có thử lại khi bị giới hạn tần suất).
  timeout: 70000,
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
        // Lý do đi kèm URL chứ không phải toast: dòng dưới nạp LẠI CẢ TRANG, mọi state React (toast
        // trong đó) bị xoá sạch trước khi người dùng kịp nhìn. Tham số này sống qua lần nạp lại và
        // được LoginPage đọc để giải thích vì sao tự nhiên bị đá về đây.
        window.location.href = '/login?phien=het-han'
      }
    }
    return Promise.reject(error)
  },
)