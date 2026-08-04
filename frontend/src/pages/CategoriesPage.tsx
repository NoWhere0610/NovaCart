import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { apiClient } from '../api/apiClient'
import type { MegaMenuCategory } from '../components/CategoryMegaMenu'
import { DEMO_CATEGORIES } from '../data/demoCategories'

function CategoryCard({ category, onClick }: { category: MegaMenuCategory; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-[4/5] overflow-hidden bg-stone-200 text-left shadow-sm hover:shadow-lg transition-shadow"
    >
      {category.imageUrl ? (
        <img
          src={category.imageUrl}
          alt={category.categoryName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full bg-stone-200" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-gold transition-colors" />
      <span className="absolute bottom-4 left-4 right-4 text-white font-display text-lg font-semibold">
        {category.categoryName}
      </span>
    </button>
  )
}

export default function CategoriesPage() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<MegaMenuCategory[]>(DEMO_CATEGORIES)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<MegaMenuCategory[]>('/home/categories')
      .then((res) => {
        if (!cancelled && res.data && res.data.length > 0) setGroups(res.data)
      })
      .catch(() => {
        /* giữ nguyên danh mục demo nếu API lỗi */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Danh mục KHÔNG có con (trường hợp thực tế hiện tại — 5 danh mục phẳng) gộp chung vào 1 lưới duy
  // nhất, thay vì mỗi cái tách thành 1 section riêng chỉ chứa đúng 1 thẻ (lặp lại tên, tốn diện tích).
  // Danh mục CÓ con (nếu sau này thêm phân cấp) vẫn hiển thị theo từng nhóm như cũ.
  const leafCategories = groups.filter((g) => !g.children || g.children.length === 0)
  const groupsWithChildren = groups.filter((g) => g.children && g.children.length > 0)

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-[1600px] mx-auto">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-stone-900 mb-2">Danh mục sản phẩm</h1>
        <p className="text-stone-500 mb-10">Chọn 1 danh mục để xem toàn bộ sản phẩm bên trong</p>

        {leafCategories.length > 0 && (
          <section className="mb-12">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {leafCategories.map((c) => (
                <CategoryCard key={c.categoryId} category={c} onClick={() => navigate(`/shop?category=${c.slug}`)} />
              ))}
            </div>
          </section>
        )}

        {groupsWithChildren.map((group) => (
          <section key={group.categoryId} className="mb-12">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-stone-900">{group.categoryName}</h2>
              <button
                onClick={() => navigate(`/shop?category=${group.slug}`)}
                className="text-xs text-stone-500 hover:text-gold-dark underline"
              >
                Xem tất cả {group.categoryName.toLowerCase()}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {group.children!.map((c) => (
                <CategoryCard key={c.categoryId} category={c} onClick={() => navigate(`/shop?category=${c.slug}`)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
