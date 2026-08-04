import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getMyCartApi, type CartDto } from '../api/cartApi'
import { useAuth } from './AuthContext'

interface CartContextValue {
  // Số lượng sản phẩm trong giỏ (tổng quantity, không phải số dòng) -- dùng cho bong bóng đỏ ở icon
  // giỏ hàng trên Header. 0 = ẩn bong bóng.
  cartCount: number
  // Các trang có thao tác cart (add/update/remove) đều gọi hàm này với CartDto server trả về NGAY sau
  // thao tác đó -- tránh phải gọi thêm 1 API riêng chỉ để lấy lại count (API cart hiện có đã trả sẵn
  // totalQuantity trong mọi response rồi).
  applyCart: (cart: CartDto) => void
  // Đặt hàng xong -> server đã xoá sạch giỏ hàng, nhưng checkoutApi() trả về OrderDto (không phải
  // CartDto) nên không dùng applyCart() được -- dùng riêng hàm này cho đúng tình huống đó.
  clearCartCount: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [cartCount, setCartCount] = useState(0)

  // Nạp số lượng ban đầu khi vừa đăng nhập/mở lại trang -- các trang khác chỉ CẬP NHẬT tiếp sau thao
  // tác của chính chúng, không tự nạp lần đầu (Header render 1 lần duy nhất cho mọi trang, không phải
  // trang nào cũng gọi getMyCartApi lúc mount).
  useEffect(() => {
    if (!isAuthenticated) {
      setCartCount(0)
      return
    }
    getMyCartApi()
      .then((cart) => setCartCount(cart.totalQuantity))
      .catch(() => {
        /* Header không phải chỗ hợp lý để báo lỗi tải giỏ hàng -- các trang cart/checkout thật sự đã tự
           có error state riêng, ở đây chỉ ảnh hưởng 1 con số nhỏ trên badge nên bỏ qua im lặng là đủ. */
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
