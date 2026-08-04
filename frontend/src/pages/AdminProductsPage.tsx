import { useEffect, useState } from 'react'
import {
  createAdminProductApi,
  deleteAdminProductApi,
  getAdminBrandsApi,
  getAdminCategoriesApi,
  getAdminProductsApi,
  updateAdminProductApi,
  type AdminBrandDto,
  type AdminCategoryDto,
  type AdminProductDto,
  type AdminProductPayload,
  type AdminVariantDto,
} from '../api/adminApi'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

const EMPTY_FORM: AdminProductPayload = {
  productName: '',
  description: '',
  categoryId: 0,
  brandId: null,
  price: 0,
  salePrice: null,
  material: '',
  status: 'ACTIVE',
  imageUrls: [''],
  variants: [{ variantId: null, size: '', color: '', stockQuantity: 0 }],
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProductDto[]>([])
  const [categories, setCategories] = useState<AdminCategoryDto[]>([])
  const [brands, setBrands] = useState<AdminBrandDto[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<AdminProductPayload>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getAdminCategoriesApi(), getAdminBrandsApi()]).then(([cats, brs]) => {
      setCategories(cats)
      setBrands(brs)
    })
  }, [])

  useEffect(() => {
    loadProducts()
  }, [keyword])

  async function loadProducts() {
    setLoading(true)
    try {
      const res = await getAdminProductsApi(keyword, 0, 50)
      setProducts(res.content)
    } finally {
      setLoading(false)
    }
  }

  function openCreateForm() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.categoryId ?? 0 })
    setError(null)
    setShowForm(true)
  }

  function openEditForm(p: AdminProductDto) {
    setEditingId(p.productId)
    setForm({
      productName: p.productName,
      description: p.description ?? '',
      categoryId: p.categoryId ?? 0,
      brandId: p.brandId,
      price: p.price,
      salePrice: p.salePrice,
      material: p.material ?? '',
      status: p.status,
      imageUrls: p.imageUrls.length > 0 ? p.imageUrls : [''],
      variants:
        p.variants.length > 0
          ? p.variants.map((v) => ({ variantId: v.variantId, size: v.size, color: v.color, stockQuantity: v.stockQuantity }))
          : [{ variantId: null, size: '', color: '', stockQuantity: 0 }],
    })
    setError(null)
    setShowForm(true)
  }

  async function handleSubmit() {
    setError(null)
    const payload: AdminProductPayload = {
      ...form,
      imageUrls: form.imageUrls.filter((u) => u.trim() !== ''),
      variants: form.variants.filter((v) => v.size.trim() !== '' && v.color.trim() !== ''),
    }
    if (payload.variants.length === 0) {
      setError('Cần ít nhất 1 phân loại (size/màu)')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateAdminProductApi(editingId, payload)
      } else {
        await createAdminProductApi(payload)
      }
      setShowForm(false)
      await loadProducts()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể lưu sản phẩm')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(productId: number) {
    if (!confirm('Ẩn sản phẩm này? (dữ liệu đơn hàng cũ vẫn được giữ nguyên)')) return
    await deleteAdminProductApi(productId)
    await loadProducts()
  }

  // ----- helper sửa form -----
  function updateVariant(index: number, patch: Partial<AdminVariantDto>) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }))
  }
  function addVariantRow() {
    setForm((f) => ({ ...f, variants: [...f.variants, { variantId: null, size: '', color: '', stockQuantity: 0 }] }))
  }
  function removeVariantRow(index: number) {
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== index) }))
  }
  function updateImage(index: number, url: string) {
    setForm((f) => ({ ...f, imageUrls: f.imageUrls.map((u, i) => (i === index ? url : u)) }))
  }
  function addImageRow() {
    setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ''] }))
  }
  function removeImageRow(index: number) {
    setForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((_, i) => i !== index) }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Quản lý sản phẩm</h1>
        <button onClick={openCreateForm} className="bg-orange-700 hover:bg-orange-600 text-white text-sm px-4 py-2">
          + Thêm sản phẩm
        </button>
      </div>

      <input
        placeholder="Tìm theo tên sản phẩm..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        className="w-72 border border-stone-300 px-3 py-2 text-sm mb-4"
      />

      {loading ? (
        <p className="text-stone-500">Đang tải...</p>
      ) : (
        <div className="bg-white border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-left text-stone-500">
              <tr>
                <th className="px-4 py-3">Tên sản phẩm</th>
                <th className="px-4 py-3">Danh mục</th>
                <th className="px-4 py-3">Giá</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Tồn kho</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((p) => (
                <tr key={p.productId}>
                  <td className="px-4 py-3 font-medium">{p.productName}</td>
                  <td className="px-4 py-3">{p.categoryName}</td>
                  <td className="px-4 py-3">
                    {p.salePrice ? (
                      <>
                        <span className="text-orange-700">{formatVnd(p.salePrice)}</span>{' '}
                        <span className="text-stone-400 line-through text-xs">{formatVnd(p.price)}</span>
                      </>
                    ) : (
                      formatVnd(p.price)
                    )}
                  </td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3">{p.variants.reduce((s, v) => s + v.stockQuantity, 0)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEditForm(p)} className="text-xs border border-stone-300 px-2 py-1 hover:border-stone-900">
                        Sửa
                      </button>
                      <button onClick={() => handleDelete(p.productId)} className="text-xs border border-red-300 text-red-600 px-2 py-1 hover:bg-red-50">
                        Ẩn
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                    Không có sản phẩm nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Form thêm/sửa dạng overlay, không tách modal riêng */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center overflow-y-auto py-10 z-50">
          <div className="bg-white w-full max-w-2xl p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">
              {editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
            </h2>

            {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                placeholder="Tên sản phẩm"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                className="col-span-2 border border-stone-300 px-3 py-2 text-sm"
              />
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                className="border border-stone-300 px-3 py-2 text-sm"
              >
                <option value={0}>-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.categoryName}
                  </option>
                ))}
              </select>
              <select
                value={form.brandId ?? ''}
                onChange={(e) => setForm({ ...form, brandId: e.target.value ? Number(e.target.value) : null })}
                className="border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="">-- Không thương hiệu --</option>
                {brands.map((b) => (
                  <option key={b.brandId} value={b.brandId}>
                    {b.brandName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Giá gốc"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="border border-stone-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Giá khuyến mãi (bỏ trống nếu không giảm)"
                value={form.salePrice ?? ''}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value ? Number(e.target.value) : null })}
                className="border border-stone-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Chất liệu"
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                className="border border-stone-300 px-3 py-2 text-sm"
              />
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as AdminProductPayload['status'] })}
                className="border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
              </select>
              <textarea
                placeholder="Mô tả sản phẩm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="col-span-2 border border-stone-300 px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            <p className="text-xs font-medium text-stone-600 mb-2 mt-4">Ảnh sản phẩm (URL, ảnh đầu = thumbnail)</p>
            {form.imageUrls.map((url, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={url}
                  onChange={(e) => updateImage(i, e.target.value)}
                  placeholder="https://..."
                  className="flex-1 border border-stone-300 px-3 py-2 text-sm"
                />
                <button onClick={() => removeImageRow(i)} className="text-red-600 text-xs px-2">
                  Xoá
                </button>
              </div>
            ))}
            <button onClick={addImageRow} className="text-xs text-orange-700 mb-4">
              + Thêm ảnh
            </button>

            <p className="text-xs font-medium text-stone-600 mb-2">Phân loại (size/màu/tồn kho)</p>
            {form.variants.map((v, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  placeholder="Size"
                  value={v.size}
                  onChange={(e) => updateVariant(i, { size: e.target.value })}
                  className="w-20 border border-stone-300 px-2 py-2 text-sm"
                />
                <input
                  placeholder="Màu"
                  value={v.color}
                  onChange={(e) => updateVariant(i, { color: e.target.value })}
                  className="w-24 border border-stone-300 px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Tồn kho"
                  value={v.stockQuantity}
                  onChange={(e) => updateVariant(i, { stockQuantity: Number(e.target.value) })}
                  className="w-24 border border-stone-300 px-2 py-2 text-sm"
                />
                <button onClick={() => removeVariantRow(i)} className="text-red-600 text-xs px-2">
                  Xoá
                </button>
              </div>
            ))}
            <button onClick={addVariantRow} className="text-xs text-orange-700 mb-6">
              + Thêm phân loại
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-orange-700 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold px-6 py-3"
              >
                {saving ? 'Đang lưu...' : 'Lưu sản phẩm'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-3 border border-stone-300 text-sm hover:bg-stone-50"
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}