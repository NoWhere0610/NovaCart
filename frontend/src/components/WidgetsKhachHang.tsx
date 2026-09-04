import { useLocation } from 'react-router-dom'
import FloatingSocialButtons from './FloatingSocialButtons'
import ChatWidget from './chat/ChatWidget'

/**
 * Các nút nổi góc màn hình (TikTok, Facebook, khung chat) — chỉ dành cho KHÁCH HÀNG.
 *
 * VÌ SAO CẦN LỌC: ba nút này được gắn ở ngoài <Routes> nên trước đây hiện trên MỌI trang, kể cả khu
 * quản trị. Ở đó chúng vô nghĩa (nhân viên không tư vấn cho chính mình) và còn che mất nội dung —
 * trong bảng Quản lý người dùng chúng đè lên đúng cột "Thao tác" ở góc dưới phải.
 *
 * Lọc theo đường dẫn thay vì chuyển vào Layout: các trang khách hàng không dùng chung một layout duy
 * nhất (đăng nhập, đăng ký, quên mật khẩu, trang kết quả VNPay đều nằm ngoài), nên chuyển vào Layout
 * sẽ làm mất widget ở một loạt trang vốn đang có.
 */
export default function WidgetsKhachHang() {
  const { pathname } = useLocation()

  // startsWith('/admin') phủ cả trang in hoá đơn POS (/admin/pos/invoices/:id/print) -- trang đó mở ở
  // tab riêng để in, có thêm nút nổi thì lọt luôn vào bản in.
  if (pathname.startsWith('/admin')) return null

  return (
    <>
      <FloatingSocialButtons />
      <ChatWidget />
    </>
  )
}
