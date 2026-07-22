import { apiClient } from './apiClient'

export interface CartItemDto {
  cartItemId: number
  variantId: number
  productId: number
  productName: string
  imageUrl: string | null
  size: string
  color: string
  unitPrice: number
  quantity: number
  subtotal: number
  stockQuantity: number
}

export interface CartDto {
  items: CartItemDto[]
  totalQuantity: number
  totalAmount: number
}

export async function getMyCartApi(): Promise<CartDto> {
  const { data } = await apiClient.get<CartDto>('/cart')
  return data
}

export async function addToCartApi(variantId: number, quantity: number): Promise<CartDto> {
  const { data } = await apiClient.post<CartDto>('/cart/items', { variantId, quantity })
  return data
}

export async function updateCartItemApi(cartItemId: number, quantity: number): Promise<CartDto> {
  const { data } = await apiClient.put<CartDto>(`/cart/items/${cartItemId}`, { quantity })
  return data
}

export async function removeCartItemApi(cartItemId: number): Promise<CartDto> {
  const { data } = await apiClient.delete<CartDto>(`/cart/items/${cartItemId}`)
  return data
}