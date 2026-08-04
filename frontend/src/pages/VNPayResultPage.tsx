import { Link, useSearchParams } from 'react-router-dom'
import { IconCheck, IconX } from '@tabler/icons-react'

export default function VNPayResultPage() {
  const [params] = useSearchParams()
  const status = params.get('status')
  const orderId = params.get('orderId')
  const success = status === 'success'

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="max-w-md w-full bg-white border border-stone-200 p-8 text-center">
        <div
          className={`mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center ${
            success ? 'bg-green-100' : 'bg-red-100'
          }`}
        >
          {success ? (
            <IconCheck size={28} stroke={2.5} color="#15803d" />
          ) : (
            <IconX size={28} stroke={2.5} color="#b91c1c" />
          )}
        </div>

        <h1 className="font-display text-lg font-semibold text-stone-900 mb-2">
          {success ? 'Thanh toán thành công' : 'Thanh toán không thành công'}
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          {success
            ? 'Cảm ơn bạn! Đơn hàng đã được ghi nhận thanh toán qua VNPay.'
            : 'Giao dịch bị huỷ hoặc thất bại. Bạn có thể thử thanh toán lại trong trang chi tiết đơn hàng.'}
        </p>

        {orderId && (
          <Link
            to={`/orders/${orderId}`}
            className="inline-block bg-stone-900 border-gold-metallic gold-glow text-white text-sm font-semibold px-6 py-2.5"
          >
            Xem chi tiết đơn hàng
          </Link>
        )}
      </div>
    </div>
  )
}