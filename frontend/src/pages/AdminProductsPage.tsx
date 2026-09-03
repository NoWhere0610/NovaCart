import { Fragment, useEffect, useState } from 'react'
import {
  adjustAdminInventoryStockApi,
  createAdminProductApi,
  deleteAdminProductApi,
  getAdminBrandsApi,
  getAdminCategoriesApi,
  getAdminProductsApi,
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
import { useAuth } from '../contexts/AuthContext'

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

// Khớp đúng LOW_STOCK_THRESHOLD bên backend (AdminProductService/AdminInventoryService) -- cùng 1 định
// nghĩa "sắp hết hàng". Chỉ dùng để TÔ MÀU dòng; việc lọc do backend làm.
const LOW_STOCK_THRESHOLD = 5
const PAGE_SIZE = 20

const STATUS_LABELS: Record<AdminProductDto['status'], string> = {
  ACTIVE: 'Đang bán',
  INACTIVE: 'Đã ẩn',
  OUT_OF_STOCK: 'Hết hàng',
}

// Dòng ảnh trong form cần ID ỔN ĐỊNH, không dùng vị trí trong mảng: upload chạy bất đồng bộ, nếu trong
// lúc đợi mà admin xoá một dòng phía trên thì mọi dòng sau tụt 1 bậc -- URL upload xong sẽ ghi vào NHẦM
// dòng (đè mất ảnh khác) hoặc rơi vào khoảng trống rồi mất luôn.
type ImageRow = { id: number; url: string }
let imageRowSeq = 0
const newImageRow = (url = ''): ImageRow => ({ id: ++imageRowSeq, url })

type VariantRow = AdminVariantDto
type FormState = Omit<AdminProductPayload, 'imageUrls'> & { images: ImageRow[] }

const emptyVariant = (): VariantRow => ({
  variantId: null,
  size: '',
  color: '',
  sku: '',
  stockQuantity: 0,
  originalStockQuantity: null,
})

const emptyForm = (): FormState => ({
  productName: '',
  description: '',
  categoryId: 0,
  brandId: null,
  price: 0,
  salePrice: null,
  material: '',
  status: 'ACTIVE',
  images: [newImageRow()],
  variants: [emptyVariant()],
})

export default function AdminProductsPage() {
  const { user } = useAuth()
  // Tồn kho là dữ liệu CHỈ ADMIN được sửa (/api/admin/inventory/** khoá cứng ADMIN ở SecurityConfig).
  // Nhân viên vẫn xem được trang này, nên phải ẩn hẳn nút +/- thay vì để họ bấm rồi nhận 403 im lặng.
  const isAdmin = user?.roles.includes('ADMIN') ?? false

  const [products, setProducts] = useState<AdminProductDto[]>([])
  const [categories, setCategories] = useState<AdminCategoryDto[]>([])
  const [brands, setBrands] = useState<AdminBrandDto[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState<string | null>(null)
  const [adjustingVariantId, setAdjustingVariantId] = useState<number | null>(null)
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingIds, setUploadingIds] = useState<Set<number>>(new Set())
  const { confirm, dialog } = useConfirmDialog()

  useEffect(() => {
    Promise.all([getAdminCategoriesApi(), getAdminBrandsApi()]).then(([cats, brs]) => {
      setCategories(cats)
      setBrands(brs)
    })
  }, [])

  // Gõ tới đâu bắn request tới đó vừa nặng vừa dễ hiển thị kết quả của từ khoá CŨ (response về không
  // đúng thứ tự gửi) -- đợi người dùng ngừng gõ 350ms rồi mới tìm.
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(keywordInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [keywordInput])

  // Đổi từ khoá / bật-tắt bộ lọc thì phải về trang đầu, không thì đang ở trang 5 lọc ra 2 kết quả sẽ
  // thấy bảng trống.
  useEffect(() => {
    setPage(0)
  }, [keyword, lowStockOnly])

  useEffect(() => {
    loadProducts()
  }, [keyword, lowStockOnly, page])

  async function loadProducts() {
    setLoading(true)
    try {
      const res = await getAdminProductsApi(keyword, page, PAGE_SIZE, lowStockOnly)
      setProducts(res.content)
      setTotalPages(res.totalPages)
      setTotalElements(res.totalElements)
      setTableError(null)
    } catch (err: any) {
      setTableError(err.response?.data?.message ?? 'Không tải được danh sách sản phẩm')
    } finally {
      setLoading(false)
    }
  }

  function openCreateForm() {
    setEditingId(null)
    setForm({ ...emptyForm(), categoryId: categories[0]?.categoryId ?? 0 })
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
      images: (p.imageUrls.length > 0 ? p.imageUrls : ['']).map(newImageRow),
      variants:
        p.variants.length > 0
          ? p.variants.map((v) => ({
              variantId: v.variantId,
              size: v.size,
              color: v.color,
              sku: v.sku ?? '',
              stockQuantity: v.stockQuantity,
              // Số tồn kho form vừa đọc được. Backend dùng nó để biết admin có thật sự đổi tồn kho
              // hay chỉ gửi lại nguyên si khi sửa mô tả/giá -- xem AdminProductService.applyStock.
              originalStockQuantity: v.stockQuantity,
            }))
          : [emptyVariant()],
    })
    setError(null)
    setShowForm(true)
  }

  /**
   * Điều chỉnh nhanh tồn kho: gửi MỨC THAY ĐỔI (+1/-1) và lấy số tồn kho THẬT do backend trả về.
   * Không cập nhật lạc quan trước nữa -- con số hiển thị luôn là con số trong DB.
   */
  async function quickAdjustStock(productId: number, variantId: number, delta: number) {
    setAdjustingVariantId(variantId)
    setTableError(null)
    try {
      const stockQuantity = await adjustAdminInventoryStockApi(variantId, delta)
      setProducts((prev) =>
        prev.map((p) =>
          p.productId !== productId
            ? p
            : { ...p, variants: p.variants.map((v) => (v.variantId === variantId ? { ...v, stockQuantity } : v)) },
        ),
      )
    } catch (err: any) {
      // Trước đây catch rỗng: 403 (không đủ quyền), 400 (giảm quá số còn lại) hay mất mạng đều im lặng
      // như nhau, người dùng chỉ thấy con số nhấp nháy rồi trở lại mà không hiểu vì sao.
      setTableError(err.response?.data?.message ?? 'Không điều chỉnh được tồn kho, vui lòng thử lại')
      await loadProducts()
    } finally {
      setAdjustingVariantId(null)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (uploadingIds.size > 0) {
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
    if (form.salePrice != null && form.salePrice > form.price) {
      setError('Giá khuyến mãi không được cao hơn giá gốc')
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
    const imageUrls = form.images.map((r) => r.url).filter((u) => u.trim() !== '')
    if (imageUrls.length === 0) {
      setError('Cần ít nhất 1 ảnh sản phẩm')
      return
    }
    if (form.variants.length === 0) {
      setError('Cần ít nhất 1 phân loại (size/màu)')
      return
    }
    const seen = new Set<string>()
    for (const v of form.variants) {
      if (v.size.trim() === '' || v.color.trim() === '') {
        setError('Mỗi phân loại cần chọn đủ size và màu')
        return
      }
      // Cùng size+màu 2 lần sẽ vi phạm uq_product_size_color ở DB -- báo ngay tại form thay vì đợi lỗi
      // từ server rồi hiển thị thông báo chung chung.
      const key = `${v.size.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`
      if (seen.has(key)) {
        setError(`Phân loại "${v.size} / ${v.color}" bị nhập 2 lần`)
        return
      }
      seen.add(key)
      if (v.stockQuantity === null || v.stockQuantity === undefined || Number.isNaN(v.stockQuantity) || v.stockQuantity < 0) {
        setError('Vui lòng nhập tồn kho hợp lệ cho mỗi phân loại')
        return
      }
    }
    const { images, ...rest } = form
    const payload: AdminProductPayload = { ...rest, imageUrls }
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
    try {
      await deleteAdminProductApi(productId)
      await loadProducts()
    } catch (err: any) {
      setTableError(err.response?.data?.message ?? 'Không thể ẩn sản phẩm')
    }
  }

  // ----- helper sửa form -----
  function updateVariant(index: number, patch: Partial<VariantRow>) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }))
  }
  function addVariantRow() {
    setForm((f) => ({ ...f, variants: [...f.variants, emptyVariant()] }))
  }
  function removeVariantRow(index: number) {
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== index) }))
  }
  function updateImage(id: number, url: string) {
    // Tìm theo id: dòng có thể đã bị xoá trong lúc chờ upload -> URL đơn giản bị bỏ qua, không ghi nhầm dòng.
    setForm((f) => ({ ...f, images: f.images.map((r) => (r.id === id ? { ...r, url } : r)) }))
  }
  function addImageRow() {
    setForm((f) => ({ ...f, images: [...f.images, newImageRow()] }))
  }
  function removeImageRow(id: number) {
    setForm((f) => ({ ...f, images: f.images.filter((r) => r.id !== id) }))
  }
  async function handleImageFileChange(id: number, file: File | null) {
    if (!file) return
    setUploadingIds((prev) => new Set(prev).add(id))
    setError(null)
    try {
      const url = await uploadAdminProductImageApi(file)
      updateImage(id, url)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể tải ảnh lên')
    } finally {
      setUploadingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const rangeFrom = totalElements === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeTo = page * PAGE_SIZE + products.length

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
          placeholder="Tìm theo tên sản phẩm hoặc SKU..."
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          className="w-72 border border-stone-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Chỉ hiện sắp hết hàng (≤ {LOW_STOCK_THRESHOLD})
        </label>
        <span className="text-sm text-stone-500 ml-auto">
          {loading ? 'Đang tải...' : `Hiển thị ${rangeFrom}–${rangeTo} trong ${totalElements} sản phẩm`}
        </span>
      </div>

      {tableError && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{tableError}</div>
      )}

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
              {products.map((p) => {
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
                      <td className="px-4 py-3">
                        <span className={p.status === 'ACTIVE' ? '' : 'text-stone-500'}>
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
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
                                const busy = adjustingVariantId === v.variantId
                                return (
                                  <tr key={v.variantId} className={low ? 'bg-red-50' : ''}>
                                    <td className="py-1.5">{v.size}</td>
                                    <td className="py-1.5">{v.color}</td>
                                    <td className="py-1.5 text-stone-500">{v.sku || '—'}</td>
                                    <td className="py-1.5">
                                      <div className="flex items-center gap-2">
                                        {isAdmin && (
                                          <button
                                            onClick={() => quickAdjustStock(p.productId, v.variantId, -1)}
                                            disabled={busy}
                                            className="w-6 h-6 border border-stone-300 text-stone-600 hover:border-stone-900 disabled:opacity-40"
                                          >
                                            −
                                          </button>
                                        )}
                                        <span className={`w-8 text-center font-semibold ${low ? 'text-red-600' : ''}`}>
                                          {v.stockQuantity}
                                        </span>
                                        {isAdmin && (
                                          <button
                                            onClick={() => quickAdjustStock(p.productId, v.variantId, 1)}
                                            disabled={busy}
                                            className="w-6 h-6 border border-stone-300 text-stone-600 hover:border-stone-900 disabled:opacity-40"
                                          >
                                            +
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          {!isAdmin && (
                            <p className="text-xs text-stone-400 mt-2">Chỉ Quản trị viên mới điều chỉnh được tồn kho.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                    {lowStockOnly
                      ? 'Không có sản phẩm nào sắp hết hàng'
                      : keyword
                        ? `Không tìm thấy sản phẩm nào khớp "${keyword}"`
                        : 'Không có sản phẩm nào'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="border border-stone-300 px-3 py-1.5 disabled:opacity-40 hover:border-stone-900"
          >
            ← Trang trước
          </button>
          <span className="text-stone-500">
            Trang {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="border border-stone-300 px-3 py-1.5 disabled:opacity-40 hover:border-stone-900"
          >
            Trang sau →
          </button>
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
                  <option value="ACTIVE">Đang bán</option>
                  <option value="INACTIVE">Ngừng bán (ẩn khỏi web)</option>
                  {/* OUT_OF_STOCK không có luồng nghiệp vụ riêng (backend chỉ hiện sản phẩm ACTIVE, nên
                      chọn nó cũng ẩn sản phẩm y như INACTIVE) -- chỉ hiện lại cho dữ liệu cũ đang mang
                      trạng thái này để không âm thầm đổi trạng thái khi lưu. */}
                  {form.status === 'OUT_OF_STOCK' && <option value="OUT_OF_STOCK">Hết hàng (dữ liệu cũ)</option>}
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
            {form.images.map((row) => {
              const uploading = uploadingIds.has(row.id)
              return (
                <div key={row.id} className="flex items-center gap-2 mb-2">
                  {row.url && (
                    <img src={row.url} alt="" className="w-10 h-10 object-cover border border-stone-200 shrink-0" />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => handleImageFileChange(row.id, e.target.files?.[0] ?? null)}
                    disabled={uploading}
                    className="flex-1 border border-stone-300 px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm"
                  />
                  {uploading && <span className="text-xs text-stone-500">Đang tải...</span>}
                  <button onClick={() => removeImageRow(row.id)} className="text-red-600 text-xs px-2">
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
              <span className="text-xs text-stone-400">SKU bỏ trống sẽ tự sinh</span>
            </div>
            {form.variants.map((v, i) => {
              // Tồn kho của phân loại ĐÃ CÓ chỉ Admin mới sửa được; số nhập ở đây được backend đối chiếu
              // với số gốc để không ghi đè các giao dịch bán vừa phát sinh.
              const stockEditable = isAdmin
              return (
                <div key={v.variantId ?? `new-${i}`} className="flex gap-2 mb-2">
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
                    placeholder="SKU (tự sinh)"
                    value={v.sku ?? ''}
                    onChange={(e) => updateVariant(i, { sku: e.target.value })}
                    className="w-28 border border-stone-300 px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Tồn kho"
                    value={v.stockQuantity}
                    disabled={!stockEditable}
                    title={stockEditable ? undefined : 'Chỉ Quản trị viên mới sửa được tồn kho'}
                    onChange={(e) => updateVariant(i, { stockQuantity: Number(e.target.value) })}
                    className="w-24 border border-stone-300 px-2 py-2 text-sm disabled:bg-stone-100 disabled:text-stone-400"
                  />
                  <button onClick={() => removeVariantRow(i)} className="text-red-600 text-xs px-2">
                    Xoá
                  </button>
                </div>
              )
            })}
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
