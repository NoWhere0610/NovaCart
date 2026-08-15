import { apiClient } from './apiClient'
import type { PageResponse } from './orderApi'

// ================== PRODUCTS ==================

export interface AdminVariantDto {
  variantId: number | null
  size: string
  color: string
  sku?: string
  stockQuantity: number
}

export interface AdminProductDto {
  productId: number
  productName: string
  slug: string
  description: string | null
  categoryId: number | null
  categoryName: string | null
  brandId: number | null
  brandName: string | null
  price: number
  salePrice: number | null
  material: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK'
  imageUrls: string[]
  variants: { variantId: number; size: string; color: string; stockQuantity: number }[]
  createdAt: string
  updatedAt: string
}

export interface AdminProductPayload {
  productName: string
  description?: string
  categoryId: number
  brandId?: number | null
  price: number
  salePrice?: number | null
  material?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK'
  imageUrls: string[]
  variants: AdminVariantDto[]
}

export async function getAdminProductsApi(keyword: string, page = 0, size = 20) {
  const { data } = await apiClient.get<PageResponse<AdminProductDto>>('/admin/products', {
    params: { keyword: keyword || undefined, page, size },
  })
  return data
}

export async function createAdminProductApi(payload: AdminProductPayload) {
  const { data } = await apiClient.post<AdminProductDto>('/admin/products', payload)
  return data
}

export async function updateAdminProductApi(productId: number, payload: AdminProductPayload) {
  const { data } = await apiClient.put<AdminProductDto>(`/admin/products/${productId}`, payload)
  return data
}

export async function deleteAdminProductApi(productId: number) {
  await apiClient.delete(`/admin/products/${productId}`)
}

// ================== INVENTORY (Kho tồn hàng) ==================

export interface AdminInventoryItemDto {
  variantId: number
  productId: number
  productName: string
  categoryName: string | null
  size: string
  color: string
  sku: string | null
  stockQuantity: number
  price: number
  productStatus: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK'
  lowStock: boolean
}

export interface AdminInventoryCreatePayload {
  productId: number
  size: string
  color: string
  sku?: string
  stockQuantity: number
}

export interface AdminInventoryUpdatePayload {
  size: string
  color: string
  sku?: string
  stockQuantity: number
}

export async function getAdminInventoryApi(keyword: string, lowStockOnly: boolean, page = 0, size = 20) {
  const { data } = await apiClient.get<PageResponse<AdminInventoryItemDto>>('/admin/inventory', {
    params: { keyword: keyword || undefined, lowStockOnly, page, size },
  })
  return data
}

export async function createAdminInventoryItemApi(payload: AdminInventoryCreatePayload) {
  const { data } = await apiClient.post<AdminInventoryItemDto>('/admin/inventory', payload)
  return data
}

export async function updateAdminInventoryItemApi(variantId: number, payload: AdminInventoryUpdatePayload) {
  const { data } = await apiClient.put<AdminInventoryItemDto>(`/admin/inventory/${variantId}`, payload)
  return data
}

export async function deleteAdminInventoryItemApi(variantId: number) {
  await apiClient.delete(`/admin/inventory/${variantId}`)
}

// ================== CATEGORIES ==================

export interface AdminCategoryDto {
  categoryId: number
  categoryName: string
  slug: string
  parentId: number | null
  parentName: string | null
  description: string | null
  isActive: boolean
}

export interface AdminCategoryPayload {
  categoryName: string
  parentId?: number | null
  description?: string
  isActive?: boolean
}

export async function getAdminCategoriesApi() {
  const { data } = await apiClient.get<AdminCategoryDto[]>('/admin/categories')
  return data
}

export async function createAdminCategoryApi(payload: AdminCategoryPayload) {
  const { data } = await apiClient.post<AdminCategoryDto>('/admin/categories', payload)
  return data
}

export async function updateAdminCategoryApi(categoryId: number, payload: AdminCategoryPayload) {
  const { data } = await apiClient.put<AdminCategoryDto>(`/admin/categories/${categoryId}`, payload)
  return data
}

export async function deleteAdminCategoryApi(categoryId: number) {
  await apiClient.delete(`/admin/categories/${categoryId}`)
}

// ================== BRANDS ==================

export interface AdminBrandDto {
  brandId: number
  brandName: string
  logoUrl: string | null
}

export async function getAdminBrandsApi() {
  const { data } = await apiClient.get<AdminBrandDto[]>('/admin/brands')
  return data
}

export async function createAdminBrandApi(brandName: string, logoUrl?: string) {
  const { data } = await apiClient.post<AdminBrandDto>('/admin/brands', { brandName, logoUrl })
  return data
}

export async function deleteAdminBrandApi(brandId: number) {
  await apiClient.delete(`/admin/brands/${brandId}`)
}

// ================== ORDERS ==================

export interface AdminOrderDto {
  orderId: number
  orderType: 'ONLINE' | 'POS'
  buyerUserId: number
  buyerUsername: string
  buyerEmail: string
  receiverName: string
  phone: string
  shippingAddress: string
  totalAmount: number
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'SHIPPING'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'RETURN_REQUESTED'
    | 'RETURNED'
  paymentMethod: 'COD' | 'BANK_TRANSFER' | 'VNPAY'
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED'
  note: string | null
  returnReason: string | null
  createdAt: string
  items: { productId: number | null; productName: string; size: string; color: string; unitPrice: number; quantity: number; subtotal: number }[] | null
}

export async function getAdminOrdersApi(status: string, page = 0, size = 20) {
  const { data } = await apiClient.get<PageResponse<AdminOrderDto>>('/admin/orders', {
    params: { status: status || undefined, page, size },
  })
  return data
}

export async function getAdminOrderDetailApi(orderId: number) {
  const { data } = await apiClient.get<AdminOrderDto>(`/admin/orders/${orderId}`)
  return data
}

export async function updateAdminOrderStatusApi(orderId: number, status: string) {
  const { data } = await apiClient.put<AdminOrderDto>(`/admin/orders/${orderId}/status`, { status })
  return data
}

export async function confirmAdminOrderPaymentApi(orderId: number) {
  const { data } = await apiClient.patch<AdminOrderDto>(`/admin/orders/${orderId}/confirm-payment`)
  return data
}

// ================== VOUCHERS (Sprint 4) ==================

export interface AdminVoucherDto {
  voucherId: number
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  minOrderAmount: number | null
  maxDiscountAmount: number | null
  startDate: string | null
  endDate: string | null
  usageLimit: number | null
  usedCount: number
  isActive: boolean
}

export interface AdminVoucherPayload {
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  minOrderAmount?: number | null
  maxDiscountAmount?: number | null
  startDate?: string | null
  endDate?: string | null
  usageLimit?: number | null
  isActive?: boolean
}

export async function getAdminVouchersApi() {
  const { data } = await apiClient.get<AdminVoucherDto[]>('/admin/vouchers')
  return data
}

export async function createAdminVoucherApi(payload: AdminVoucherPayload) {
  const { data } = await apiClient.post<AdminVoucherDto>('/admin/vouchers', payload)
  return data
}

export async function updateAdminVoucherApi(voucherId: number, payload: AdminVoucherPayload) {
  const { data } = await apiClient.put<AdminVoucherDto>(`/admin/vouchers/${voucherId}`, payload)
  return data
}

export async function deleteAdminVoucherApi(voucherId: number) {
  await apiClient.delete(`/admin/vouchers/${voucherId}`)
}

// ================== USERS ==================

export interface AdminUserDto {
  userId: number
  username: string
  email: string
  fullName: string | null
  phone: string | null
  isActive: boolean
  roles: string[]
  createdAt: string
}

export async function getAdminUsersApi(page = 0, size = 20) {
  const { data } = await apiClient.get<PageResponse<AdminUserDto>>('/admin/users', { params: { page, size } })
  return data
}

export async function lockAdminUserApi(userId: number) {
  const { data } = await apiClient.put<AdminUserDto>(`/admin/users/${userId}/lock`)
  return data
}

export async function unlockAdminUserApi(userId: number) {
  const { data } = await apiClient.put<AdminUserDto>(`/admin/users/${userId}/unlock`)
  return data
}