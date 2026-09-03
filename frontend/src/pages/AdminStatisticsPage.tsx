import { useEffect, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getStatisticsApi, type StatisticsResponse } from '../api/statisticsApi'
import { getAdminBrandsApi, getAdminCategoriesApi, type AdminBrandDto, type AdminCategoryDto } from '../api/adminApi'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

// Đúng màu accent đang dùng sẵn cho khu vực quản trị (nav active, ô doanh thu nổi bật) -- không phải
// gold của trang khách hàng, 2 khu vực cố tình khác tông theo thiết kế đã có từ trước.
const ADMIN_ACCENT = '#c2410c' // orange-700
const GRID_COLOR = '#e7e5e4' // stone-200

const PAYMENT_LABEL: Record<string, string> = {
  COD: 'Tiền mặt / COD',
  VNPAY: 'VNPay',
  BANK_TRANSFER: 'Chuyển khoản',
  MOMO: 'Momo',
}

// Gắn CỐ ĐỊNH theo từng phương thức (không cycle theo thứ tự mảng) -- đã chạy qua validator (chroma,
// tách biệt CVD, tương phản nền) đều pass. Phương thức lạ (nếu có sau này) rơi về FALLBACK_COLOR.
const PAYMENT_COLOR: Record<string, string> = {
  COD: '#c2410c',
  VNPAY: '#2563eb',
  BANK_TRANSFER: '#059669',
  MOMO: '#7c3aed',
}
const FALLBACK_COLOR = '#a8a29e'

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

// Nút chọn nhanh khoảng ngày -- các trang quản trị bán hàng lớn (Shopee Seller Center, Sapo,
// Haravan...) đều có sẵn để khỏi phải tự gõ ngày mỗi lần xem báo cáo.
type QuickRangeKey =
  | 'today'
  | '7d'
  | '30d'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'thisYear'
  | 'lastYear'

function computeQuickRange(key: QuickRangeKey): { from: string; to: string } {
  const today = new Date()
  const quarterOf = (m: number) => Math.floor(m / 3)
  switch (key) {
    case 'today':
      return { from: toIsoDate(today), to: toIsoDate(today) }
    case '7d': {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    }
    case '30d': {
      const start = new Date(today)
      start.setDate(today.getDate() - 29)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    }
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: toIsoDate(start), to: toIsoDate(end) }
    }
    case 'thisQuarter': {
      const start = new Date(today.getFullYear(), quarterOf(today.getMonth()) * 3, 1)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    }
    case 'lastQuarter': {
      const currentQuarterStartMonth = quarterOf(today.getMonth()) * 3
      const start = new Date(today.getFullYear(), currentQuarterStartMonth - 3, 1)
      const end = new Date(today.getFullYear(), currentQuarterStartMonth, 0)
      return { from: toIsoDate(start), to: toIsoDate(end) }
    }
    case 'thisYear': {
      const start = new Date(today.getFullYear(), 0, 1)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    }
    case 'lastYear': {
      const start = new Date(today.getFullYear() - 1, 0, 1)
      const end = new Date(today.getFullYear() - 1, 11, 31)
      return { from: toIsoDate(start), to: toIsoDate(end) }
    }
  }
}

const QUICK_RANGES: { key: QuickRangeKey; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'thisMonth', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
  { key: 'thisQuarter', label: 'Quý này' },
  { key: 'lastQuarter', label: 'Quý trước' },
  { key: 'thisYear', label: 'Năm nay' },
  { key: 'lastYear', label: 'Năm trước' },
]

function formatPercent(p: number | null) {
  if (p == null) return null
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}

function TrendBadge({ percent }: { percent: number | null }) {
  const text = formatPercent(percent)
  if (text == null) return null
  const positive = percent! >= 0
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-700' : 'text-red-600'}`}>
      {positive ? '▲' : '▼'} {text}
      <span className="text-stone-400 font-normal"> so với kỳ trước</span>
    </span>
  )
}

function exportCsv(data: StatisticsResponse) {
  const lines: string[] = []
  lines.push('Ngày,Doanh thu,Hoàn trả,Số đơn')
  data.revenueByDay.forEach((r) => {
    lines.push(`${r.date},${r.revenue},${r.returnedRevenue},${r.orderCount}`)
  })
  lines.push('')
  lines.push('Sản phẩm bán chạy,Số lượng bán,Doanh thu')
  data.topProducts.forEach((p) => {
    lines.push(`${p.productName},${p.quantitySold},${p.revenue}`)
  })
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `thong-ke-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Tooltip dùng chung cho các biểu đồ doanh thu -- format đúng VNĐ thay vì số thô Recharts tự hiện.
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-stone-200 shadow-md px-3 py-2 text-xs">
      <p className="font-medium text-stone-900 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-stone-600">
          {p.name}: <span className="font-medium text-stone-900">{formatVnd(Math.abs(p.value))}</span>
        </p>
      ))}
    </div>
  )
}

// Tooltip riêng cho biểu đồ tròn -- kèm % tỷ trọng (đúng "câu chuyện" của pie: tỷ lệ trong tổng thể).
function PaymentPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-white border border-stone-200 shadow-md px-3 py-2 text-xs">
      <p className="font-medium text-stone-900">{p.name}</p>
      <p className="text-stone-600">
        {formatVnd(p.value)} <span className="text-stone-400">({(p.payload.percent * 100).toFixed(0)}%)</span>
      </p>
    </div>
  )
}

export default function AdminStatisticsPage() {
  const today = new Date()
  const monthAgo = new Date()
  monthAgo.setDate(today.getDate() - 29)

  const [from, setFrom] = useState(toIsoDate(monthAgo))
  const [to, setTo] = useState(toIsoDate(today))
  const [activeQuickRange, setActiveQuickRange] = useState<QuickRangeKey | null>('30d')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [orderType, setOrderType] = useState<'' | 'ONLINE' | 'POS'>('')
  const [paymentMethod, setPaymentMethod] = useState<'' | 'COD' | 'VNPAY' | 'BANK_TRANSFER' | 'MOMO'>('')
  const [categories, setCategories] = useState<AdminCategoryDto[]>([])
  const [brands, setBrands] = useState<AdminBrandDto[]>([])
  const [data, setData] = useState<StatisticsResponse | null>(null)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
    // Chỉ lấy danh mục LÁ (có parentId) -- danh mục cha chỉ là nhóm tiêu đề, không gán trực tiếp cho
    // sản phẩm nào nên lọc theo nó sẽ luôn ra 0 kết quả.
    getAdminCategoriesApi()
      .then((cats) => setCategories(cats.filter((c) => c.parentId !== null)))
      .catch(() => {})
    getAdminBrandsApi()
      .then(setBrands)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load(fromOverride?: string, toOverride?: string) {
    setLoading(true)
    setError(null)
    try {
      setData(
        await getStatisticsApi(fromOverride ?? from, toOverride ?? to, 5, {
          categoryId: categoryId ? Number(categoryId) : undefined,
          brandId: brandId ? Number(brandId) : undefined,
          orderType: orderType || undefined,
          paymentMethod: paymentMethod || undefined,
        }),
      )
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể tải dữ liệu thống kê. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function applyQuickRange(key: QuickRangeKey) {
    const range = computeQuickRange(key)
    setActiveQuickRange(key)
    setFrom(range.from)
    setTo(range.to)
    load(range.from, range.to)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => applyQuickRange(r.key)}
            className={`text-xs px-3 py-1.5 border ${
              activeQuickRange === r.key
                ? 'bg-stone-900 border-stone-900 text-white'
                : 'border-stone-300 text-stone-600 hover:border-stone-900'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Từ ngày</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setActiveQuickRange(null)
            }}
            className="border border-stone-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Đến ngày</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setActiveQuickRange(null)
            }}
            className="border border-stone-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Danh mục</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="border border-stone-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.categoryName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Thương hiệu</label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="border border-stone-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tất cả thương hiệu</option>
            {brands.map((b) => (
              <option key={b.brandId} value={b.brandId}>
                {b.brandName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Kênh bán</label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as '' | 'ONLINE' | 'POS')}
            className="border border-stone-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tất cả kênh</option>
            <option value="ONLINE">Online</option>
            <option value="POS">Tại quầy (POS)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Thanh toán</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            className="border border-stone-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tất cả phương thức</option>
            <option value="COD">Tiền mặt / COD</option>
            <option value="VNPAY">VNPay</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
            <option value="MOMO">Momo</option>
          </select>
        </div>
        <button
          onClick={() => load()}
          className="bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2"
        >
          Xem thống kê
        </button>
        {data && (
          <button
            onClick={() => exportCsv(data)}
            className="border border-stone-300 hover:border-stone-900 text-sm px-4 py-2"
          >
            Xuất CSV
          </button>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-stone-200 p-4 h-20 bg-stone-100" />
          ))}
        </div>
      ) : (
        <>
          {/* Ô số liệu tổng quan -- tách rõ Doanh thu gộp / Hoàn trả / Doanh thu thuần thay vì gộp
              chung 1 số có thể âm khó hiểu. */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <SummaryCard
              label="Doanh thu gộp"
              value={formatVnd(data.summary.completedRevenue)}
              highlight
              trend={<TrendBadge percent={data.periodComparison.revenueChangePercent} />}
            />
            <SummaryCard label="Hoàn trả" value={`-${formatVnd(data.summary.returnedRevenue)}`} negative />
            <SummaryCard
              label="Doanh thu thuần"
              value={formatVnd(data.summary.totalRevenue)}
              negative={data.summary.totalRevenue < 0}
            />
            <SummaryCard
              label="Số đơn thành công"
              value={String(data.summary.totalOrders)}
              trend={<TrendBadge percent={data.periodComparison.orderCountChangePercent} />}
            />
            <SummaryCard label="Giá trị đơn TB" value={formatVnd(data.summary.averageOrderValue)} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <SummaryCard
              label="Đơn huỷ"
              value={String(data.summary.cancelledOrders)}
            />
            <SummaryCard
              label="Đơn trả hàng (đã hoàn + đang chờ)"
              value={String(data.summary.returnedOrders)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="border border-stone-200 p-4">
              <p className="text-xs text-stone-500 mb-1">Bán online</p>
              <p className="text-lg font-semibold text-stone-900">{data.summary.onlineOrders} đơn</p>
              <p className="text-sm text-stone-500">{formatVnd(data.summary.onlineRevenue)}</p>
            </div>
            <div className="border border-stone-200 p-4">
              <p className="text-xs text-stone-500 mb-1">Bán tại quầy (POS)</p>
              <p className="text-lg font-semibold text-stone-900">{data.summary.posOrders} đơn</p>
              <p className="text-sm text-stone-500">{formatVnd(data.summary.posRevenue)}</p>
            </div>
          </div>

          {/* Doanh thu theo ngày -- 2 cột riêng biệt: cam = doanh thu (COMPLETED), đỏ = hoàn trả (vẽ
              ÂM để tụt xuống dưới trục 0). Tách riêng để hoàn trả hiện rõ là "Hoàn trả" có chủ đích,
              không phải 1 con số âm trông giống lỗi. */}
          <div className="border border-stone-200 p-4 mb-8">
            <p className="text-sm font-semibold text-stone-900 mb-4">Doanh thu theo ngày</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.revenueByDay.map((r) => ({ ...r, returnedRevenueNeg: -r.returnedRevenue }))}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={{ stroke: GRID_COLOR }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    (Math.abs(v) >= 1000000 ? `${v / 1000000}tr` : Math.abs(v) >= 1000 ? `${v / 1000}k` : v)
                  }
                  width={40}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(194,65,12,0.06)' }} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-stone-600">{value}</span>}
                />
                <Bar dataKey="revenue" name="Doanh thu" fill={ADMIN_ACCENT} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="returnedRevenueNeg" name="Hoàn trả" fill="#dc2626" radius={[0, 0, 4, 4]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Doanh thu theo danh mục + Phương thức thanh toán */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="border border-stone-200 p-4">
              <p className="text-sm font-semibold text-stone-900 mb-4">Doanh thu theo danh mục</p>
              {data.revenueByCategory.length === 0 ? (
                <p className="text-sm text-stone-400 py-6 text-center">Chưa có dữ liệu</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(140, data.revenueByCategory.length * 36)}>
                  <BarChart
                    data={data.revenueByCategory}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid horizontal={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#78716c' }}
                      tickLine={false}
                      axisLine={{ stroke: GRID_COLOR }}
                      tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}tr` : v >= 1000 ? `${v / 1000}k` : v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="categoryName"
                      tick={{ fontSize: 11, fill: '#44403c' }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(194,65,12,0.06)' }} />
                    <Bar dataKey="revenue" name="Doanh thu" fill={ADMIN_ACCENT} radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="border border-stone-200 p-4">
              <p className="text-sm font-semibold text-stone-900 mb-4">Phương thức thanh toán</p>
              {data.paymentMethodBreakdown.length === 0 ? (
                <p className="text-sm text-stone-400 py-6 text-center">Chưa có dữ liệu</p>
              ) : (
                (() => {
                  const total = data.paymentMethodBreakdown.reduce((sum, p) => sum + p.revenue, 0) || 1
                  const pieData = data.paymentMethodBreakdown.map((p) => ({
                    ...p,
                    label: PAYMENT_LABEL[p.paymentMethod] ?? p.paymentMethod,
                    percent: p.revenue / total,
                  }))
                  return (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="revenue"
                          nameKey="label"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          strokeWidth={2}
                          stroke="#fff"
                        >
                          {pieData.map((entry) => (
                            <Cell
                              key={entry.paymentMethod}
                              fill={PAYMENT_COLOR[entry.paymentMethod] ?? FALLBACK_COLOR}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PaymentPieTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span className="text-xs text-stone-600">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )
                })()
              )}
            </div>
          </div>

          {/* Cảnh báo tồn kho thấp -- KHÔNG phụ thuộc khoảng ngày đang xem, luôn là tồn kho hiện tại */}
          <div className="border border-stone-200 p-4 mb-8">
            <p className="text-sm font-semibold text-stone-900 mb-4">Cảnh báo tồn kho thấp</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-stone-500 border-b border-stone-200">
                  <th className="py-2 font-normal">Sản phẩm</th>
                  <th className="py-2 font-normal">Size / Màu</th>
                  <th className="py-2 font-normal text-right">Còn lại</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStockVariants.map((v, i) => (
                  <tr key={i} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 text-stone-900">{v.productName}</td>
                    <td className="py-2 text-stone-600">
                      {v.size} / {v.color}
                    </td>
                    <td className="py-2 text-right font-medium text-red-600">{v.stockQuantity}</td>
                  </tr>
                ))}
                {data.lowStockVariants.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-stone-400">
                      Không có biến thể nào sắp hết hàng
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Top sản phẩm bán chạy */}
          <div className="border border-stone-200 p-4">
            <p className="text-sm font-semibold text-stone-900 mb-4">Sản phẩm bán chạy</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-stone-500 border-b border-stone-200">
                  <th className="py-2 font-normal">Sản phẩm</th>
                  <th className="py-2 font-normal text-right">Số lượng bán</th>
                  <th className="py-2 font-normal text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.productName} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 text-stone-900">{p.productName}</td>
                    <td className="py-2 text-right text-stone-600">{p.quantitySold}</td>
                    <td className="py-2 text-right text-stone-900 font-medium">{formatVnd(p.revenue)}</td>
                  </tr>
                ))}
                {data.topProducts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-stone-400">
                      Chưa có dữ liệu bán hàng trong khoảng thời gian này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  highlight,
  negative,
  trend,
}: {
  label: string
  value: string
  highlight?: boolean
  negative?: boolean
  trend?: ReactNode
}) {
  return (
    <div
      className={`border p-4 ${
        highlight ? 'border-orange-700 bg-orange-50' : negative ? 'border-red-200 bg-red-50' : 'border-stone-200'
      }`}
    >
      <p className="text-xs text-stone-500 mb-1">{label}</p>
      <p
        className={`text-lg font-semibold ${
          highlight ? 'text-orange-700' : negative ? 'text-red-600' : 'text-stone-900'
        }`}
      >
        {value}
      </p>
      {trend && <div className="mt-1">{trend}</div>}
    </div>
  )
}
