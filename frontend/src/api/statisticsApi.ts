import { apiClient } from './apiClient'

export interface StatisticsSummary {
  totalRevenue: number
  completedRevenue: number
  returnedRevenue: number
  totalOrders: number
  averageOrderValue: number
  onlineOrders: number
  posOrders: number
  onlineRevenue: number
  posRevenue: number
  cancelledOrders: number
  returnedOrders: number
}

export interface PeriodComparison {
  revenueChangePercent: number | null
  orderCountChangePercent: number | null
}

export interface RevenuePoint {
  date: string
  revenue: number
  returnedRevenue: number
  orderCount: number
}

export interface TopProduct {
  productName: string
  quantitySold: number
  revenue: number
}

export interface CategoryRevenue {
  categoryName: string
  revenue: number
  quantitySold: number
}

export interface PaymentMethodStat {
  paymentMethod: string
  orderCount: number
  revenue: number
}

export interface LowStockItem {
  productName: string
  size: string
  color: string
  stockQuantity: number
}

export interface StatisticsResponse {
  summary: StatisticsSummary
  periodComparison: PeriodComparison
  revenueByDay: RevenuePoint[]
  topProducts: TopProduct[]
  revenueByCategory: CategoryRevenue[]
  paymentMethodBreakdown: PaymentMethodStat[]
  lowStockVariants: LowStockItem[]
}

export interface StatisticsFilters {
  categoryId?: number
  brandId?: number
  orderType?: 'ONLINE' | 'POS'
  paymentMethod?: 'COD' | 'VNPAY' | 'BANK_TRANSFER' | 'MOMO'
}

export async function getStatisticsApi(
  from: string,
  to: string,
  topProductLimit = 5,
  filters: StatisticsFilters = {},
) {
  const { data } = await apiClient.get<StatisticsResponse>('/admin/statistics', {
    params: { from, to, topProductLimit, ...filters },
  })
  return data
}