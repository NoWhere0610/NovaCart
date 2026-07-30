import { apiClient } from './apiClient'

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
export type PaymentMethod = 'COD' | 'BANK_TRANSFER'

export interface OrderItemDto {
  productId: number | null
  productName: string
  size: string
  color: string
  unitPrice: number
  quantity: number
  subtotal: number
  reviewed: boolean | null
}

export interface OrderDto {
  orderId: number
  receiverName: string
  phone: string
  shippingAddress: string
  totalAmount: number
  subtotalAmount: number | null
  discountAmount: number | null
  voucherCode: string | null
  status: OrderStatus
  paymentMethod: PaymentMethod
  note: string | null
  returnReason: string | null
  createdAt: string
  items: OrderItemDto[] | null
}

export interface PageResponse<T> {
  content: T[]
  currentPage: number
  totalPages: number
  totalElements: number
  last: boolean
}

export interface CheckoutPayload {
  addressId: number
  paymentMethod: PaymentMethod
  note?: string
  voucherCode?: string
}

export async function checkoutApi(payload: CheckoutPayload): Promise<OrderDto> {
  const { data } = await apiClient.post<OrderDto>('/orders/checkout', payload)
  return data
}

export async function getMyOrdersApi(page = 0, size = 10): Promise<PageResponse<OrderDto>> {
  const { data } = await apiClient.get<PageResponse<OrderDto>>('/orders', { params: { page, size } })
  return data
}

export async function getMyOrderDetailApi(orderId: number): Promise<OrderDto> {
  const { data } = await apiClient.get<OrderDto>(`/orders/${orderId}`)
  return data
}

export async function cancelOrderApi(orderId: number): Promise<OrderDto> {
  const { data } = await apiClient.post<OrderDto>(`/orders/${orderId}/cancel`)
  return data
}

export async function completeOrderApi(orderId: number): Promise<OrderDto> {
  const { data } = await apiClient.post<OrderDto>(`/orders/${orderId}/complete`)
  return data
}

export async function requestReturnApi(orderId: number, reason: string): Promise<OrderDto> {
  const { data } = await apiClient.post<OrderDto>(`/orders/${orderId}/request-return`, { reason })
  return data
}