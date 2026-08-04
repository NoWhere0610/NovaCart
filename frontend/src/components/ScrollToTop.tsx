import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * React Router không tự reset scroll khi chuyển route -- component rỗng, chỉ side-effect
 * cuộn lên đầu mỗi khi pathname đổi.
 *
 * Dùng useLayoutEffect (không phải useEffect) để cuộn lên đầu TRƯỚC khi trình duyệt paint,
 * tránh lộ 1 khung hình nội dung mới ở vị trí cuộn cũ rồi mới giật lên.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
