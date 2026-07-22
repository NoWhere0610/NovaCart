import { useEffect, useState } from 'react'
import {
  getAdminOrdersApi,
  updateAdminOrderStatusApi,
  type AdminOrderDto,
} from '../api/adminApi'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã huỷ',
}

// Khớp CHÍNH XÁC với ALLOWED_TRANSITIONS bên AdminOrderService — chỉ hiện
// nút chuyển sang trạng thái mà backend THỰC SỰ cho phép
const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderDto[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  async function loadOrders() {
    setLoading(true)
    try {
      const res = await getAdminOrdersApi(statusFilter, 0, 50)
      setOrders(res.content)
    } finally {
      setLoading(false)
    }
  }

  async function handleChangeStatus(orderId: number, newStatus: string) {
    setBusyId(orderId)
    try {
      await updateAdminOrderStatusApi(orderId, newStatus)
      await loadOrders()
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Không thể cập nhật trạng thái')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Quản lý đơn hàng</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-stone-500">Đang tải...</p>
      ) : (
        <div className="bg-white border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-left text-stone-500">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Tổng tiền</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ngày đặt</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((o) => (
                <tr key={o.orderId}>
                  <td className="px-4 py-3 font-medium">#{o.orderId}</td>
                  <td className="px-4 py-3">
                    {o.buyerUsername}
                    <div className="text-xs text-stone-400">{o.buyerEmail}</div>
                  </td>
                  <td className="px-4 py-3">{formatVnd(o.totalAmount)}</td>
                  <td className="px-4 py-3">{STATUS_LABEL[o.status]}</td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(o.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {NEXT_STATUS[o.status]?.map((next) => (
                        <button
                          key={next}
                          disabled={busyId === o.orderId}
                          onClick={() => handleChangeStatus(o.orderId, next)}
                          className="text-xs border border-stone-300 px-2 py-1 hover:border-stone-900 disabled:opacity-50"
                        >
                          → {STATUS_LABEL[next]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                    Không có đơn hàng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}