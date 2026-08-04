import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * React Router KHÔNG tự reset scroll khi chuyển route (khác hành vi mặc định của trình duyệt với link
 * <a> thường) -- nếu đang cuộn giữa trang Shop rồi bấm vào 1 sản phẩm, trang chi tiết mở ra vẫn giữ
 * nguyên vị trí cuộn cũ, trông như "nhảy" vào giữa trang thay vì bắt đầu từ đầu. Component rỗng (không
 * render gì), chỉ side-effect cuộn lên đầu mỗi khi pathname đổi.
 *
 * DÙNG useLayoutEffect (KHÔNG phải useEffect) -- useEffect chạy SAU khi trình duyệt đã vẽ (paint) xong
 * 1 khung hình, nên có 1 khoảnh khắc trang MỚI (thường ngắn hơn, vd đang "Đang tải...") hiện ra NGAY TẠI
 * vị trí cuộn CŨ (thường đã cuộn xuống sâu) trước khi bị giật lên đầu ở khung hình kế tiếp -- đúng cảm
 * giác "giật" người dùng thấy. useLayoutEffect chạy đồng bộ TRƯỚC khi trình duyệt kịp vẽ, nên việc cuộn
 * lên đầu xảy ra chung 1 khung hình với nội dung mới, không có khung hình trung gian bị "lộ" ra.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
