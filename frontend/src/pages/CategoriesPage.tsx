import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'

const CATEGORIES = [
  { slug: 'ao-thun', name: 'Áo thun', image: 'https://picsum.photos/seed/cat-ao-thun/600/750' },
  { slug: 'ao-so-mi', name: 'Áo sơ mi', image: 'https://picsum.photos/seed/cat-ao-so-mi/600/750' },
  { slug: 'quan-jean', name: 'Quần jean', image: 'https://picsum.photos/seed/cat-quan-jean/600/750' },
  { slug: 'quan-tay', name: 'Quần tây', image: 'https://picsum.photos/seed/cat-quan-tay/600/750' },
  { slug: 'ao-khoac', name: 'Áo khoác', image: 'https://picsum.photos/seed/cat-ao-khoac/600/750' },
]

export default function CategoriesPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <BackButton />
        <h1 className="text-2xl font-semibold text-stone-900 mb-2">Danh mục sản phẩm</h1>
        <p className="text-stone-500 mb-8">Chọn 1 danh mục để xem toàn bộ sản phẩm bên trong</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => navigate(`/shop?category=${c.slug}`)}
              className="group relative aspect-[4/5] overflow-hidden bg-stone-200 text-left"
            >
              <img
                src={c.image}
                alt={c.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <span className="absolute bottom-4 left-4 text-white text-lg font-semibold">
                {c.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}