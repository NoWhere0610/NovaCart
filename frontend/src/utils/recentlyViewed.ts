const STORAGE_KEY = 'recentlyViewedProductIds'
const MAX_ITEMS = 10

/** Ghi lại sản phẩm vừa xem, mới nhất lên đầu, tự loại trùng, giới hạn 10 sản phẩm gần nhất. */
export function addRecentlyViewed(productId: number) {
  const ids = getRecentlyViewedIds().filter((id) => id !== productId)
  ids.unshift(productId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_ITEMS)))
}

export function getRecentlyViewedIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // localStorage bị chặn (chế độ ẩn danh nghiêm ngặt...) hoặc dữ liệu hỏng -> coi như chưa xem gì.
    return []
  }
}
