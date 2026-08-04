import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconBrandFacebook, IconBrandTiktok, IconMapPin, IconPhone, IconMail } from '@tabler/icons-react'
import { apiClient } from '../api/apiClient'

interface FooterCategory {
  categoryId: number
  categoryName: string
  slug: string
}

/**
 * Footer dùng chung cho MỌI trang (trừ login/register và khu vực admin).
 * Cố định về bố cục — không đổi theo từng trang.
 */
export default function Footer() {
  // Trước đây "DANH MỤC" hard-code 5 danh mục LÁ cũ, không khớp 4 nhóm CHA hiện tại ở mega-menu Header
  // (Áo, Quần, Đồ mặc trong, Suit & Blazer) -- tải động từ cùng API Header đang dùng để 2 nơi luôn khớp
  // nhau, không bị lệch lại nếu danh mục đổi sau này.
  const [categories, setCategories] = useState<FooterCategory[]>([])

  useEffect(() => {
    apiClient
      .get<FooterCategory[]>('/home/categories')
      .then((res) => setCategories(res.data))
      .catch(() => {
        /* Footer không phải chỗ quan trọng để báo lỗi -- để trống mục Danh mục nếu API lỗi, không chặn
           phần còn lại của footer hiển thị. */
      })
  }, [])

  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-gold/40">
      <div className="max-w-[1600px] mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
        {/* Về NovaCart */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="font-display text-xl font-bold tracking-tight text-white">NOVACART</span>
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
              className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center hover:bg-gold-dark transition-colors"
            >
              <IconBrandFacebook size={16} color="white" />
            </a>
            <a
              href="https://www.tiktok.com/@cuong05100"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok NovaCart"
              className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center hover:bg-gold-dark transition-colors"
            >
              <IconBrandTiktok size={16} color="white" />
            </a>
          </div>
        </div>

        {/* Thông tin liên hệ */}
        <div>
          <p className="text-gold font-semibold mb-4 text-sm tracking-wide">THÔNG TIN LIÊN HỆ</p>
          <ul className="space-y-3 text-sm text-stone-400">
            <li className="flex gap-2">
              <IconMapPin className="shrink-0 mt-0.5" size={16} stroke={1.7} />
              <a
                href="https://www.google.com/maps?vet=10CAAQoqAOahcKEwig3a6Pj_iVAxUAAAAAHQAAAAAQDQ..i&rlz=1C1FKPE_viVN1213VN1213&pvq=Cg0vZy8xMWtyZDk3eV9fIisKJXRyxrDhu51uZyBjYW8gxJHhurNuZyBmcHQgcG9seXRlY2huaWMQAhgD&lqi=Cjl0csaw4budbmcgY2FvIMSR4bqzbmcgZnB0IHBvbHl0ZWNobmljIGjDoCBu4buZaSBow6AgbuG7mWlI_-_PxN2xgIAIWlcQABABEAIQAxAEGAAYARgCGAMYBBgFGAYYBxgIIjl0csaw4budbmcgY2FvIMSR4bqzbmcgZnB0IHBvbHl0ZWNobmljIGjDoCBu4buZaSBow6AgbuG7mWmSAQdjb2xsZWdlmgEjQ2haRFNVaE5NRzluUzBWSlEwRm5TVU42Y1V4SFZrcFJFQUX6AQQIABA2&fvr=1&cs=1&um=1&ie=UTF-8&fb=1&gl=vn&sa=X&ftid=0x313455e940879933:0xcf10b34e9f1a03df"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                Tòa nhà FPT Polytechnic, Cổng số 2, 13 Trịnh Văn Bô, Xuân Phương, Hà Nội 100000
              </a>
            </li>
            <li className="flex gap-2 items-center">
              <IconPhone className="shrink-0" size={16} stroke={1.7} />
              <a href="tel:0327990059" className="hover:text-white">0327 990 059</a>
            </li>
            <li className="flex gap-2 items-center">
              <IconMail className="shrink-0" size={16} stroke={1.7} />
              <a href="mailto:nemcsb@gmail.com" className="hover:text-white">nemcsb@gmail.com</a>
            </li>
          </ul>
        </div>

        {/* Chính sách */}
        <div>
          <p className="text-gold font-semibold mb-4 text-sm tracking-wide">CHÍNH SÁCH</p>
          <ul className="space-y-2.5 text-sm text-stone-400">
            <li><Link to="/chinh-sach-doi-tra" className="hover:text-white">Chính sách đổi trả</Link></li>
            <li><Link to="/chinh-sach-van-chuyen" className="hover:text-white">Chính sách vận chuyển</Link></li>
            <li><Link to="/chinh-sach-bao-mat" className="hover:text-white">Chính sách bảo mật</Link></li>
            <li><Link to="/dieu-khoan-su-dung" className="hover:text-white">Điều khoản sử dụng</Link></li>
          </ul>
        </div>

        {/* Danh mục -- luôn khớp 4 nhóm cha ở mega-menu Header vì tải cùng 1 API. */}
        <div>
          <p className="text-gold font-semibold mb-4 text-sm tracking-wide">DANH MỤC</p>
          <ul className="space-y-2.5 text-sm text-stone-400">
            {categories.map((c) => (
              <li key={c.categoryId}>
                <Link to={`/shop?category=${c.slug}`} className="hover:text-white">
                  {c.categoryName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-800">
        <div className="max-w-[1600px] mx-auto px-6 py-5 text-xs text-stone-500 text-center leading-relaxed">
          <p>NOVACART — Giấy chứng nhận đăng ký kinh doanh cấp tại Hà Nội.</p>
          <p>© {new Date().getFullYear()} NovaCart. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}