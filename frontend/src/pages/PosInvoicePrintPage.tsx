import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPosInvoiceApi, type PosInvoiceDto } from '../api/posApi'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

const PAYMENT_LABEL: Record<string, string> = {
  COD: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN')
}

/**
 * Trang in hoá đơn POS — cố tình KHÔNG bọc trong AdminLayout (không sidebar/header quản trị), mở ở tab
 * riêng để giữ nguyên màn hình bán hàng, tự bật hộp thoại in ngay khi tải xong dữ liệu.
 */
export default function PosInvoicePrintPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [invoice, setInvoice] = useState<PosInvoiceDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return
    getPosInvoiceApi(Number(orderId))
      .then((inv) => {
        setInvoice(inv)
        // Đợi 1 nhịp render để trình duyệt vẽ xong nội dung trước khi mở hộp thoại in.
        setTimeout(() => window.print(), 200)
      })
      .catch((err) => {
        setError(err.response?.data?.message ?? 'Không tải được hoá đơn')
      })
  }, [orderId])

  if (error) {
    return <p className="p-6 text-sm text-red-600">{error}</p>
  }
  if (!invoice) {
    return <p className="p-6 text-sm text-stone-400">Đang tải hoá đơn...</p>
  }

  return (
    <div className="min-h-screen bg-stone-100 print:bg-white py-8 print:py-0">
      {/* Nút chỉ hiện trên màn hình, ẩn hẳn khi in (print:hidden) */}
      <div className="max-w-sm mx-auto mb-4 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex-1 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2.5"
        >
          In lại
        </button>
        <button
          onClick={() => window.close()}
          className="flex-1 border border-stone-300 text-sm font-semibold px-4 py-2.5 hover:border-stone-900"
        >
          Đóng
        </button>
      </div>

      <div className="max-w-sm mx-auto bg-white p-6 print:p-0 text-sm text-stone-900">
        <div className="text-center mb-4">
          <p className="font-display text-xl font-bold">NOVACART</p>
          <p className="text-xs text-stone-500">
            Tòa nhà FPT Polytechnic, Cổng số 2, 13 Trịnh Văn Bô, Xuân Phương, Hà Nội
          </p>
          <p className="text-xs text-stone-500">ĐT: 0327 990 059</p>
        </div>

        <div className="border-t border-b border-dashed border-stone-400 py-2 mb-3 text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Mã hoá đơn</span>
            <span className="font-medium">{invoice.orderCode}</span>
          </div>
          <div className="flex justify-between">
            <span>Thời gian</span>
            <span>{formatDateTime(invoice.createdAt)}</span>
          </div>
          {invoice.cashierUsername && (
            <div className="flex justify-between">
              <span>Thu ngân</span>
              <span>{invoice.cashierUsername}</span>
            </div>
          )}
          {invoice.customerName && (
            <div className="flex justify-between">
              <span>Khách hàng</span>
              <span>{invoice.customerName}</span>
            </div>
          )}
          {invoice.customerPhone && (
            <div className="flex justify-between">
              <span>SĐT</span>
              <span>{invoice.customerPhone}</span>
            </div>
          )}
        </div>

        <table className="w-full text-xs mb-3">
          <thead>
            <tr className="border-b border-stone-300">
              <th className="text-left font-medium pb-1">Sản phẩm</th>
              <th className="text-right font-medium pb-1">SL</th>
              <th className="text-right font-medium pb-1">T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.orderItemId} className="align-top">
                <td className="py-1 pr-1">
                  {item.productName}
                  <br />
                  <span className="text-stone-500">
                    {item.size} / {item.color} × {formatVnd(item.unitPrice)}
                  </span>
                </td>
                <td className="py-1 text-right">{item.quantity}</td>
                <td className="py-1 text-right">{formatVnd(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-stone-400 pt-2 text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Tạm tính</span>
            <span>{formatVnd(invoice.subtotalAmount)}</span>
          </div>
          {invoice.voucherCode && (
            <div className="flex justify-between">
              <span>Giảm giá ({invoice.voucherCode})</span>
              <span>-{formatVnd(invoice.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t border-stone-300 mt-1 pt-1">
            <span>Tổng cộng</span>
            <span>{formatVnd(invoice.totalAmount)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span>Thanh toán</span>
            <span>{PAYMENT_LABEL[invoice.paymentMethod] ?? invoice.paymentMethod}</span>
          </div>
        </div>

        <p className="text-center text-xs text-stone-500 mt-4">Cảm ơn quý khách đã mua hàng tại NovaCart!</p>
      </div>
    </div>
  )
}
