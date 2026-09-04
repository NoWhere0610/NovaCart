import { apiClient } from './apiClient'
import type { PageResponse } from './orderApi'

// ================== PRODUCTS ==================

export interface AdminVariantDto {
  variantId: number | null
  size: string
  color: string
  sku?: string
  stockQuantity: number
  // Tồn kho ĐỌC ĐƯỢC lúc mở form. Backend so sánh với stockQuantity để phân biệt "admin thật sự sửa tồn
  // kho" với "form gửi lại con số cũ kèm theo khi chỉ sửa mô tả/giá" -- xem AdminProductService.applyStock.
  originalStockQuantity?: number | null
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
  variants: { variantId: number; size: string; color: string; sku: string | null; stockQuantity: number }[]
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

export async function getAdminProductsApi(keyword: string, page = 0, size = 20, lowStockOnly = false) {
  const { data } = await apiClient.get<PageResponse<AdminProductDto>>('/admin/products', {
    // lowStockOnly lọc ở BACKEND (query trên toàn bộ sản phẩm), không lọc lại ở client trên trang hiện tại
    // -- nếu lọc ở client thì mặt hàng sắp hết nằm ở trang sau sẽ không bao giờ hiện ra.
    params: { keyword: keyword || undefined, page, size, lowStockOnly: lowStockOnly || undefined },
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

export async function uploadAdminProductImageApi(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<{ url: string }>('/admin/products/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.url
}

// ================== INVENTORY (sửa nhanh tồn kho 1 biến thể) ==================
// Không còn màn "Kho tồn hàng" riêng (đã gộp vào trang Sản phẩm) -- API này giờ chỉ dùng cho nút +/-
// điều chỉnh nhanh tồn kho ngay trong bảng sản phẩm.

/**
 * Gửi MỨC THAY ĐỔI (+1/-1), không gửi số tồn kho cuối cùng.
 *
 * Bản cũ tự cộng trên state của trình duyệt rồi PUT lên số tuyệt đối. Con số đó tính từ dữ liệu đọc lúc
 * tải trang, nên mọi giao dịch xảy ra sau đó (POS bán, đơn online, admin khác nhập kho) đều bị ghi đè im
 * lặng -- bấm + nhanh 3 lần cũng chỉ tăng 1. Gửi delta thì phép cộng chạy ở backend trong transaction đã
 * khoá row nên không mất cập nhật nào; trả về số tồn kho THẬT sau khi cộng để UI hiển thị đúng.
 */
export async function adjustAdminInventoryStockApi(variantId: number, delta: number) {
  const { data } = await apiClient.patch<{ stockQuantity: number }>(
    `/admin/inventory/${variantId}/stock`,
    { delta },
  )
  return data.stockQuantity
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
  /** Trạng thái đơn TRƯỚC khi khách gửi yêu cầu trả hàng -- nút "Từ chối" phải đưa đơn về đúng đây. */
  statusBeforeReturn: string | null
  /** Xem chú thích cùng tên trong orderApi.ts -- KHÁC paymentStatus ở trên. */
  refundStatus: 'NONE' | 'PENDING' | 'COMPLETED'
  refundBankName: string | null
  refundAccountNumber: string | null
  refundAccountHolder: string | null
  refundCompletedAt: string | null
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

/** Admin điền/sửa tài khoản nhận tiền hoàn. Dùng cho khoản hoàn phát sinh mà không hỏi được khách:
 *  admin tự huỷ đơn đã thanh toán, hoặc tiền VNPay về sau khi đơn đã bị huỷ. */
export async function updateAdminOrderRefundAccountApi(
  orderId: number,
  payload: { refundBankName: string; refundAccountNumber: string; refundAccountHolder: string },
) {
  const { data } = await apiClient.patch<AdminOrderDto>(`/admin/orders/${orderId}/refund-account`, payload)
  return data
}

/** Admin xác nhận ĐÃ chuyển tiền hoàn lại cho khách. Backend chỉ cho gọi khi đơn đã ở trạng thái
 *  RETURNED (đã duyệt trả hàng) và refundStatus đang là PENDING. */
export async function confirmAdminOrderRefundApi(orderId: number) {
  const { data } = await apiClient.patch<AdminOrderDto>(`/admin/orders/${orderId}/confirm-refund`)
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

/** keyword lọc ở BACKEND trên toàn bộ người dùng (khớp cả email lẫn tên đăng nhập), không lọc lại
 *  trên trang hiện tại -- người cần tìm rất có thể nằm ở trang sau. */
export async function getAdminUsersApi(page = 0, size = 20, keyword = '') {
  const { data } = await apiClient.get<PageResponse<AdminUserDto>>('/admin/users', {
    params: { page, size, keyword: keyword || undefined },
  })
  return data
}

export type VaiTro = 'ADMIN' | 'STAFF' | 'CUSTOMER'

/** Đổi vai trò. Backend chặn hai ca nguy hiểm: tự hạ vai trò của mình, và hạ admin cuối cùng. */
export async function updateAdminUserRoleApi(userId: number, roleName: VaiTro) {
  const { data } = await apiClient.put<AdminUserDto>(`/admin/users/${userId}/role`, { roleName })
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

// ================== PERMISSIONS (phân quyền nhân viên) ==================

export interface AdminPermissionItemDto {
  code: string
  group: string
  label: string
  granted: boolean
}

export async function getStaffPermissionsApi() {
  const { data } = await apiClient.get<AdminPermissionItemDto[]>('/admin/permissions/staff')
  return data
}

export async function updateStaffPermissionsApi(permissions: Record<string, boolean>) {
  const { data } = await apiClient.put<AdminPermissionItemDto[]>('/admin/permissions/staff', { permissions })
  return data
}