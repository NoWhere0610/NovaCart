import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { getStatisticsApi, type RevenuePoint, type StatisticsResponse } from '../api/statisticsApi'
import { getAdminBrandsApi, getAdminCategoriesApi, type AdminBrandDto, type AdminCategoryDto } from '../api/adminApi'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

// Đúng màu accent đang dùng sẵn cho khu vực quản trị (nav active, ô doanh thu nổi bật) -- không phải
// gold của trang khách hàng, 2 khu vực cố tình khác tông theo thiết kế đã có từ trước.
const ADMIN_ACCENT = '#c2410c' // orange-700
const GRID_COLOR = '#e7e5e4' // stone-200

// Khớp AdminInventoryService.LOW_STOCK_THRESHOLD / AdminStatisticsService bên backend.
const LOW_STOCK_THRESHOLD = 5

const PAYMENT_LABEL: Record<string, string> = {
  COD: 'Tiền mặt / COD',
  VNPAY: 'VNPay',
  BANK_TRANSFER: 'Chuyển khoản',
}

// Gắn CỐ ĐỊNH theo từng phương thức (không cycle theo thứ tự mảng) -- đã chạy qua validator (chroma,
// tách biệt CVD, tương phản nền) đều pass. Phương thức lạ (nếu có sau này) rơi về FALLBACK_COLOR.
const PAYMENT_COLOR: Record<string, string> = {
  COD: '#c2410c',
  VNPAY: '#2563eb',
  BANK_TRANSFER: '#059669',
}
const FALLBACK_COLOR = '#a8a29e'

// Định dạng ngày theo GIỜ ĐỊA PHƯƠNG. KHÔNG dùng toISOString() -- hàm đó đổi sang UTC, mà Việt Nam là
// UTC+7 nên new Date(2026, 8, 1) (0h ngày 1/9 giờ VN) sẽ thành "2026-08-31". Toàn bộ nút chọn nhanh
// (Tháng này/Tháng trước/Quý/Năm) vì thế từng bị lệch đúng 1 ngày về trước.
function toIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "2026-09-03" -> "03/09" (hiển thị trong biểu đồ/tooltip cho người Việt đọc). */
function formatDayMonth(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** "2026-09-03" -> "03/09/2026" (dùng ở nhãn khoảng ngày đang xem). */
function formatFullDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
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

type ChartPoint = { label: string; revenue: number; returnedRevenue: number; orderCount: number }

/**
 * Gộp dữ liệu ngày thành tuần/tháng khi khoảng xem quá dài. Chọn "Năm nay" sinh ~365 cặp cột trong ~1000px
 * (mỗi cột dưới 1,5px) -- thành một vệt màu đặc, không đọc được gì. Ngưỡng chọn theo số cột còn đọc được.
 */
function buildChartData(points: RevenuePoint[]): { data: ChartPoint[]; granularity: 'day' | 'week' | 'month' } {
  if (points.length <= 62) {
    return {
      granularity: 'day',
      data: points.map((p) => ({
        label: formatDayMonth(p.date),
        revenue: p.revenue,
        returnedRevenue: p.returnedRevenue,
        orderCount: p.orderCount,
      })),
    }
  }

  const monthly = points.length > 186
  const buckets = new Map<string, ChartPoint>()
  for (const p of points) {
    const d = new Date(`${p.date}T00:00:00`)
    let key: string
    let label: string
    if (monthly) {
      key = p.date.slice(0, 7)
      label = `${key.slice(5)}/${key.slice(0, 4)}`
    } else {
      // Mốc đầu tuần (thứ 2) làm khoá gộp.
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      key = toIsoDate(monday)
      label = formatDayMonth(key)
    }
    const current = buckets.get(key)
    if (current) {
      current.revenue += p.revenue
      current.returnedRevenue += p.returnedRevenue
      current.orderCount += p.orderCount
    } else {
      buckets.set(key, {
        label,
        revenue: p.revenue,
        returnedRevenue: p.returnedRevenue,
        orderCount: p.orderCount,
      })
    }
  }
  return { granularity: monthly ? 'month' : 'week', data: Array.from(buckets.values()) }
}

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

/** Bọc 1 ô CSV: nhân đôi dấu nháy kép rồi bọc cả chuỗi -- tên sản phẩm có dấu phẩy (vd "Áo sơ mi trắng,
 *  tay dài") nếu ghi thẳng sẽ đẩy lệch toàn bộ cột phía sau khi mở bằng Excel. */
function csvCell(value: string | number) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function exportCsv(data: StatisticsResponse, context: { from: string; to: string; filters: string[] }) {
  const lines: string[] = []
  // Ghi kèm ngữ cảnh -- mở lại file sau vài tuần vẫn biết đây là báo cáo khoảng nào, lọc những gì.
  lines.push([csvCell('Khoảng ngày'), csvCell(`${formatFullDate(context.from)} - ${formatFullDate(context.to)}`)].join(','))
  lines.push([csvCell('Bộ lọc'), csvCell(context.filters.length > 0 ? context.filters.join(' | ') : 'Không lọc')].join(','))
  lines.push('')

  lines.push(['Tổng quan', 'Giá trị'].map(csvCell).join(','))
  lines.push([csvCell('Doanh thu gộp'), csvCell(data.summary.completedRevenue)].join(','))
  lines.push([csvCell('Hoàn trả'), csvCell(data.summary.returnedRevenue)].join(','))
  lines.push([csvCell('Doanh thu thuần'), csvCell(data.summary.totalRevenue)].join(','))
  lines.push([csvCell('Số đơn thành công'), csvCell(data.summary.totalOrders)].join(','))
  lines.push([csvCell('Giá trị đơn TB'), csvCell(data.summary.averageOrderValue)].join(','))
  lines.push('')

  lines.push(['Ngày', 'Doanh thu', 'Hoàn trả', 'Số đơn'].map(csvCell).join(','))
  data.revenueByDay.forEach((r) => {
    lines.push([r.date, r.revenue, r.returnedRevenue, r.orderCount].map(csvCell).join(','))
  })
  lines.push('')

  lines.push(['Sản phẩm bán chạy', 'Số lượng bán', 'Doanh thu'].map(csvCell).join(','))
  data.topProducts.forEach((p) => {
    lines.push([p.productName, p.quantitySold, p.revenue].map(csvCell).join(','))
  })
  lines.push('')

  lines.push(['Doanh thu theo danh mục', 'Số lượng bán', 'Doanh thu'].map(csvCell).join(','))
  data.revenueByCategory.forEach((c) => {
    lines.push([c.categoryName, c.quantitySold, c.revenue].map(csvCell).join(','))
  })

  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  // Đặt tên theo ĐÚNG khoảng đang xem -- dùng ngày hôm nay thì xuất 3 kỳ khác nhau ra 3 file trùng tên.
  link.download = `thong-ke_${context.from}_den_${context.to}.csv`
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

/** Rút gọn trục tiền: 1.250.000 -> "1,3tr". Có làm tròn, không thì ra "1.234567tr" tràn khỏi trục. */
function formatAxisMoney(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.0', '')}tr`
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`
  return String(v)
}

type Filters = {
  from: string
  to: string
  categoryId: string
  brandId: string
  orderType: '' | 'ONLINE' | 'POS'
  paymentMethod: '' | 'COD' | 'VNPAY' | 'BANK_TRANSFER'
}

export default function AdminStatisticsPage() {
  const initialRange = computeQuickRange('30d')

  const [form, setForm] = useState<Filters>({
    from: initialRange.from,
    to: initialRange.to,
    categoryId: '',
    brandId: '',
    orderType: '',
    paymentMethod: '',
  })
  // Bộ lọc THỰC SỰ đang được phản ánh bởi dữ liệu đang hiển thị -- để biết form có bị sửa mà chưa bấm
  // "Xem thống kê" hay không (nếu không có cái này, người xem dễ đọc số của bộ lọc cũ mà tưởng là số mới).
  const [applied, setApplied] = useState<Filters>(form)
  const [activeQuickRange, setActiveQuickRange] = useState<QuickRangeKey | null>('30d')
  const [categories, setCategories] = useState<AdminCategoryDto[]>([])
  const [brands, setBrands] = useState<AdminBrandDto[]>([])
  const [data, setData] = useState<StatisticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load(form)
    getAdminCategoriesApi().then(setCategories).catch(() => {})
    getAdminBrandsApi().then(setBrands).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Chỉ danh mục LÁ và đang bật: danh mục cha chỉ là nhóm tiêu đề, không gắn trực tiếp sản phẩm nào nên
  // lọc theo nó luôn ra 0₫. Xác định lá bằng "không có danh mục nào nhận mình làm cha" -- dùng
  // parentId !== null như trước sẽ lọt danh mục cấp giữa nếu sau này cây sâu hơn 2 cấp.
  const selectableCategories = useMemo(() => {
    const parentIds = new Set(categories.map((c) => c.parentId).filter((id): id is number => id != null))
    return categories.filter((c) => !parentIds.has(c.categoryId) && c.isActive)
  }, [categories])

  const isDirty = useMemo(
    () => (Object.keys(form) as (keyof Filters)[]).some((k) => form[k] !== applied[k]),
    [form, applied],
  )

  const appliedFilterLabels = useMemo(() => {
    const labels: string[] = []
    if (applied.categoryId) {
      labels.push(`Danh mục: ${categories.find((c) => String(c.categoryId) === applied.categoryId)?.categoryName ?? applied.categoryId}`)
    }
    if (applied.brandId) {
      labels.push(`Thương hiệu: ${brands.find((b) => String(b.brandId) === applied.brandId)?.brandName ?? applied.brandId}`)
    }
    if (applied.orderType) labels.push(`Kênh: ${applied.orderType === 'ONLINE' ? 'Online' : 'Tại quầy (POS)'}`)
    if (applied.paymentMethod) labels.push(`Thanh toán: ${PAYMENT_LABEL[applied.paymentMethod]}`)
    return labels
  }, [applied, categories, brands])

  async function load(next: Filters) {
    setLoading(true)
    setError(null)
    try {
      const res = await getStatisticsApi(next.from, next.to, 5, {
        categoryId: next.categoryId ? Number(next.categoryId) : undefined,
        brandId: next.brandId ? Number(next.brandId) : undefined,
        orderType: next.orderType || undefined,
        paymentMethod: next.paymentMethod || undefined,
      })
      setData(res)
      setApplied(next)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể tải dữ liệu thống kê. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function applyQuickRange(key: QuickRangeKey) {
    const range = computeQuickRange(key)
    const next = { ...form, from: range.from, to: range.to }
    setActiveQuickRange(key)
    setForm(next)
    load(next)
  }

  function resetFilters() {
    const range = computeQuickRange('30d')
    const next: Filters = {
      from: range.from,
      to: range.to,
      categoryId: '',
      brandId: '',
      orderType: '',
      paymentMethod: '',
    }
    setActiveQuickRange('30d')
    setForm(next)
    load(next)
  }

  const chart = useMemo(
    () => (data ? buildChartData(data.revenueByDay) : { data: [], granularity: 'day' as const }),
    [data],
  )

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
        <h1 className="text-2xl font-semibold text-stone-900">Thống kê bán hàng</h1>
        <p className="text-sm text-stone-500">
          Đang xem: <span className="font-medium text-stone-700">{formatFullDate(applied.from)} – {formatFullDate(applied.to)}</span>
          {appliedFilterLabels.length > 0 && <span className="text-stone-400"> · {appliedFilterLabels.join(' · ')}</span>}
        </p>
      </div>
      <p className="text-sm text-stone-500 mb-5">
        Doanh thu gộp gồm cả đơn sau đó bị trả lại; doanh thu thuần là phần tiền shop thực sự còn giữ.
      </p>

      <div className="border border-stone-200 bg-white p-4 mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
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

        {/* Lưới cố định thay vì flex-wrap: các ô lọc luôn thẳng cột, không nhảy chỗ theo bề rộng màn hình. */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Từ ngày</label>
            <input
              type="date"
              value={form.from}
              max={form.to}
              onChange={(e) => {
                setForm({ ...form, from: e.target.value })
                setActiveQuickRange(null)
              }}
              className="w-full border border-stone-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Đến ngày</label>
            <input
              type="date"
              value={form.to}
              min={form.from}
              onChange={(e) => {
                setForm({ ...form, to: e.target.value })
                setActiveQuickRange(null)
              }}
              className="w-full border border-stone-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Danh mục</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full border border-stone-300 px-2 py-1.5 text-sm"
            >
              <option value="">Tất cả danh mục</option>
              {selectableCategories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.categoryName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Thương hiệu</label>
            <select
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
              className="w-full border border-stone-300 px-2 py-1.5 text-sm"
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
              value={form.orderType}
              onChange={(e) => setForm({ ...form, orderType: e.target.value as Filters['orderType'] })}
              className="w-full border border-stone-300 px-2 py-1.5 text-sm"
            >
              <option value="">Tất cả kênh</option>
              <option value="ONLINE">Online</option>
              <option value="POS">Tại quầy (POS)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Thanh toán</label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as Filters['paymentMethod'] })}
              className="w-full border border-stone-300 px-2 py-1.5 text-sm"
            >
              <option value="">Tất cả phương thức</option>
              <option value="COD">Tiền mặt / COD</option>
              <option value="VNPAY">VNPay</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button
            onClick={() => load(form)}
            disabled={loading}
            className="bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2"
          >
            {loading ? 'Đang tải...' : 'Xem thống kê'}
          </button>
          <button
            onClick={resetFilters}
            disabled={loading}
            className="border border-stone-300 hover:border-stone-900 disabled:opacity-60 text-sm px-4 py-2"
          >
            Đặt lại bộ lọc
          </button>
          {/* Luôn render (chỉ disable) -- render có điều kiện làm hàng nút co lại rồi bung ra mỗi lần tải. */}
          <button
            onClick={() => data && exportCsv(data, { from: applied.from, to: applied.to, filters: appliedFilterLabels })}
            disabled={!data || loading}
            className="border border-stone-300 hover:border-stone-900 disabled:opacity-60 text-sm px-4 py-2"
          >
            Xuất CSV
          </button>
          {isDirty && !loading && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1">
              Bộ lọc đã đổi — số liệu bên dưới vẫn là của lần xem trước, bấm "Xem thống kê" để cập nhật.
            </span>
          )}
        </div>
      </div>

      {/* Lỗi hiện dạng banner, KHÔNG thay thế cả trang -- mất mạng 1 giây mà xoá sạch số liệu đang xem thì
          người dùng tưởng trang hỏng, lại không có cách nào lấy lại ngoài F5. */}
      {error && (
        <div className="flex flex-wrap items-center gap-3 border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 mb-6">
          <span>{error}</span>
          <button onClick={() => load(form)} className="border border-red-300 hover:bg-red-100 px-3 py-1 text-xs">
            Thử lại
          </button>
        </div>
      )}

      {!data ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-stone-200 h-24 bg-stone-100" />
          ))}
        </div>
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* Ô số liệu tổng quan -- tách rõ Doanh thu gộp / Hoàn trả / Doanh thu thuần thay vì gộp
              chung 1 số có thể âm khó hiểu. 5 cột chỉ bật ở xl: vì vùng nội dung đã trừ mất sidebar
              224px, ép 5 cột sớm hơn sẽ làm số tiền dài tràn ra ngoài viền ô. */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            <SummaryCard
              label="Doanh thu gộp"
              value={formatVnd(data.summary.completedRevenue)}
              highlight
              trend={<TrendBadge percent={data.periodComparison.revenueChangePercent} />}
            />
            <SummaryCard
              label="Hoàn trả"
              // Chỉ tô đỏ + dấu trừ khi THỰC SỰ có khoản hoàn -- kỳ không ai trả hàng mà hiện "-0₫" đỏ
              // chói giữa trang thì trạng thái bình thường nhất lại trông như đang có lỗi.
              value={data.summary.returnedRevenue > 0 ? `-${formatVnd(data.summary.returnedRevenue)}` : formatVnd(0)}
              negative={data.summary.returnedRevenue > 0}
            />
            <SummaryCard label="Doanh thu thuần" value={formatVnd(data.summary.totalRevenue)} />
            <SummaryCard
              label="Số đơn thành công"
              value={String(data.summary.totalOrders)}
              trend={<TrendBadge percent={data.periodComparison.orderCountChangePercent} />}
            />
            <SummaryCard label="Giá trị đơn TB" value={formatVnd(data.summary.averageOrderValue)} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <SummaryCard label="Đơn huỷ" value={String(data.summary.cancelledOrders)} />
            <SummaryCard label="Đơn trả hàng (đã hoàn + đang chờ)" value={String(data.summary.returnedOrders)} />
            <SummaryCard
              label="Bán online"
              value={`${data.summary.onlineOrders} đơn`}
              sub={formatVnd(data.summary.onlineRevenue)}
            />
            <SummaryCard
              label="Bán tại quầy (POS)"
              value={`${data.summary.posOrders} đơn`}
              sub={formatVnd(data.summary.posRevenue)}
            />
          </div>

          {/* Doanh thu theo ngày -- 2 cột riêng biệt: cam = doanh thu (ghi vào NGÀY BÁN), đỏ = hoàn trả
              (ghi vào NGÀY HOÀN, vẽ ÂM để tụt xuống dưới trục 0). */}
          <section className="border border-stone-200 bg-white p-4 mb-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-stone-900">Doanh thu theo thời gian</h2>
              <span className="text-xs text-stone-500">
                {chart.granularity === 'day'
                  ? 'Theo ngày'
                  : chart.granularity === 'week'
                  ? 'Gộp theo tuần (khoảng xem dài)'
                  : 'Gộp theo tháng (khoảng xem dài)'}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={chart.data.map((r) => ({ ...r, returnedRevenueNeg: -r.returnedRevenue }))}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={{ stroke: GRID_COLOR }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatAxisMoney}
                  width={48}
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
          </section>

          {/* Doanh thu theo danh mục + Phương thức thanh toán */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8">
            <section className="border border-stone-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-stone-900 mb-4">Doanh thu theo danh mục</h2>
              {data.revenueByCategory.length === 0 ? (
                <p className="text-sm text-stone-400 py-6 text-center">Chưa có dữ liệu</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, data.revenueByCategory.length * 36)}>
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
                      tickFormatter={formatAxisMoney}
                    />
                    <YAxis
                      type="category"
                      dataKey="categoryName"
                      tick={{ fontSize: 11, fill: '#44403c' }}
                      tickLine={false}
                      axisLine={false}
                      width={130}
                    />
                    <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(194,65,12,0.06)' }} />
                    <Bar dataKey="revenue" name="Doanh thu" fill={ADMIN_ACCENT} radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="border border-stone-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-stone-900 mb-4">Phương thức thanh toán</h2>
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
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="revenue"
                          nameKey="label"
                          innerRadius={55}
                          outerRadius={85}
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
            </section>
          </div>

          {/* Top sản phẩm bán chạy */}
          <section className="border border-stone-200 bg-white p-4 mb-8">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Sản phẩm bán chạy</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 border-b border-stone-200">
                    <th className="py-2 font-normal">Sản phẩm</th>
                    <th className="py-2 font-normal text-right w-32">Số lượng bán</th>
                    <th className="py-2 font-normal text-right w-40">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.productName} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 text-stone-900">{p.productName}</td>
                      <td className="py-2 text-right text-stone-600 tabular-nums">{p.quantitySold}</td>
                      <td className="py-2 text-right text-stone-900 font-medium tabular-nums">{formatVnd(p.revenue)}</td>
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
          </section>

          {/* Cảnh báo tồn kho thấp -- KHÔNG phụ thuộc khoảng ngày/bộ lọc đang xem */}
          <section className="border border-stone-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-stone-900">Cảnh báo tồn kho thấp</h2>
            <p className="text-xs text-stone-500 mb-4">
              Tồn kho hiện tại của sản phẩm đang kinh doanh (còn ≤ {LOW_STOCK_THRESHOLD}) — không theo khoảng ngày
              và bộ lọc phía trên.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 border-b border-stone-200">
                    <th className="py-2 font-normal">Sản phẩm</th>
                    <th className="py-2 font-normal w-40">Size / Màu</th>
                    <th className="py-2 font-normal text-right w-28">Còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockVariants.map((v, i) => (
                    <tr key={i} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 text-stone-900">{v.productName}</td>
                      <td className="py-2 text-stone-600">
                        {v.size} / {v.color}
                      </td>
                      <td className="py-2 text-right font-medium text-red-600 tabular-nums">{v.stockQuantity}</td>
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
          </section>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
  negative,
  trend,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  negative?: boolean
  trend?: ReactNode
}) {
  return (
    <div
      className={`border p-4 ${
        highlight ? 'border-orange-700 bg-orange-50' : negative ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'
      }`}
    >
      <p className="text-xs text-stone-500 mb-1">{label}</p>
      {/* break-words + tabular-nums: số tiền lớn (vd 125.000.000₫) trong ô hẹp phải xuống dòng trong ô,
          không được tràn đè sang ô bên cạnh. */}
      <p
        className={`text-lg font-semibold wrap-break-word tabular-nums ${
          highlight ? 'text-orange-700' : negative ? 'text-red-600' : 'text-stone-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-sm text-stone-500 tabular-nums">{sub}</p>}
      {trend && <div className="mt-1">{trend}</div>}
    </div>
  )
}
