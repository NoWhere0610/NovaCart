import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { cancelOrderApi, getMyOrdersApi, type OrderDto, type OrderStatus } from '../api/orderApi'
import BackButton from '../components/BackButton'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ thanh toán',
  CONFIRMED: 'Chờ vận chuyển',
  SHIPPING: 'Chờ nhận hàng',
  DELIVERED: 'Cần đánh giá',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
  RETURN_REQUESTED: 'Đang xử lý trả hàng',
  RETURNED: 'Đã trả hàng/hoàn tiền',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  SHIPPING: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-stone-200 text-stone-600',
  RETURN_REQUESTED: 'bg-red-100 text-red-700',
  RETURNED: 'bg-red-100 text-red-700',
}

// Các tab hiển thị, đúng theo yêu cầu: Tất cả -> Chờ thanh toán -> Chờ vận
// chuyển -> Chờ nhận hàng -> Cần đánh giá -> Hoàn thành -> Trả hàng -> Đã huỷ
type TabKey = 'ALL' | 'RETURN' | OrderStatus
const TABS: { key: TabKey; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ thanh toán' },
  { key: 'CONFIRMED', label: 'Chờ vận chuyển' },
  { key: 'SHIPPING', label: 'Chờ nhận hàng' },
  { key: 'DELIVERED', label: 'Cần đánh giá' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
  { key: 'RETURN', label: 'Trả hàng/Hoàn tiền' },
  { key: 'CANCELLED', label: 'Đã huỷ' },
]

function matchesTab(order: OrderDto, tab: TabKey): boolean {
  if (tab === 'ALL') return true
  if (tab === 'RETURN') return order.status === 'RETURN_REQUESTED' || order.status === 'RETURNED'
  return order.status === tab
}

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabKey) || 'ALL'

  const [orders, setOrders] = useState<OrderDto[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await getMyOrdersApi(0, 100)
      setOrders(res.content)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => orders.filter((o) => matchesTab(o, activeTab)), [orders, activeTab])

  async function handleCancel(orderId: number) {
    if (!confirm('Bạn chắc chắn muốn huỷ đơn hàng này?')) return
    setBusyId(orderId)
    try {
      const updated = await cancelOrderApi(orderId)
      setOrders((prev) => prev.map((o) => (o.orderId === orderId ? updated : o)))
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Không thể huỷ đơn hàng')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <BackButton />
        <h1 className="text-2xl font-semibold text-stone-900 mb-6">Đơn hàng của tôi</h1>

        <div className="bg-white border border-stone-200 mb-4 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map((t) => {
              const count = orders.filter((o) => matchesTab(o, t.key)).length
              const active = activeTab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setSearchParams(t.key === 'ALL' ? {} : { tab: t.key })}
                  className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'border-orange-600 text-orange-700 font-semibold'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {t.label}
                  {count > 0 && <span className="ml-1.5 text-xs text-stone-400">({count})</span>}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <p className="text-stone-500">Đang tải...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 p-10 text-center">
            <p className="text-stone-500 mb-4">Không có đơn hàng nào trong mục này.</p>
            <Link to="/" className="text-orange-700 font-medium underline">
              Mua sắm ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED'
              const needsReview = order.status === 'DELIVERED'
              return (
                <div key={order.orderId} className="bg-white border border-stone-200 hover:border-stone-400 transition-colors">
                  <Link to={`/orders/${order.orderId}`} className="block p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-stone-900">Đơn hàng #{order.orderId}</span>
                      <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[order.status]}`}>
                        {STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500">{new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                    <p className="text-sm font-medium text-stone-900 mt-1">{formatVnd(order.totalAmount)}</p>
                  </Link>

                  {(canCancel || needsReview) && (
                    <div className="border-t border-stone-100 px-4 py-2.5 flex justify-end gap-2">
                      {canCancel && (
                        <button
                          disabled={busyId === order.orderId}
                          onClick={() => handleCancel(order.orderId)}
                          className="text-xs border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5"
                        >
                          {busyId === order.orderId ? 'Đang huỷ...' : 'Huỷ đơn'}
                        </button>
                      )}
                      {needsReview && (
                        <Link
                          to={`/orders/${order.orderId}`}
                          className="text-xs bg-orange-700 hover:bg-orange-600 text-white px-3 py-1.5 font-medium"
                        >
                          Đánh giá ngay
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}