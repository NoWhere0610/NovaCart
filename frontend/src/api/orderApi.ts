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
export type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'VNPAY'

export interface OrderItemDto {
  orderItemId: number | null
  variantId: number | null
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
  shippingFee: number | null
  voucherCode: string | null
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED'
  // Chỉ có giá trị khi paymentMethod=BANK_TRANSFER và còn UNPAID -- ảnh mã QR VietQR để quét chuyển khoản.
  qrCodeUrl: string | null
  note: string | null
  returnReason: string | null
  returnBankName: string | null
  returnAccountNumber: string | null
  returnAccountHolder: string | null
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
  // Không truyền = đặt hàng CẢ giỏ (như cũ). Có giá trị = chỉ đặt đúng các dòng này, giữ lại phần còn lại.
  cartItemIds?: number[]
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

export interface RequestReturnPayload {
  reason: string
  bankName: string
  accountNumber: string
  accountHolder: string
}

export async function requestReturnApi(orderId: number, payload: RequestReturnPayload): Promise<OrderDto> {
  const { data } = await apiClient.post<OrderDto>(`/orders/${orderId}/request-return`, payload)
  return data
}

export async function getVnpayUrlApi(orderId: number): Promise<string> {
  const { data } = await apiClient.get<{ paymentUrl: string }>(`/orders/${orderId}/vnpay-url`)
  return data.paymentUrl
}