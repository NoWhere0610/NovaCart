import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyOrdersApi, type OrderDto, type OrderStatus } from '../api/orderApi'
import BackButton from '../components/BackButton'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã huỷ',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  SHIPPING: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-stone-200 text-stone-600',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyOrdersApi(0, 20)
      .then((res) => setOrders(res.content))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <BackButton />
        <h1 className="text-2xl font-semibold text-stone-900 mb-6">Đơn hàng của tôi</h1>

        {loading ? (
          <p className="text-stone-500">Đang tải...</p>
        ) : orders.length === 0 ? (
          <div className="bg-white border border-stone-200 p-10 text-center">
            <p className="text-stone-500 mb-4">Bạn chưa có đơn hàng nào.</p>
            <Link to="/" className="text-orange-700 font-medium underline">
              Mua sắm ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.orderId}
                to={`/orders/${order.orderId}`}
                className="block bg-white border border-stone-200 p-4 hover:border-stone-400 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-stone-900">Đơn hàng #{order.orderId}</span>
                  <span className={`text-xs px-2 py-1 ${STATUS_COLOR[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
                <p className="text-sm text-stone-500">
                  {new Date(order.createdAt).toLocaleString('vi-VN')}
                </p>
                <p className="text-sm font-medium text-stone-900 mt-1">{formatVnd(order.totalAmount)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}