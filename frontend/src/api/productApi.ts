import { apiClient } from './apiClient'

export interface ProductVariantDto {
  variantId: number
  size: string
  color: string
  stockQuantity: number
}

export interface ProductDetailDto {
  productId: number
  productName: string
  slug: string
  description: string | null
  price: number
  salePrice: number | null
  material: string | null
  categoryName: string | null
  brandName: string | null
  imageUrls: string[]
  variants: ProductVariantDto[]
  // Sprint 4: rating tổng hợp, đã tính sẵn ở backend
  averageRating: number
  reviewCount: number
}

export async function getProductDetailApi(productId: number): Promise<ProductDetailDto> {
  const { data } = await apiClient.get<ProductDetailDto>(`/home/products/${productId}`)
  return data
}

// ================== REVIEWS (Sprint 4) ==================

export interface ReviewDto {
  reviewId: number
  username: string
  rating: number
  comment: string | null
  createdAt: string
}

export interface PageResponse<T> {
  content: T[]
  currentPage: number
  totalPages: number
  totalElements: number
  last: boolean
}

// GET công khai — nằm dưới /home/** nên KHÔNG cần token, ai cũng xem được
export async function getProductReviewsApi(productId: number, page = 0, size = 10) {
  const { data } = await apiClient.get<PageResponse<ReviewDto>>(
    `/home/products/${productId}/reviews`,
    { params: { page, size } },
  )
  return data
}

// POST nằm ở path RIÊNG /api/reviews/** (không phải /home/**) — bắt buộc đăng nhập,
// xem chú thích trong ReviewController.java ở backend để hiểu lý do tách path
export async function createReviewApi(productId: number, rating: number, comment: string) {
  const { data } = await apiClient.post<ReviewDto>(`/reviews/products/${productId}`, { rating, comment })
  return data
}