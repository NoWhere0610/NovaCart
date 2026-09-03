import { Fragment, useEffect, useState } from 'react'
import {
  createAdminProductApi,
  deleteAdminProductApi,
  getAdminBrandsApi,
  getAdminCategoriesApi,
  getAdminProductsApi,
  updateAdminInventoryItemApi,
  updateAdminProductApi,
  uploadAdminProductImageApi,
  type AdminBrandDto,
  type AdminCategoryDto,
  type AdminProductDto,
  type AdminProductPayload,
  type AdminVariantDto,
} from '../api/adminApi'
import { COLOR_SWATCHES, colorToHex } from '../utils/colorSwatches'
import { useConfirmDialog } from '../hooks/useConfirmDialog'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

// Nhãn field trong form thêm/sửa sản phẩm -- sao đỏ đánh dấu field bắt buộc (mọi field đều bắt buộc,
// trừ SKU của phân loại).
function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="text-xs font-medium text-stone-600 mb-1 block">
      {text}
      {required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  )
}

// Khớp đúng FULL_SIZES ở ProductDetailPage/ShopPage -- admin chọn từ đúng danh sách khách hàng thấy,
// không gõ tay để tránh lệch chính tả (vd "XL " thừa dấu cách sẽ không khớp filter bên Shop).
const FULL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL']

// Danh sách chất liệu đã dùng trong dữ liệu sản phẩm hiện có (menswear_db_mssql.sql) -- cho chọn thay vì
// gõ tay để tránh trùng nghĩa khác chữ (vd "Cotton" vs "cotton 100%").
const MATERIAL_OPTIONS = [
  'Cotton',
  'Cotton 100%',
  'Cotton Oxford',
  'Cotton Pique',
  'Cotton co giãn',
  'Cotton lạnh',
  'Cá sấu',
  'Cá sấu Pique',
  'Da PU',
  'Denim',
  'Denim co giãn',
  'Dù 2 lớp',
  'Gấm',
  'Kaki',
  'Kaki cao cấp',
  'Kaki co giãn',
  'Kate lụa',
  'Len',
  'Linen',
  'Lụa',
  'Modal',
  'Nhung',
  'Oxford',
  'Thun co giãn',
  'Tweed',
  'Vải co giãn',
  'Vải the',
  'Vải tre',
  'Wool blend',
]

// Khớp đúng AdminInventoryService.LOW_STOCK_THRESHOLD bên backend -- cùng 1 định nghĩa "sắp hết hàng".
const LOW_STOCK_THRESHOLD = 5

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
  variants: [{ variantId: null, size: '', color: '', sku: '', stockQuantity: 0 }],
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProductDto[]>([])
  const [categories, setCategories] = useState<AdminCategoryDto[]>([])
  const [brands, setBrands] = useState<AdminBrandDto[]>([])
  const [keyword, setKeyword] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<AdminProductPayload>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingIndexes, setUploadingIndexes] = useState<Set<number>>(new Set())
  const { confirm, dialog } = useConfirmDialog()

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
          ? p.variants.map((v) => ({
              variantId: v.variantId,
              size: v.size,
              color: v.color,
              sku: v.sku ?? '',
              stockQuantity: v.stockQuantity,
            }))
          : [{ variantId: null, size: '', color: '', sku: '', stockQuantity: 0 }],
    })
    setError(null)
    setShowForm(true)
  }

  async function quickAdjustStock(productId: number, variantId: number, delta: number) {
    const product = products.find((p) => p.productId === productId)
    const variant = product?.variants.find((v) => v.variantId === variantId)
    if (!product || !variant) return
    const newStock = Math.max(0, variant.stockQuantity + delta)
    setProducts((prev) =>
      prev.map((p) =>
        p.productId !== productId
          ? p
          : { ...p, variants: p.variants.map((v) => (v.variantId === variantId ? { ...v, stockQuantity: newStock } : v)) },
      ),
    )
    try {
      await updateAdminInventoryItemApi(variantId, {
        size: variant.size,
        color: variant.color,
        sku: variant.sku ?? '',
        stockQuantity: newStock,
      })
    } catch {
      await loadProducts()
    }
  }

  async function handleSubmit() {
    setError(null)
    if (uploadingIndexes.size > 0) {
      setError('Vui lòng đợi ảnh tải lên xong')
      return
    }
    if (form.productName.trim() === '') {
      setError('Vui lòng nhập tên sản phẩm')
      return
    }
    if (!form.categoryId) {
      setError('Vui lòng chọn danh mục')
      return
    }
    if (!form.price || form.price <= 0) {
      setError('Vui lòng nhập giá gốc')
      return
    }
    if (!form.material || form.material.trim() === '') {
      setError('Vui lòng chọn/nhập chất liệu')
      return
    }
    if (!form.description || form.description.trim() === '') {
      setError('Vui lòng nhập mô tả sản phẩm')
      return
    }
    const imageUrls = form.imageUrls.filter((u) => u.trim() !== '')
    if (imageUrls.length === 0) {
      setError('Cần ít nhất 1 ảnh sản phẩm')
      return
    }
    if (form.variants.length === 0) {
      setError('Cần ít nhất 1 phân loại (size/màu)')
      return
    }
    for (const v of form.variants) {
      if (v.size.trim() === '' || v.color.trim() === '') {
        setError('Mỗi phân loại cần chọn đủ size và màu')
        return
      }
      if (v.stockQuantity === null || v.stockQuantity === undefined || Number.isNaN(v.stockQuantity) || v.stockQuantity < 0) {
        setError('Vui lòng nhập tồn kho hợp lệ cho mỗi phân loại')
        return
      }
    }
    const payload: AdminProductPayload = { ...form, imageUrls }
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
    if (!(await confirm('Ẩn sản phẩm này? (dữ liệu đơn hàng cũ vẫn được giữ nguyên)'))) return
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
    setForm((f) => ({ ...f, variants: [...f.variants, { variantId: null, size: '', color: '', sku: '', stockQuantity: 0 }] }))
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
  async function handleImageFileChange(index: number, file: File | null) {
    if (!file) return
    setUploadingIndexes((prev) => new Set(prev).add(index))
    setError(null)
    try {
      const url = await uploadAdminProductImageApi(file)
      updateImage(index, url)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể tải ảnh lên')
    } finally {
      setUploadingIndexes((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }

  return (
    <div>
      {dialog}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Quản lý sản phẩm</h1>
        <button onClick={openCreateForm} className="bg-orange-700 hover:bg-orange-600 text-white text-sm px-4 py-2">
          + Thêm sản phẩm
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          placeholder="Tìm theo tên sản phẩm..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-72 border border-stone-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Chỉ hiện sắp hết hàng
        </label>
      </div>

      {loading ? (
        <p className="text-stone-500">Đang tải...</p>
      ) : (
        <div className="bg-white border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-left text-stone-500">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Tên sản phẩm</th>
                <th className="px-4 py-3">Danh mục</th>
                <th className="px-4 py-3">Giá</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Tồn kho</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products
                .filter((p) => !lowStockOnly || p.variants.some((v) => v.stockQuantity <= LOW_STOCK_THRESHOLD))
                .map((p) => {
                  const totalStock = p.variants.reduce((s, v) => s + v.stockQuantity, 0)
                  const hasLowStock = p.variants.some((v) => v.stockQuantity <= LOW_STOCK_THRESHOLD)
                  const expanded = expandedProductId === p.productId
                  return (
                    <Fragment key={p.productId}>
                      <tr>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedProductId(expanded ? null : p.productId)}
                            className="w-5 h-5 text-stone-500 hover:text-stone-900"
                            title="Xem biến thể / tồn kho"
                          >
                            {expanded ? '▾' : '▸'}
                          </button>
                        </td>
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
                        <td className={`px-4 py-3 ${hasLowStock ? 'text-red-600 font-semibold' : ''}`}>
                          {totalStock}
                          {hasLowStock && <span className="ml-1 text-xs font-normal">(sắp hết)</span>}
                        </td>
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
                      {expanded && (
                        <tr>
                          <td colSpan={7} className="px-4 py-3 bg-stone-50">
                            <table className="w-full text-xs">
                              <thead className="text-stone-500">
                                <tr>
                                  <th className="text-left font-normal py-1">Size</th>
                                  <th className="text-left font-normal py-1">Màu</th>
                                  <th className="text-left font-normal py-1">SKU</th>
                                  <th className="text-left font-normal py-1">Tồn kho</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.variants.map((v) => {
                                  const low = v.stockQuantity <= LOW_STOCK_THRESHOLD
                                  return (
                                    <tr key={v.variantId} className={low ? 'bg-red-50' : ''}>
                                      <td className="py-1.5">{v.size}</td>
                                      <td className="py-1.5">{v.color}</td>
                                      <td className="py-1.5 text-stone-500">{v.sku || '—'}</td>
                                      <td className="py-1.5">
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => quickAdjustStock(p.productId, v.variantId, -1)}
                                            className="w-6 h-6 border border-stone-300 text-stone-600 hover:border-stone-900"
                                          >
                                            −
                                          </button>
                                          <span className={`w-8 text-center font-semibold ${low ? 'text-red-600' : ''}`}>
                                            {v.stockQuantity}
                                          </span>
                                          <button
                                            onClick={() => quickAdjustStock(p.productId, v.variantId, 1)}
                                            className="w-6 h-6 border border-stone-300 text-stone-600 hover:border-stone-900"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
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
              <div className="col-span-2">
                <FieldLabel text="Tên sản phẩm" required />
                <input
                  placeholder="Tên sản phẩm"
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <FieldLabel text="Danh mục" required />
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value={0}>-- Chọn danh mục --</option>
                  {categories.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>
                      {c.categoryName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel text="Thương hiệu" />
                <select
                  value={form.brandId ?? ''}
                  onChange={(e) => setForm({ ...form, brandId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="">-- Không thương hiệu --</option>
                  {brands.map((b) => (
                    <option key={b.brandId} value={b.brandId}>
                      {b.brandName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel text="Giá gốc" required />
                <input
                  type="number"
                  placeholder="Giá gốc"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <FieldLabel text="Giá khuyến mãi" />
                <input
                  type="number"
                  placeholder="Bỏ trống nếu không giảm"
                  value={form.salePrice ?? ''}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <FieldLabel text="Chất liệu" required />
                <input
                  list="material-options"
                  placeholder="Chất liệu"
                  value={form.material}
                  onChange={(e) => setForm({ ...form, material: e.target.value })}
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                />
                <datalist id="material-options">
                  {MATERIAL_OPTIONS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <FieldLabel text="Trạng thái" required />
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as AdminProductPayload['status'] })}
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
                </select>
              </div>
              <div className="col-span-2">
                <FieldLabel text="Mô tả sản phẩm" required />
                <textarea
                  placeholder="Mô tả sản phẩm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <FieldLabel text="Ảnh sản phẩm (ảnh đầu = thumbnail)" required />
            {form.imageUrls.map((url, i) => {
              const uploading = uploadingIndexes.has(i)
              return (
                <div key={i} className="flex items-center gap-2 mb-2">
                  {url && (
                    <img src={url} alt="" className="w-10 h-10 object-cover border border-stone-200 shrink-0" />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => handleImageFileChange(i, e.target.files?.[0] ?? null)}
                    disabled={uploading}
                    className="flex-1 border border-stone-300 px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm"
                  />
                  {uploading && <span className="text-xs text-stone-500">Đang tải...</span>}
                  <button onClick={() => removeImageRow(i)} className="text-red-600 text-xs px-2">
                    Xoá
                  </button>
                </div>
              )
            })}
            <button onClick={addImageRow} className="text-xs text-orange-700 mb-4">
              + Thêm ảnh
            </button>

            <div className="flex items-center gap-3 mb-2">
              <FieldLabel text="Phân loại (size/màu/tồn kho)" required />
              <span className="text-xs text-stone-400">SKU không bắt buộc</span>
            </div>
            {form.variants.map((v, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select
                  value={v.size}
                  onChange={(e) => updateVariant(i, { size: e.target.value })}
                  className="w-20 border border-stone-300 px-2 py-2 text-sm"
                >
                  <option value="">Size</option>
                  {FULL_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5 border border-stone-300 px-2 py-2">
                  <span
                    className="w-4 h-4 rounded-full border border-stone-300 shrink-0"
                    style={{ backgroundColor: v.color ? colorToHex(v.color) : 'transparent' }}
                  />
                  <select
                    value={v.color}
                    onChange={(e) => updateVariant(i, { color: e.target.value })}
                    className="w-24 text-sm outline-none"
                  >
                    <option value="">Màu</option>
                    {Object.keys(COLOR_SWATCHES).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  placeholder="SKU (tuỳ chọn)"
                  value={v.sku ?? ''}
                  onChange={(e) => updateVariant(i, { sku: e.target.value })}
                  className="w-28 border border-stone-300 px-2 py-2 text-sm"
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