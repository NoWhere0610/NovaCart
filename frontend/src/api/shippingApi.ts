import { apiClient } from './apiClient'

export async function getShippingFeeApi(province: string, subtotal: number): Promise<number> {
  const { data } = await apiClient.get<{ shippingFee: number }>('/shipping/fee', {
    params: { province, subtotal },
  })
  return data.shippingFee
}