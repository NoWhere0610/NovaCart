import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // @tabler/icons-react export ~6200 icon từ 1 file "barrel" duy nhất — bộ tối ưu dependency của
    // Vite 8 (Rolldown) sinh ra file pre-bundle bị lỗi parse với barrel lớn cỡ này (đã xác nhận: build
    // production "vite build" vẫn chạy tốt, chỉ dev server bị lỗi). Loại khỏi bước pre-bundle để Vite
    // dev server phục vụ thẳng các file ESM gốc của package thay vì tự gộp lại.
    exclude: ['@tabler/icons-react'],
  },
})
