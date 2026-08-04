import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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

  // Nạp số lượng ban đầu khi đăng nhập/mở lại trang; các trang khác chỉ cập nhật tiếp sau thao tác của mình.
  useEffect(() => {
    if (!isAuthenticated) {
      setCartCount(0)
      return
    }
    getMyCartApi()
      .then((cart) => setCartCount(cart.totalQuantity))
      .catch(() => {
        /* Chỉ ảnh hưởng số trên badge -- trang cart/checkout đã có error state riêng. */
      })
  }, [isAuthenticated])

  function applyCart(cart: CartDto) {
    setCartCount(cart.totalQuantity)
  }

  function clearCartCount() {
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
