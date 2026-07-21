import { useEffect, useState, type FormEvent } from 'react'
import {
  createAdminBrandApi,
  createAdminCategoryApi,
  deleteAdminBrandApi,
  deleteAdminCategoryApi,
  getAdminBrandsApi,
  getAdminCategoriesApi,
  type AdminBrandDto,
  type AdminCategoryDto,
} from '../api/adminApi'

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategoryDto[]>([])
  const [brands, setBrands] = useState<AdminBrandDto[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newBrandName, setNewBrandName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [cats, brs] = await Promise.all([getAdminCategoriesApi(), getAdminBrandsApi()])
      setCategories(cats)
      setBrands(brs)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    await createAdminCategoryApi({ categoryName: newCategoryName })
    setNewCategoryName('')
    await loadAll()
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm('Ẩn danh mục này? (sản phẩm cũ vẫn giữ nguyên, chỉ ẩn khỏi trang chủ)')) return
    await deleteAdminCategoryApi(id)
    await loadAll()
  }

  async function handleAddBrand(e: FormEvent) {
    e.preventDefault()
    if (!newBrandName.trim()) return
    await createAdminBrandApi(newBrandName)
    setNewBrandName('')
    await loadAll()
  }

  async function handleDeleteBrand(id: number) {
    if (!confirm('Xoá thương hiệu này? (chỉ xoá được nếu không còn sản phẩm nào dùng)')) return
    try {
      await deleteAdminBrandApi(id)
      await loadAll()
    } catch {
      alert('Không thể xoá — vẫn còn sản phẩm đang dùng thương hiệu này')
    }
  }

  if (loading) return <p className="text-stone-500">Đang tải...</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Danh mục */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900 mb-4">Danh mục</h1>
        <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
          <input
            placeholder="Tên danh mục mới"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 border border-stone-300 px-3 py-2 text-sm"
          />
          <button className="bg-orange-700 hover:bg-orange-600 text-white text-sm px-4 py-2">Thêm</button>
        </form>
        <div className="bg-white border border-stone-200 divide-y divide-stone-100">
          {categories.map((c) => (
            <div key={c.categoryId} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className={c.isActive ? '' : 'text-stone-400 line-through'}>
                {c.categoryName} {c.parentName && <span className="text-stone-400">← {c.parentName}</span>}
              </span>
              <button onClick={() => handleDeleteCategory(c.categoryId)} className="text-red-600 text-xs hover:underline">
                Ẩn
              </button>
            </div>
          ))}
          {categories.length === 0 && <p className="px-4 py-6 text-center text-stone-400 text-sm">Chưa có danh mục</p>}
        </div>
      </div>

      {/* Thương hiệu */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900 mb-4">Thương hiệu</h1>
        <form onSubmit={handleAddBrand} className="flex gap-2 mb-4">
          <input
            placeholder="Tên thương hiệu mới"
            value={newBrandName}
            onChange={(e) => setNewBrandName(e.target.value)}
            className="flex-1 border border-stone-300 px-3 py-2 text-sm"
          />
          <button className="bg-orange-700 hover:bg-orange-600 text-white text-sm px-4 py-2">Thêm</button>
        </form>
        <div className="bg-white border border-stone-200 divide-y divide-stone-100">
          {brands.map((b) => (
            <div key={b.brandId} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{b.brandName}</span>
              <button onClick={() => handleDeleteBrand(b.brandId)} className="text-red-600 text-xs hover:underline">
                Xoá
              </button>
            </div>
          ))}
          {brands.length === 0 && <p className="px-4 py-6 text-center text-stone-400 text-sm">Chưa có thương hiệu</p>}
        </div>
      </div>
    </div>
  )
}