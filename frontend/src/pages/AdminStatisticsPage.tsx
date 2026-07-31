import { useEffect, useState } from 'react'
import { getStatisticsApi, type StatisticsResponse } from '../api/statisticsApi'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function AdminStatisticsPage() {
  const today = new Date()
  const monthAgo = new Date()
  monthAgo.setDate(today.getDate() - 29)

  const [from, setFrom] = useState(toIsoDate(monthAgo))
  const [to, setTo] = useState(toIsoDate(today))
  const [data, setData] = useState<StatisticsResponse | null>(null)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      setData(await getStatisticsApi(from, to))
    } finally {
      setLoading(false)
    }
  }

  const maxRevenue = data ? Math.max(1, ...data.revenueByDay.map((p) => p.revenue)) : 1

  return (
    <div>
      <div className="flex items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Từ ngày</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-stone-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Đến ngày</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-stone-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={load}
          className="bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2"
        >
          Xem thống kê
        </button>
      </div>

      {loading || !data ? (
        <p className="text-sm text-stone-400">Đang tải...</p>
      ) : (
        <>
          {/* Ô số liệu tổng quan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <SummaryCard label="Doanh thu" value={formatVnd(data.summary.totalRevenue)} highlight />
            <SummaryCard label="Số đơn thành công" value={String(data.summary.totalOrders)} />
            <SummaryCard label="Giá trị đơn TB" value={formatVnd(data.summary.averageOrderValue)} />
            <SummaryCard
              label="Đơn huỷ / trả hàng"
              value={`${data.summary.cancelledOrders} / ${data.summary.returnedOrders}`}
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

          {/* Biểu đồ doanh thu theo ngày — cột CSS thuần, không cần thư viện chart */}
          <div className="border border-stone-200 p-4 mb-8">
            <p className="text-sm font-semibold text-stone-900 mb-4">Doanh thu theo ngày</p>
            <div className="flex items-end gap-1 h-48">
              {data.revenueByDay.map((p) => (
                <div key={p.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div
                    className="w-full bg-orange-600 hover:bg-orange-500 transition-colors"
                    style={{ height: `${Math.max(2, (p.revenue / maxRevenue) * 100)}%` }}
                    title={`${p.date}: ${formatVnd(p.revenue)} (${p.orderCount} đơn)`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-stone-400 mt-2">
              <span>{data.revenueByDay[0]?.date}</span>
              <span>{data.revenueByDay[data.revenueByDay.length - 1]?.date}</span>
            </div>
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

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border p-4 ${highlight ? 'border-orange-700 bg-orange-50' : 'border-stone-200'}`}>
      <p className="text-xs text-stone-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? 'text-orange-700' : 'text-stone-900'}`}>{value}</p>
    </div>
  )
}