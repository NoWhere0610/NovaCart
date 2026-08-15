import { apiClient } from './apiClient'

// Xem trước số tiền giảm TRƯỚC khi đặt hàng (không tăng usedCount) -- dùng ở trang checkout để
// hiện đúng tổng tiền ngay khi khách gõ mã, thay vì chỉ biết được sau khi đặt hàng xong.
export async function previewVoucherApi(code: string, subtotal: number): Promise<number> {
  const { data } = await apiClient.get<{ discountAmount: number }>('/vouchers/preview', {
    params: { code, subtotal },
  })
  return data.discountAmount
}
