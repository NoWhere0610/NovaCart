import { useEffect, useState } from 'react'
import { getAdminProductsApi, type AdminProductDto } from '../api/adminApi'
import {
  createPosInvoiceApi,
  listPendingPosInvoicesApi,
  getPosInvoiceApi,
  addPosItemApi,
  updatePosItemQuantityApi,
  removePosItemApi,
  applyPosVoucherApi,
  removePosVoucherApi,
  checkoutPosInvoiceApi,
  cancelPosInvoiceApi,
  type PosInvoiceDto,
  type PosPaymentMethod,
} from '../api/posApi'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

function effectivePrice(p: AdminProductDto) {
  return p.salePrice != null && p.salePrice > 0 ? p.salePrice : p.price
}

export default function AdminPosPage() {
  const [invoice, setInvoice] = useState<PosInvoiceDto | null>(null)
  const [pendingList, setPendingList] = useState<PosInvoiceDto[]>([])
  const [loadingInvoice, setLoadingInvoice] = useState(false)

  const [keyword, setKeyword] = useState('')
  const [products, setProducts] = useState<AdminProductDto[]>([])
  const [searching, setSearching] = useState(false)

  const [voucherInput, setVoucherInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('COD')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    refreshPendingList()
  }, [])

  async function refreshPendingList() {
    const res = await listPendingPosInvoicesApi(0, 50)
    setPendingList(res.content)
  }

  async function handleNewInvoice() {
    setLoadingInvoice(true)
    try {
      const inv = await createPosInvoiceApi()
      setInvoice(inv)
      await refreshPendingList()
    } finally {
      setLoadingInvoice(false)
    }
  }

  async function handleOpenInvoice(orderId: number) {
    setLoadingInvoice(true)
    try {
      setInvoice(await getPosInvoiceApi(orderId))
    } finally {
      setLoadingInvoice(false)
    }
  }

  async function handleSearch() {
    setSearching(true)
    try {
      const res = await getAdminProductsApi(keyword, 0, 20)
      setProducts(res.content)
    } finally {
      setSearching(false)
    }
  }

  async function handleAddVariant(variantId: number) {
    if (!invoice) return
    setError('')
    try {
      setInvoice(await addPosItemApi(invoice.orderId, variantId, 1))
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể thêm sản phẩm')
    }
  }

  async function handleChangeQty(orderItemId: number, quantity: number) {
    if (!invoice || quantity < 1) return
    setError('')
    try {
      setInvoice(await updatePosItemQuantityApi(invoice.orderId, orderItemId, quantity))
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể cập nhật số lượng')
    }
  }

  async function handleRemoveItem(orderItemId: number) {
    if (!invoice) return
    setInvoice(await removePosItemApi(invoice.orderId, orderItemId))
  }

  async function handleApplyVoucher() {
    if (!invoice || !voucherInput.trim()) return
    setError('')
    try {
      setInvoice(await applyPosVoucherApi(invoice.orderId, voucherInput.trim()))
      setVoucherInput('')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Mã giảm giá không hợp lệ')
    }
  }

  async function handleRemoveVoucher() {
    if (!invoice) return
    setInvoice(await removePosVoucherApi(invoice.orderId))
  }

  async function handleCancelInvoice() {
    if (!invoice || !confirm('Huỷ hoá đơn này? Toàn bộ sản phẩm đã thêm sẽ được hoàn lại kho.')) return
    await cancelPosInvoiceApi(invoice.orderId)
    setInvoice(null)
    await refreshPendingList()
  }

  async function handleCheckout() {
    if (!invoice) return
    setCheckingOut(true)
    setError('')
    try {
      const done = await checkoutPosInvoiceApi(invoice.orderId, {
        paymentMethod,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      })
      setInvoice(done)
      setCustomerName('')
      setCustomerPhone('')
      await refreshPendingList()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể thanh toán')
    } finally {
      setCheckingOut(false)
    }
  }

  const isDraft = invoice?.status === 'PENDING'

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Cột trái: hoá đơn chờ */}
      <div className="col-span-2">
        <button
          onClick={handleNewInvoice}
          disabled={loadingInvoice}
          className="w-full mb-4 bg-orange-700 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-2.5"
        >
          + Hoá đơn mới
        </button>
        <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide">Hoá đơn đang chờ</p>
        <div className="space-y-1">
          {pendingList.map((inv) => (
            <button
              key={inv.orderId}
              onClick={() => handleOpenInvoice(inv.orderId)}
              className={`w-full text-left px-3 py-2 text-sm border ${
                invoice?.orderId === inv.orderId
                  ? 'border-orange-700 bg-orange-50'
                  : 'border-stone-200 hover:border-stone-400'
              }`}
            >
              <p className="font-medium text-stone-900">{inv.orderCode}</p>
              <p className="text-stone-500">{formatVnd(inv.totalAmount)}</p>
            </button>
          ))}
          {pendingList.length === 0 && (
            <p className="text-xs text-stone-400">Chưa có hoá đơn chờ nào</p>
          )}
        </div>
      </div>

      {/* Cột giữa: tìm sản phẩm */}
      <div className="col-span-5">
        <div className="flex gap-2 mb-4">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Tìm sản phẩm theo tên..."
            className="flex-1 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="border border-stone-300 px-4 py-2 text-sm hover:border-stone-900"
          >
            Tìm
          </button>
        </div>

        <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {products.map((p) => (
            <div key={p.productId} className="border border-stone-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-stone-900 text-sm">{p.productName}</p>
                <p className="text-sm text-orange-700 font-semibold">{formatVnd(effectivePrice(p))}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => (
                  <button
                    key={v.variantId}
                    disabled={!isDraft || v.stockQuantity <= 0}
                    onClick={() => handleAddVariant(v.variantId)}
                    className="text-xs border border-stone-300 px-2 py-1.5 hover:border-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={v.stockQuantity <= 0 ? 'Hết hàng' : `Còn ${v.stockQuantity}`}
                  >
                    {v.size} / {v.color} <span className="text-stone-400">({v.stockQuantity})</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {products.length === 0 && !searching && (
            <p className="text-sm text-stone-400">Nhập từ khoá rồi bấm "Tìm" để tra sản phẩm</p>
          )}
        </div>
      </div>

      {/* Cột phải: hoá đơn hiện tại */}
      <div className="col-span-5">
        {!invoice ? (
          <div className="border border-dashed border-stone-300 p-10 text-center text-stone-400 text-sm">
            Chọn hoặc tạo 1 hoá đơn để bắt đầu bán hàng
          </div>
        ) : (
          <div className="border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-stone-900">{invoice.orderCode}</p>
              <span
                className={`text-xs px-2 py-1 ${
                  invoice.status === 'COMPLETED'
                    ? 'bg-green-100 text-green-800'
                    : invoice.status === 'CANCELLED'
                    ? 'bg-stone-200 text-stone-600'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {invoice.status === 'COMPLETED' ? 'Đã thanh toán' : invoice.status === 'CANCELLED' ? 'Đã huỷ' : 'Đang chọn hàng'}
              </span>
            </div>

            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

            <div className="divide-y divide-stone-100 border-t border-b border-stone-100 mb-3 max-h-64 overflow-y-auto">
              {invoice.items.map((item) => (
                <div key={item.orderItemId} className="py-2 flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900 truncate">{item.productName}</p>
                    <p className="text-stone-500 text-xs">
                      {item.size} / {item.color} · {formatVnd(item.unitPrice)}
                    </p>
                  </div>
                  {isDraft ? (
                    <div className="flex items-center gap-2 ml-2">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleChangeQty(item.orderItemId, Number(e.target.value))}
                        className="w-14 border border-stone-300 px-1 py-1 text-center text-xs"
                      />
                      <button
                        onClick={() => handleRemoveItem(item.orderItemId)}
                        className="text-red-600 text-xs hover:underline"
                      >
                        Xoá
                      </button>
                    </div>
                  ) : (
                    <p className="text-stone-500 text-xs ml-2">× {item.quantity}</p>
                  )}
                  <p className="font-medium text-stone-900 w-20 text-right">{formatVnd(item.subtotal)}</p>
                </div>
              ))}
              {invoice.items.length === 0 && (
                <p className="py-4 text-center text-xs text-stone-400">Chưa có sản phẩm nào</p>
              )}
            </div>

            {isDraft && (
              <div className="flex gap-2 mb-3">
                <input
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  placeholder="Nhập mã giảm giá"
                  className="flex-1 border border-stone-300 px-2 py-1.5 text-sm"
                />
                <button onClick={handleApplyVoucher} className="text-xs border border-stone-300 px-3 hover:border-stone-900">
                  Áp dụng
                </button>
              </div>
            )}

            {invoice.voucherCode && (
              <div className="flex items-center justify-between text-sm text-green-700 mb-2">
                <span>Mã {invoice.voucherCode}</span>
                <div className="flex items-center gap-2">
                  <span>-{formatVnd(invoice.discountAmount)}</span>
                  {isDraft && (
                    <button onClick={handleRemoveVoucher} className="text-xs text-stone-400 hover:text-red-600">
                      Bỏ
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-lg font-semibold text-stone-900 border-t border-stone-200 pt-3 mb-4">
              <span>Tổng cộng</span>
              <span>{formatVnd(invoice.totalAmount)}</span>
            </div>

            {invoice.status === 'COMPLETED' && (
              <button
                onClick={() => window.open(`/admin/pos/invoices/${invoice.orderId}/print`, '_blank')}
                className="w-full mb-4 border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white text-sm font-semibold px-4 py-2.5"
              >
                In hoá đơn
              </button>
            )}

            {isDraft && (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Tên khách (không bắt buộc)"
                    className="border border-stone-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="SĐT (không bắt buộc)"
                    className="border border-stone-300 px-2 py-1.5 text-sm"
                  />
                </div>

                <div className="flex gap-3 mb-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                    />
                    Tiền mặt
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={paymentMethod === 'BANK_TRANSFER'}
                      onChange={() => setPaymentMethod('BANK_TRANSFER')}
                    />
                    Chuyển khoản
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCancelInvoice}
                    className="flex-1 border border-red-600 text-red-600 hover:bg-red-50 text-sm font-semibold px-4 py-2.5"
                  >
                    Huỷ hoá đơn
                  </button>
                  <button
                    onClick={handleCheckout}
                    disabled={checkingOut || invoice.items.length === 0}
                    className="flex-1 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5"
                  >
                    {checkingOut ? 'Đang thanh toán...' : 'Thanh toán'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}