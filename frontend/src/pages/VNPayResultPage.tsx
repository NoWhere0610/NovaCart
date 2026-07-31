import { Link, useSearchParams } from 'react-router-dom'

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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          )}
        </div>

        <h1 className="text-lg font-semibold text-stone-900 mb-2">
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
            className="inline-block bg-orange-700 hover:bg-orange-600 text-white text-sm font-semibold px-6 py-2.5"
          >
            Xem chi tiết đơn hàng
          </Link>
        )}
      </div>
    </div>
  )
}