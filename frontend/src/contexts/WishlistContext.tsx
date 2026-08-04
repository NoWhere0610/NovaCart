import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getWishlistProductIdsApi, addToWishlistApi, removeFromWishlistApi } from '../api/wishlistApi'
import { useAuth } from './AuthContext'

interface WishlistContextValue {
  isWishlisted: (productId: number) => boolean
  // Optimistic: cập nhật UI (Set) NGAY, gọi API nền sau -- tim phải phản hồi tức thì khi bấm, không
  // đợi round-trip API mới đổi trạng thái (khác CartContext, ở đây không cần server trả dữ liệu gì
  // thêm để hiển thị, nên optimistic an toàn và mượt hơn).
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
        /* Không có chỗ hiển thị lỗi hợp lý cho việc này -- chỉ ảnh hưởng trạng thái tô đậm icon tim,
           không chặn thao tác nào khác của khách. */
      })
  }, [isAuthenticated])

  function isWishlisted(productId: number) {
    return ids.has(productId)
  }

  function toggle(productId: number) {
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
