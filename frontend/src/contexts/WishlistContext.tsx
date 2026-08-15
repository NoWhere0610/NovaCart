import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getWishlistProductIdsApi, addToWishlistApi, removeFromWishlistApi } from '../api/wishlistApi'
import { useAuth } from './AuthContext'

interface WishlistContextValue {
  isWishlisted: (productId: number) => boolean
  // Optimistic: cập nhật UI ngay, gọi API nền sau -- tim phản hồi tức thì khi bấm.
  toggle: (productId: number) => void
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [ids, setIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!isAuthenticated) {
      setIds(new Set())
      return
    }
    getWishlistProductIdsApi()
      .then((list) => setIds(new Set(list)))
      .catch(() => {
        /* Lỗi chỉ ảnh hưởng trạng thái tô đậm icon tim, không chặn thao tác khác. */
      })
  }, [isAuthenticated])

  function isWishlisted(productId: number) {
    return ids.has(productId)
  }

  function toggle(productId: number) {
    // Trang sản phẩm/shop giờ xem được không cần đăng nhập -- khách bấm tim thì đưa sang login
    // luôn (giống hành vi nút "Thêm vào giỏ") thay vì gọi API 401 rồi âm thầm revert như trước.
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    const wasWishlisted = ids.has(productId)
    setIds((prev) => {
      const next = new Set(prev)
      if (wasWishlisted) next.delete(productId)
      else next.add(productId)
      return next
    })
    const apiCall = wasWishlisted ? removeFromWishlistApi(productId) : addToWishlistApi(productId)
    apiCall.catch(() => {
      // API lỗi -> hoàn tác lại đúng trạng thái cũ (optimistic update thất bại).
      setIds((prev) => {
        const next = new Set(prev)
        if (wasWishlisted) next.add(productId)
        else next.delete(productId)
        return next
      })
    })
  }

  return <WishlistContext.Provider value={{ isWishlisted, toggle }}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext)
  if (!ctx) {
    throw new Error('useWishlist() phải được gọi bên trong <WishlistProvider>')
  }
  return ctx
}
