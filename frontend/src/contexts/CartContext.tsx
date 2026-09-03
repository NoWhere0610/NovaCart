import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { getMyCartApi, type CartDto } from '../api/cartApi'
import { useAuth } from './AuthContext'

interface CartContextValue {
  // Tổng quantity, không phải số dòng -- dùng cho bong bóng đỏ ở icon giỏ hàng. 0 = ẩn.
  cartCount: number
  // Gọi với CartDto server trả về sau mỗi thao tác cart, khỏi gọi thêm API riêng để lấy count.
  applyCart: (cart: CartDto) => void
  // checkoutApi() trả về OrderDto (không phải CartDto) nên cần hàm riêng để reset count về 0.
  clearCartCount: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [cartCount, setCartCount] = useState(0)
  // Đánh số thứ tự "cập nhật nào là mới nhất" -- chặn race condition: lần tải giỏ hàng lúc mở trang
  // (getMyCartApi ở dưới) có thể trả lời CHẬM HƠN 1 thao tác applyCart() sau đó (vd bấm "Thêm vào giỏ
  // hàng" ngay khi trang vừa mở), khiến số cũ ghi đè lên số mới hơn nếu không chặn theo thứ tự này.
  const latestSeqRef = useRef(0)

  // Nạp số lượng ban đầu khi đăng nhập/mở lại trang; các trang khác chỉ cập nhật tiếp sau thao tác của mình.
  useEffect(() => {
    if (!isAuthenticated) {
      latestSeqRef.current++
      setCartCount(0)
      return
    }
    const seq = ++latestSeqRef.current
    getMyCartApi()
      .then((cart) => {
        if (seq === latestSeqRef.current) setCartCount(cart.totalQuantity)
      })
      .catch(() => {
        /* Chỉ ảnh hưởng số trên badge -- trang cart/checkout đã có error state riêng. */
      })
  }, [isAuthenticated])

  function applyCart(cart: CartDto) {
    latestSeqRef.current++ // vô hiệu hoá mọi request đang bay trước đó (vd fetch lúc mount ở trên)
    setCartCount(cart.totalQuantity)
  }

  function clearCartCount() {
    latestSeqRef.current++
    setCartCount(0)
  }

  return (
    <CartContext.Provider value={{ cartCount, applyCart, clearCartCount }}>{children}</CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart() phải được gọi bên trong <CartProvider>')
  }
  return ctx
}
