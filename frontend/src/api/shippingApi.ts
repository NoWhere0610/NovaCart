import { apiClient } from './apiClient'

// Nhận addressId thay vì tự truyền tay province -- backend tự lấy toạ độ của địa chỉ đó để tính phí
// theo khoảng cách thật (VietMap Matrix API), fallback công thức cũ nếu địa chỉ chưa có toạ độ.
export async function getShippingFeeApi(addressId: number, subtotal: number): Promise<number> {
  const { data } = await apiClient.get<{ shippingFee: number }>('/shipping/fee', {
    params: { addressId, subtotal },
  })
  return data.shippingFee
}