import { apiClient } from './apiClient'

export interface StatisticsSummary {
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  onlineOrders: number
  posOrders: number
  onlineRevenue: number
  posRevenue: number
  cancelledOrders: number
  returnedOrders: number
}

export interface RevenuePoint {
  date: string
  revenue: number
  orderCount: number
}

export interface TopProduct {
  productName: string
  quantitySold: number
  revenue: number
}

export interface StatisticsResponse {
  summary: StatisticsSummary
  revenueByDay: RevenuePoint[]
  topProducts: TopProduct[]
}

export async function getStatisticsApi(from: string, to: string, topProductLimit = 5) {
  const { data } = await apiClient.get<StatisticsResponse>('/admin/statistics', {
    params: { from, to, topProductLimit },
  })
  return data
}