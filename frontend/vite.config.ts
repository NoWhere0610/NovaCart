import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Ảnh sản phẩm admin upload được lưu dưới dạng đường dẫn tương đối "/uploads/products/..."
    // (xem FileStorageService) -- proxy sang backend để trình duyệt tải được qua chính origin đang mở.
    // Nhờ vậy demo qua IP LAN hay đổi cổng đều không vỡ ảnh. Khi build production thật thì reverse proxy
    // (nginx...) phải trỏ /uploads về backend tương tự.
    proxy: {
      '/uploads': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  optimizeDeps: {
    // @tabler/icons-react export ~6200 icon từ 1 file "barrel" duy nhất — bộ tối ưu dependency của
    // Vite 8 (Rolldown) sinh ra file pre-bundle bị lỗi parse với barrel lớn cỡ này (đã xác nhận: build
    // production "vite build" vẫn chạy tốt, chỉ dev server bị lỗi). Loại khỏi bước pre-bundle để Vite
    // dev server phục vụ thẳng các file ESM gốc của package thay vì tự gộp lại.
    exclude: ['@tabler/icons-react'],
  },
})
