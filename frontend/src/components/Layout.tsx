import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import PageFade from './PageFade'
import ScrollToTop from './ScrollToTop'

/**
 * Layout dùng chung cho toàn bộ trang (trừ login/register/admin).
 * Header và Footer CỐ ĐỊNH ở mọi màn hình — chỉ phần <Outlet /> (nội dung
 * riêng của từng trang) thay đổi khi chuyển route.
 */
export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <PageFade>
          <Outlet />
        </PageFade>
      </main>
      <Footer />
    </div>
  )
}