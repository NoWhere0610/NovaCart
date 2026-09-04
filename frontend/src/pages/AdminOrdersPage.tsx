import { useEffect, useState } from 'react'
import {
  confirmAdminOrderPaymentApi,
  confirmAdminOrderRefundApi,
  getAdminOrdersApi,
  updateAdminOrderStatusApi,
  type AdminOrderDto,
} from '../api/adminApi'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { useConfirmDialog } from '../hooks/useConfirmDialog'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ thanh toán',
  CONFIRMED: 'Chờ vận chuyển',
  SHIPPING: 'Chờ nhận hàng',
  DELIVERED: 'Cần đánh giá (đã giao)',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
  RETURN_REQUESTED: 'Yêu cầu trả hàng',
  RETURNED: 'Đã trả hàng/hoàn tiền',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  SHIPPING: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-stone-200 text-stone-600',
  RETURN_REQUESTED: 'bg-red-100 text-red-700',
  RETURNED: 'bg-red-100 text-red-700',
}

// Khớp CHÍNH XÁC với ALLOWED_TRANSITIONS bên AdminOrderService — chỉ hiện
// nút chuyển sang trạng thái mà backend THỰC SỰ cho phép.
const NEXT_STATUS: Record<string, { status: string; label: string; danger?: boolean }[]> = {
  PENDING: [
    { status: 'CONFIRMED', label: '→ Xác nhận (chờ vận chuyển)' },
    { status: 'CANCELLED', label: 'Huỷ đơn', danger: true },
  ],
  CONFIRMED: [
    { status: 'SHIPPING', label: '→ Giao cho vận chuyển' },
    { status: 'CANCELLED', label: 'Huỷ đơn', danger: true },
  ],
  SHIPPING: [{ status: 'DELIVERED', label: '→ Đã giao hàng' }],
  DELIVERED: [{ status: 'COMPLETED', label: '→ Hoàn thành hộ khách' }],
  COMPLETED: [],
  CANCELLED: [],
  RETURN_REQUESTED: [
    { status: 'RETURNED', label: 'Duyệt trả hàng', danger: true },
    { status: 'COMPLETED', label: 'Từ chối (giữ Hoàn thành)' },
  ],
  RETURNED: [],
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderDto[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const { alertDialog, dialog } = useAlertDialog()
  // Đặt tên khác `dialog` ở trên -- hai hook đều trả về một phần tử phải render, trùng tên là mất một cái.
  const { confirm: confirmDialog, dialog: confirmDialogEl } = useConfirmDialog()

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
      await alertDialog(err.response?.data?.message ?? 'Không thể cập nhật trạng thái')
    } finally {
      setBusyId(null)
    }
  }

  async function handleConfirmPayment(orderId: number) {
    setBusyId(orderId)
    try {
      await confirmAdminOrderPaymentApi(orderId)
      await loadOrders()
    } catch (err: any) {
      await alertDialog(err.response?.data?.message ?? 'Không thể xác nhận thanh toán')
    } finally {
      setBusyId(null)
    }
  }

  async function handleConfirmRefund(orderId: number) {
    // Hỏi lại vì thao tác này KHÔNG hoàn tác được và nó khẳng định một việc đã xảy ra ngoài hệ thống
    // (đã ra ngân hàng chuyển tiền). Bấm nhầm thì đơn biến mất khỏi danh sách chờ chuyển và khách
    // không bao giờ nhận được tiền, cũng chẳng ai còn thấy là đang thiếu.
    const dongY = await confirmDialog(
      'Xác nhận ĐÃ chuyển tiền hoàn lại cho khách?\n\n'
        + 'Chỉ bấm sau khi đã thực sự chuyển khoản thành công. Thao tác này không hoàn tác được.',
    )
    if (!dongY) return

    setBusyId(orderId)
    try {
      await confirmAdminOrderRefundApi(orderId)
      await loadOrders()
    } catch (err: any) {
      await alertDialog(err.response?.data?.message ?? 'Không thể xác nhận hoàn tiền')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {dialog}
      {/* Thiếu dòng này thì confirmDialog() không bao giờ hiện gì cả -- Promise treo vĩnh viễn và nút
          "Xác nhận đã hoàn tiền" trông như bấm không ăn. */}
      {confirmDialogEl}
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
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                    {o.status === 'RETURN_REQUESTED' && o.returnReason && (
                      <div className="text-xs text-stone-400 mt-1 max-w-[220px]">
                        Lý do: {o.returnReason}
                      </div>
                    )}
                    {/* Thông tin để nhân viên chuyển khoản đọc và gõ vào app ngân hàng. Hiện ngay tại
                        dòng đơn, không giấu sau nút "xem chi tiết" -- đây là việc cần làm, không phải
                        thông tin tham khảo. */}
                    {o.refundStatus === 'PENDING' && (
                      <div className="text-xs mt-2 max-w-[240px] border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-900">
                        <p className="font-semibold">Chờ chuyển tiền hoàn</p>
                        <p>{o.refundBankName}</p>
                        {/* tabular-nums: các chữ số rộng bằng nhau, đọc/dò số tài khoản đỡ nhầm hàng. */}
                        <p className="font-mono tabular-nums">{o.refundAccountNumber}</p>
                        <p>{o.refundAccountHolder}</p>
                      </div>
                    )}
                    {o.refundStatus === 'COMPLETED' && (
                      <div className="text-xs mt-2 max-w-[240px] text-green-700">
                        Đã hoàn tiền
                        {o.refundCompletedAt
                          ? ` ${new Date(o.refundCompletedAt).toLocaleDateString('vi-VN')}`
                          : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(o.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {o.paymentMethod === 'BANK_TRANSFER' && o.paymentStatus === 'UNPAID' && (
                        <button
                          disabled={busyId === o.orderId}
                          onClick={() => handleConfirmPayment(o.orderId)}
                          className="text-xs border border-green-300 text-green-700 hover:bg-green-50 px-2 py-1 disabled:opacity-50"
                        >
                          Xác nhận đã nhận CK
                        </button>
                      )}
                      {/* Chỉ hiện khi đã duyệt trả hàng VÀ còn khoản chờ hoàn -- khớp đúng điều kiện
                          backend kiểm trong AdminOrderService.confirmRefund, để nút không bao giờ
                          hiện ra rồi bấm vào lại báo lỗi. */}
                      {o.status === 'RETURNED' && o.refundStatus === 'PENDING' && (
                        <button
                          disabled={busyId === o.orderId}
                          onClick={() => handleConfirmRefund(o.orderId)}
                          className="text-xs border border-green-300 text-green-700 hover:bg-green-50 px-2 py-1 disabled:opacity-50"
                        >
                          Xác nhận đã hoàn tiền
                        </button>
                      )}
                      {NEXT_STATUS[o.status]?.map((next) => (
                        <button
                          key={next.status}
                          disabled={busyId === o.orderId}
                          onClick={() => handleChangeStatus(o.orderId, next.status)}
                          className={`text-xs border px-2 py-1 disabled:opacity-50 ${
                            next.danger
                              ? 'border-red-300 text-red-600 hover:bg-red-50'
                              : 'border-stone-300 hover:border-stone-900'
                          }`}
                        >
                          {next.label}
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