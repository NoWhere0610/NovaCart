import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { apiClient } from '../api/apiClient'
import type { MegaMenuCategory } from '../components/CategoryMegaMenu'
import { DEMO_CATEGORIES } from '../data/demoCategories'

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

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <BackButton />
        <h1 className="text-2xl font-semibold text-stone-900 mb-2">Danh mục sản phẩm</h1>
        <p className="text-stone-500 mb-10">Chọn 1 danh mục để xem toàn bộ sản phẩm bên trong</p>

        {groups.map((group) => {
          const items = group.children && group.children.length > 0 ? group.children : [group]
          return (
            <section key={group.categoryId} className="mb-12">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg font-semibold text-stone-900">{group.categoryName}</h2>
                {group.children && group.children.length > 0 && (
                  <button
                    onClick={() => navigate(`/shop?category=${group.slug}`)}
                    className="text-xs text-stone-500 hover:text-orange-700 underline"
                  >
                    Xem tất cả {group.categoryName.toLowerCase()}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {items.map((c) => (
                  <button
                    key={c.categoryId}
                    onClick={() => navigate(`/shop?category=${c.slug}`)}
                    className="group relative aspect-[4/5] overflow-hidden bg-stone-200 text-left"
                  >
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt={c.categoryName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-stone-200" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <span className="absolute bottom-4 left-4 text-white text-lg font-semibold">
                      {c.categoryName}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
