import { apiClient } from './apiClient'

export interface WishlistProductDto {
  productId: number
  productName: string
  slug: string
  price: number
  salePrice: number | null
  thumbnailUrl: string | null
  categoryName: string | null
  brandName: string | null
}

export interface WishlistPageResponse {
  content: WishlistProductDto[]
  totalPages: number
  currentPage: number
  totalElements: number
}

export async function getWishlistProductIdsApi(): Promise<number[]> {
  const { data } = await apiClient.get<number[]>('/wishlist/product-ids')
  return data
}

export async function getWishlistApi(page = 0, size = 24): Promise<WishlistPageResponse> {
  const { data } = await apiClient.get<WishlistPageResponse>('/wishlist', { params: { page, size } })
  return data
}

export async function addToWishlistApi(productId: number): Promise<void> {
  await apiClient.post(`/wishlist/${productId}`)
}

export async function removeFromWishlistApi(productId: number): Promise<void> {
  await apiClient.delete(`/wishlist/${productId}`)
}
