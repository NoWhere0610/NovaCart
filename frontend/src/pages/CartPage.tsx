import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getMyCartApi,
  removeCartItemApi,
  updateCartItemApi,
  type CartDto,
} from '../api/cartApi'
import { useCart } from '../contexts/CartContext'
import { IconShoppingBag } from '@tabler/icons-react'
import BackButton from '../components/BackButton'
import { useAlertDialog } from '../hooks/useAlertDialog'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

export default function CartPage() {
  const navigate = useNavigate()
  const { applyCart } = useCart()
  const { alertDialog, dialog } = useAlertDialog()
  const [cart, setCart] = useState<CartDto | null>(null)
  const [loading, setLoading] = useState(true)
  // null = chưa biết/đang tải; không dùng '' làm "không lỗi" vì dễ nhầm với message rỗng.
  const [error, setError] = useState<string | null>(null)
  // Theo dõi item nào đang gọi API để disable đúng nút đó (tránh double-click gây lỗi)
  const [busyId, setBusyId] = useState<number | null>(null)
  // Mặc định chọn hết (giữ đúng hành vi cũ "mua cả giỏ" khi khách không đụng gì tới checkbox).
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadCart()
  }, [])

  async function loadCart() {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyCartApi()
      setCart(data)
      applyCart(data)
      setSelectedIds(new Set(data.items.map((i) => i.cartItemId)))
    } catch {
      // Phải hiển thị rõ khác với "giỏ hàng trống thật", tránh hiểu nhầm là mất đồ.
      setError('Không thể tải giỏ hàng. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelected(cartItemId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cartItemId)) next.delete(cartItemId)
      else next.add(cartItemId)
      return next
    })
  }

  function toggleSelectAll() {
    if (!cart) return
    setSelectedIds((prev) =>
      prev.size === cart.items.length ? new Set() : new Set(cart.items.map((i) => i.cartItemId)),
    )
  }

  async function handleChangeQuantity(cartItemId: number, quantity: number) {
    if (quantity < 1) return
    setBusyId(cartItemId)
    try {
      const data = await updateCartItemApi(cartItemId, quantity)
      setCart(data)
      applyCart(data)
    } catch (err: any) {
      await alertDialog(err.response?.data?.message ?? 'Không thể cập nhật số lượng')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(cartItemId: number) {
    setBusyId(cartItemId)
    try {
      const data = await removeCartItemApi(cartItemId)
      setCart(data)
      applyCart(data)
      // Bỏ luôn id vừa xoá khỏi selection -- không thì "Chọn tất cả" bị lệch đếm (còn giữ id đã
      // không tồn tại nữa) dù mọi item còn lại vẫn đang được chọn.
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(cartItemId)
        return next
      })
    } catch (err: any) {
      await alertDialog(err.response?.data?.message ?? 'Không thể xoá sản phẩm khỏi giỏ hàng')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-stone-500">Đang tải giỏ hàng...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-stone-200 p-8 text-center">
          <p className="text-stone-700 mb-4">{error}</p>
          <button
            onClick={loadCart}
            className="bg-stone-900 border-gold-metallic gold-glow text-white text-sm font-semibold px-6 py-2.5"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  const isEmpty = !cart || cart.items.length === 0
  const selectedItems = cart ? cart.items.filter((i) => selectedIds.has(i.cartItemId)) : []
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.subtotal, 0)

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        {dialog}
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-stone-900 mb-6">Giỏ hàng của bạn</h1>

        {isEmpty ? (
          <div className="bg-white border border-stone-200 p-10 text-center">
            <IconShoppingBag size={40} stroke={1.3} className="mx-auto mb-3 text-stone-300" />
            <p className="text-stone-500 mb-4">Giỏ hàng đang trống.</p>
            <Link to="/" className="text-gold-dark font-medium underline">
              Tiếp tục mua sắm
            </Link>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 mb-2 text-sm text-stone-600 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={selectedIds.size === cart!.items.length}
                onChange={toggleSelectAll}
              />
              Chọn tất cả
            </label>

            <div className="bg-white border border-stone-200 divide-y divide-stone-200">
              {cart!.items.map((item) => {
                const overStock = item.quantity > item.stockQuantity
                return (
                  <div key={item.cartItemId} className="flex items-center gap-4 p-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.cartItemId)}
                      onChange={() => toggleSelected(item.cartItemId)}
                      className="shrink-0"
                    />
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-20 h-24 object-cover bg-stone-100" />
                    ) : (
                      <div className="w-20 h-24 bg-stone-100" />
                    )}

                    <div className="flex-1">
                      <p className="font-medium text-stone-900">{item.productName}</p>
                      <p className="text-sm text-stone-500">
                        {item.size} / {item.color}
                      </p>
                      <p className="text-sm text-stone-700 mt-1">{formatVnd(item.unitPrice)}</p>
                      {overStock && (
                        <p className="text-xs text-red-600 mt-1">
                          Chỉ còn {item.stockQuantity} sản phẩm trong kho, vui lòng giảm số lượng
                        </p>
                      )}
                    </div>

                    <div className="flex items-center border border-stone-300">
                      <button
                        disabled={busyId === item.cartItemId || item.quantity <= 1}
                        onClick={() => handleChangeQuantity(item.cartItemId, item.quantity - 1)}
                        className="w-8 h-8 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        disabled={busyId === item.cartItemId}
                        onClick={() => handleChangeQuantity(item.cartItemId, item.quantity + 1)}
                        className="w-8 h-8 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    <p className="w-28 text-right font-medium text-stone-900">{formatVnd(item.subtotal)}</p>

                    <button
                      disabled={busyId === item.cartItemId}
                      onClick={() => handleRemove(item.cartItemId)}
                      className="text-red-600 hover:underline text-sm disabled:opacity-40"
                    >
                      Xoá
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="bg-white border border-stone-200 border-t-0 p-4 flex items-center justify-between">
              <span className="text-stone-600">
                {selectedItems.length === cart!.items.length
                  ? `Tổng cộng (${cart!.totalQuantity} sản phẩm)`
                  : `Đã chọn (${selectedItems.length}/${cart!.items.length} sản phẩm)`}
              </span>
              <span className="text-xl font-semibold text-stone-900">{formatVnd(selectedTotal)}</span>
            </div>

            <button
              onClick={() => navigate('/checkout', { state: { cartItemIds: Array.from(selectedIds) } })}
              disabled={selectedItems.length === 0}
              className="mt-6 w-full bg-stone-900 border-gold-metallic gold-glow disabled:opacity-50 text-stone-50 text-sm font-semibold px-6 py-3"
            >
              {selectedItems.length === cart!.items.length
                ? 'Tiến hành đặt hàng'
                : `Mua ${selectedItems.length} sản phẩm đã chọn`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}