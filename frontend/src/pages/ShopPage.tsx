import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiClient } from '../api/apiClient'
import BackButton from '../components/BackButton'

interface CategoryDto {
  categoryId: number
  categoryName: string
  slug: string
  imageUrl?: string | null
  children?: CategoryDto[]
}

interface ProductDto {
  productId: number
  productName: string
  slug: string
  price: number
  salePrice: number | null
  thumbnailUrl: string | null
  categoryName: string | null
  brandName: string | null
}

interface PageResponse<T> {
  content: T[]
  totalPages: number
  currentPage: number
}

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categorySlug = searchParams.get('category') ?? ''
  const keyword = searchParams.get('keyword') ?? ''

  // Cây danh mục 2 cấp như trả về từ API (nhóm cha + danh mục con)
  const [categoryTree, setCategoryTree] = useState<CategoryDto[]>([])
  // Làm phẳng cây (cha + con) để tra cứu theo slug và để tương thích với
  // các danh mục lá không có nhóm cha (VD: "Bộ đồ")
  const flatCategories: CategoryDto[] = categoryTree.flatMap((g) => [g, ...(g.children ?? [])])

  const [products, setProducts] = useState<ProductDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient.get<CategoryDto[]>('/home/categories').then((res) => setCategoryTree(res.data))
  }, [])

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, keyword, categoryTree])

  async function loadProducts() {
    setLoading(true)
    try {
      let res
      if (keyword) {
        res = await apiClient.get<PageResponse<ProductDto>>('/home/products/search', {
          params: { keyword, page: 0, size: 24 },
        })
      } else if (categorySlug) {
        const cat = flatCategories.find((c) => c.slug === categorySlug)
        if (!cat) {
          if (flatCategories.length === 0) return
          res = await apiClient.get<PageResponse<ProductDto>>('/home/products/newest', {
            params: { page: 0, size: 24 },
          })
        } else {
          // Backend tự gom sản phẩm của danh mục con nếu đây là danh mục cha
          res = await apiClient.get<PageResponse<ProductDto>>(`/home/products/category/${cat.categoryId}`, {
            params: { page: 0, size: 24 },
          })
        }
      } else {
        res = await apiClient.get<PageResponse<ProductDto>>('/home/products/newest', {
          params: { page: 0, size: 24 },
        })
      }
      setProducts(res.data.content)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const currentCategoryName = flatCategories.find((c) => c.slug === categorySlug)?.categoryName

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <BackButton />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">
              {keyword ? `Kết quả cho "${keyword}"` : currentCategoryName || 'Tất cả sản phẩm'}
            </h1>
            <p className="text-stone-500 text-sm mt-1">{products.length} sản phẩm</p>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="w-56 flex-shrink-0 hidden md:block">
            <p className="text-xs font-semibold text-stone-500 uppercase mb-3">Danh mục</p>
            <div className="space-y-4">
              <button
                onClick={() => setSearchParams({})}
                className={`block w-full text-left text-sm px-3 py-2 ${
                  !categorySlug ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Tất cả
              </button>

              {categoryTree.map((group) => (
                <div key={group.categoryId}>
                  <button
                    onClick={() => setSearchParams({ category: group.slug })}
                    className={`block w-full text-left text-xs font-semibold uppercase tracking-wide px-3 py-1.5 ${
                      categorySlug === group.slug ? 'text-orange-700' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {group.categoryName}
                  </button>
                  {group.children && group.children.length > 0 && (
                    <div className="space-y-0.5">
                      {group.children.map((c) => (
                        <button
                          key={c.categoryId}
                          onClick={() => setSearchParams({ category: c.slug })}
                          className={`block w-full text-left text-sm px-3 py-1.5 ${
                            categorySlug === c.slug ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          {c.categoryName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          <div className="flex-1">
            {loading ? (
              <p className="text-stone-500">Đang tải sản phẩm...</p>
            ) : products.length === 0 ? (
              <div className="bg-white border border-stone-200 p-10 text-center text-stone-500">
                Không tìm thấy sản phẩm nào phù hợp.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {products.map((p) => (
                  <Link key={p.productId} to={`/products/${p.productId}`} className="group block">
                    <div className="aspect-[3/4] bg-stone-200 overflow-hidden mb-3">
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt={p.productName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">
                          Chưa có ảnh
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-stone-900 font-medium">{p.productName}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      {p.salePrice ? (
                        <>
                          <span className="text-sm font-semibold text-orange-700">{formatVnd(p.salePrice)}</span>
                          <span className="text-xs text-stone-400 line-through">{formatVnd(p.price)}</span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-stone-900">{formatVnd(p.price)}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
