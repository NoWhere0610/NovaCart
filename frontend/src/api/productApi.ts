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

export interface ProductRatingSummaryDto {
  averageRating: number
  totalReviews: number
  // Key "1".."5" (JSON không giữ key số) -- số đánh giá ở đúng mức sao đó, luôn đủ 5 key kể cả 0.
  ratingDistribution: Record<string, number>
}

export async function getProductRatingSummaryApi(productId: number) {
  const { data } = await apiClient.get<ProductRatingSummaryDto>(
    `/home/products/${productId}/reviews/summary`,
  )
  return data
}

export interface ReviewEligibilityDto {
  coTheDanhGia: boolean
  /** Lý do không được đánh giá, do BACKEND soạn sẵn -- hiển thị nguyên văn, đừng tự chế câu khác. */
  lyDo: string | null
}

/**
 * Hỏi trước khi vẽ form viết đánh giá.
 *
 * Đừng tự suy quy tắc ở frontend: nó gồm cả "đã mua và nhận hàng" lẫn "chưa đánh giá lần nào", và cả
 * hai đều cần dữ liệu chỉ backend có. Bản trước đoán là "cứ đăng nhập là hiện form" nên khách chưa
 * từng mua vẫn gõ hết cảm nhận rồi bấm gửi mới biết không được.
 */
export async function getReviewEligibilityApi(productId: number) {
  const { data } = await apiClient.get<ReviewEligibilityDto>(`/reviews/products/${productId}/eligibility`)
  return data
}

// POST nằm ở path RIÊNG /api/reviews/** (không phải /home/**) — bắt buộc đăng nhập,
// xem chú thích trong ReviewController.java ở backend để hiểu lý do tách path
export async function createReviewApi(productId: number, rating: number, comment: string) {
  const { data } = await apiClient.post<ReviewDto>(`/reviews/products/${productId}`, { rating, comment })
  return data
}