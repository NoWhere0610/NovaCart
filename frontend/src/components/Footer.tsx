import { Link } from 'react-router-dom'

/**
 * Footer dùng chung cho MỌI trang (trừ login/register và khu vực admin).
 * Cố định về bố cục — không đổi theo từng trang.
 */
export default function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
        {/* Về NovaCart */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl font-bold tracking-tight text-white">NOVACART</span>
          </div>
          <p className="text-sm text-stone-400 leading-relaxed mb-4">
            NovaCart là cửa hàng thời trang nam trực tuyến, chuyên các sản phẩm may đo tối giản,
            chất liệu bền và form dáng chuẩn.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/tran.cuong.04276"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook NovaCart"
              className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center hover:bg-blue-600 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.13 2 11.23c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.87.38 2.92.38 5.52 0 10-4.13 10-9.29C22 6.13 17.52 2 12 2zm1.02 12.51-2.55-2.72-4.98 2.72 5.48-5.82 2.6 2.72 4.93-2.72-5.48 5.82z" />
              </svg>
            </a>
            <a
              href="https://www.tiktok.com/@cuong05100"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok NovaCart"
              className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center hover:bg-black transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M16.6 5.82c-.99-.99-1.55-2.31-1.6-3.82h-3.14v13.7c0 1.5-1.22 2.72-2.72 2.72a2.72 2.72 0 0 1 0-5.44c.26 0 .5.03.74.1V9.9a6 6 0 0 0-.74-.05A5.9 5.9 0 0 0 3.24 15.8a5.9 5.9 0 0 0 5.9 5.9c3.26 0 5.9-2.64 5.9-5.9V8.6a9.06 9.06 0 0 0 5.28 1.7V7.16c-1.36 0-2.62-.44-3.72-1.34z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Thông tin liên hệ */}
        <div>
          <p className="text-white font-semibold mb-4 text-sm tracking-wide">THÔNG TIN LIÊN HỆ</p>
          <ul className="space-y-3 text-sm text-stone-400">
            <li className="flex gap-2">
              <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <a
                href="https://www.google.com/maps?vet=10CAAQoqAOahcKEwig3a6Pj_iVAxUAAAAAHQAAAAAQDQ..i&rlz=1C1FKPE_viVN1213VN1213&pvq=Cg0vZy8xMWtyZDk3eV9fIisKJXRyxrDhu51uZyBjYW8gxJHhurNuZyBmcHQgcG9seXRlY2huaWMQAhgD&lqi=Cjl0csaw4budbmcgY2FvIMSR4bqzbmcgZnB0IHBvbHl0ZWNobmljIGjDoCBu4buZaSBow6AgbuG7mWlI_-_PxN2xgIAIWlcQABABEAIQAxAEGAAYARgCGAMYBBgFGAYYBxgIIjl0csaw4budbmcgY2FvIMSR4bqzbmcgZnB0IHBvbHl0ZWNobmljIGjDoCBu4buZaSBow6AgbuG7mWmSAQdjb2xsZWdlmgEjQ2haRFNVaE5NRzluUzBWSlEwRm5TVU42Y1V4SFZrcFJFQUX6AQQIABA2&fvr=1&cs=1&um=1&ie=UTF-8&fb=1&gl=vn&sa=X&ftid=0x313455e940879933:0xcf10b34e9f1a03df"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                2PQW+6JJ, Tòa nhà FPT Polytechnic, Cổng số 2, 13 Trịnh Văn Bô, Xuân Phương, Hà Nội 100000
              </a>
            </li>
            <li className="flex gap-2 items-center">
              <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <a href="tel:0327990059" className="hover:text-white">0327 990 059</a>
            </li>
            <li className="flex gap-2 items-center">
              <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 6-10 7L2 6" />
              </svg>
              <a href="mailto:nemcsb@gmail.com" className="hover:text-white">nemcsb@gmail.com</a>
            </li>
          </ul>
        </div>

        {/* Chính sách */}
        <div>
          <p className="text-white font-semibold mb-4 text-sm tracking-wide">CHÍNH SÁCH</p>
          <ul className="space-y-2.5 text-sm text-stone-400">
            <li><Link to="/chinh-sach-doi-tra" className="hover:text-white">Chính sách đổi trả</Link></li>
            <li><Link to="/chinh-sach-van-chuyen" className="hover:text-white">Chính sách vận chuyển</Link></li>
            <li><Link to="/chinh-sach-bao-mat" className="hover:text-white">Chính sách bảo mật</Link></li>
            <li><Link to="/dieu-khoan-su-dung" className="hover:text-white">Điều khoản sử dụng</Link></li>
          </ul>
        </div>

        {/* Danh mục */}
        <div>
          <p className="text-white font-semibold mb-4 text-sm tracking-wide">DANH MỤC</p>
          <ul className="space-y-2.5 text-sm text-stone-400">
            <li><Link to="/shop?category=ao-thun" className="hover:text-white">Áo thun</Link></li>
            <li><Link to="/shop?category=ao-so-mi" className="hover:text-white">Áo sơ mi</Link></li>
            <li><Link to="/shop?category=quan-jean" className="hover:text-white">Quần jean</Link></li>
            <li><Link to="/shop?category=quan-tay" className="hover:text-white">Quần tây</Link></li>
            <li><Link to="/shop?category=ao-khoac" className="hover:text-white">Áo khoác</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 py-5 text-xs text-stone-500 text-center leading-relaxed">
          <p>NOVACART — Giấy chứng nhận đăng ký kinh doanh cấp tại Hà Nội.</p>
          <p>© {new Date().getFullYear()} NovaCart. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}