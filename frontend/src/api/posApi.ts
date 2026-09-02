import { apiClient } from './apiClient'
import type { PageResponse } from './orderApi'

export interface PosOrderItemDto {
  orderItemId: number
  variantId: number | null
  productName: string
  imageUrl: string | null
  size: string
  color: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export type PosStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RETURNED'
export type PosPaymentMethod = 'COD' | 'BANK_TRANSFER'

export interface PosInvoiceDto {
  orderId: number
  orderCode: string
  status: PosStatus
  paymentMethod: PosPaymentMethod
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED'
  customerName: string | null
  customerPhone: string | null
  subtotalAmount: number
  discountAmount: number
  voucherCode: string | null
  totalAmount: number
  cashierUsername: string | null
  createdAt: string
  items: PosOrderItemDto[]
}

export async function createPosInvoiceApi() {
  const { data } = await apiClient.post<PosInvoiceDto>('/admin/pos/invoices')
  return data
}

export async function listPendingPosInvoicesApi(page = 0, size = 20) {
  const { data } = await apiClient.get<PageResponse<PosInvoiceDto>>('/admin/pos/invoices', {
    params: { page, size },
  })
  return data
}

export async function getPosInvoiceApi(orderId: number) {
  const { data } = await apiClient.get<PosInvoiceDto>(`/admin/pos/invoices/${orderId}`)
  return data
}

export async function addPosItemApi(orderId: number, variantId: number, quantity: number) {
  const { data } = await apiClient.post<PosInvoiceDto>(`/admin/pos/invoices/${orderId}/items`, {
    variantId,
    quantity,
  })
  return data
}

export async function updatePosItemQuantityApi(orderId: number, orderItemId: number, quantity: number) {
  const { data } = await apiClient.put<PosInvoiceDto>(
    `/admin/pos/invoices/${orderId}/items/${orderItemId}`,
    { quantity },
  )
  return data
}

export async function removePosItemApi(orderId: number, orderItemId: number) {
  const { data } = await apiClient.delete<PosInvoiceDto>(
    `/admin/pos/invoices/${orderId}/items/${orderItemId}`,
  )
  return data
}

export async function applyPosVoucherApi(orderId: number, voucherCode: string) {
  const { data } = await apiClient.post<PosInvoiceDto>(`/admin/pos/invoices/${orderId}/voucher`, {
    voucherCode,
  })
  return data
}

export async function removePosVoucherApi(orderId: number) {
  const { data } = await apiClient.delete<PosInvoiceDto>(`/admin/pos/invoices/${orderId}/voucher`)
  return data
}

export async function checkoutPosInvoiceApi(
  orderId: number,
  payload: { paymentMethod: PosPaymentMethod; customerName?: string; customerPhone?: string; note?: string },
) {
  const { data } = await apiClient.post<PosInvoiceDto>(`/admin/pos/invoices/${orderId}/checkout`, payload)
  return data
}

export async function cancelPosInvoiceApi(orderId: number) {
  await apiClient.delete(`/admin/pos/invoices/${orderId}`)
}

// Hoàn/huỷ hoá đơn ĐÃ THANH TOÁN (khác cancelPosInvoiceApi chỉ dùng cho hoá đơn đang chọn hàng) --
// hoàn kho + trả voucher, chuyển trạng thái sang RETURNED.
export async function voidPosInvoiceApi(orderId: number) {
  const { data } = await apiClient.post<PosInvoiceDto>(`/admin/pos/invoices/${orderId}/void`)
  return data
}

// Xác nhận đã nhận tiền chuyển khoản -- hoá đơn CHUYỂN KHOẢN không tự động PAID lúc checkout nữa
// (xem PosOrderService.checkout), thu ngân tự kiểm tra app ngân hàng rồi bấm xác nhận riêng.
export async function confirmPosPaymentApi(orderId: number) {
  const { data } = await apiClient.patch<PosInvoiceDto>(`/admin/pos/invoices/${orderId}/confirm-payment`)
  return data
}