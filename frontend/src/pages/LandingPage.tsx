import { useNavigate } from 'react-router-dom'

// Ảnh nổi bật cho hero — dùng picsum (luôn tải được, ổn định) thay vì
// Unsplash Source (dịch vụ đã ngừng bảo trì chính thức, hay lỗi 503).
// Khi có ảnh sản phẩm thật, đổi URL này thành ảnh chụp thật của shop.
const HERO_IMAGE = 'https://picsum.photos/seed/menswear-hero/900/1100'

// Header/danh mục sản phẩm đã chuyển vào Header.tsx (dùng chung qua Layout)
// -> bỏ khối <header> từng có riêng ở đây để tránh render trùng 2 header.
export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <section className="flex-1 grid grid-cols-1 md:grid-cols-2 bg-stone-900">
        <div className="flex flex-col justify-center px-8 md:px-16 py-16 text-stone-50">
          <p className="text-orange-500 text-xs font-semibold tracking-widest uppercase mb-4">
            Bộ sưu tập mới
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            May đo
            <br />
            phong cách
            <br />
            của riêng bạn.
          </h1>
          <p className="text-stone-300 max-w-md mb-8">
            Trang phục nam tối giản, chất liệu bền và form dáng chuẩn — từ áo sơ mi công sở đến
            streetwear hằng ngày.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/shop')}
              className="bg-orange-700 hover:bg-orange-600 transition-colors text-white text-sm font-semibold px-6 py-3"
            >
              Mua ngay
            </button>
            <button
              onClick={() => navigate('/categories')}
              className="border border-stone-400 hover:border-stone-50 transition-colors text-stone-50 text-sm font-semibold px-6 py-3"
            >
              Xem danh mục
            </button>
          </div>
        </div>

        <div className="relative hidden md:block overflow-hidden">
          <img src={HERO_IMAGE} alt="Sản phẩm nổi bật" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-stone-900/40" />
        </div>
      </section>
    </div>
  )
}
