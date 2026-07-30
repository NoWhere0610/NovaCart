import { useEffect, useState } from 'react'
import {
  createAdminInventoryItemApi,
  deleteAdminInventoryItemApi,
  getAdminInventoryApi,
  getAdminProductsApi,
  updateAdminInventoryItemApi,
  type AdminInventoryCreatePayload,
  type AdminInventoryItemDto,
  type AdminInventoryUpdatePayload,
  type AdminProductDto,
} from '../api/adminApi'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

const EMPTY_CREATE_FORM: AdminInventoryCreatePayload = {
  productId: 0,
  size: '',
  color: '',
  sku: '',
  stockQuantity: 0,
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<AdminInventoryItemDto[]>([])
  const [products, setProducts] = useState<AdminProductDto[]>([])
  const [keyword, setKeyword] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [createForm, setCreateForm] = useState<AdminInventoryCreatePayload>(EMPTY_CREATE_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Danh sách sản phẩm để chọn khi thêm mới 1 dòng tồn kho — lấy tối đa,
    // không lọc theo status vì admin có thể muốn nhập tồn cho sản phẩm đang ẩn
    getAdminProductsApi('', 0, 500).then((res) => setProducts(res.content))
  }, [])

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, lowStockOnly])

  async function loadItems() {
    setLoading(true)
    try {
      const res = await getAdminInventoryApi(keyword, lowStockOnly, 0, 100)
      setItems(res.content)
    } finally {
      setLoading(false)
    }
  }

  function openCreateForm() {
    setEditingId(null)
    setCreateForm({ ...EMPTY_CREATE_FORM, productId: products[0]?.productId ?? 0 })
    setError(null)
    setShowForm(true)
  }

  function openEditForm(item: AdminInventoryItemDto) {
    setEditingId(item.variantId)
    setCreateForm({
      productId: item.productId,
      size: item.size,
      color: item.color,
      sku: item.sku ?? '',
      stockQuantity: item.stockQuantity,
    })
    setError(null)
    setShowForm(true)
  }

  async function handleSubmit() {
    setError(null)
    if (!createForm.size.trim() || !createForm.color.trim()) {
      setError('Vui lòng nhập size và màu')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const payload: AdminInventoryUpdatePayload = {
          size: createForm.size,
          color: createForm.color,
          sku: createForm.sku,
          stockQuantity: createForm.stockQuantity,
        }
        await updateAdminInventoryItemApi(editingId, payload)
      } else {
        if (!createForm.productId) {
          setError('Vui lòng chọn sản phẩm')
          setSaving(false)
          return
        }
        await createAdminInventoryItemApi(createForm)
      }
      setShowForm(false)
      await loadItems()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể lưu mặt hàng tồn kho')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: AdminInventoryItemDto) {
    if (!confirm(`Xoá mặt hàng tồn kho "${item.productName} - ${item.size}/${item.color}"?`)) return
    try {
      await deleteAdminInventoryItemApi(item.variantId)
      await loadItems()
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Không thể xoá mặt hàng này')
    }
  }

  async function quickAdjustStock(item: AdminInventoryItemDto, delta: number) {
    const newStock = Math.max(0, item.stockQuantity + delta)
    setItems((prev) => prev.map((it) => (it.variantId === item.variantId ? { ...it, stockQuantity: newStock } : it)))
    try {
      await updateAdminInventoryItemApi(item.variantId, {
        size: item.size,
        color: item.color,
        sku: item.sku ?? '',
        stockQuantity: newStock,
      })
    } catch {
      await loadItems()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-orange-700">
            <path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1V9.5Z" />
            <path d="M9 21v-4h6v4" />
          </svg>
          Kho tồn hàng
        </h1>
        <button onClick={openCreateForm} className="bg-orange-700 hover:bg-orange-600 text-white text-sm px-4 py-2">
          + Thêm mặt hàng tồn kho
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          placeholder="Tìm theo tên sản phẩm, SKU, size, màu..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-80 border border-stone-300 px-3 py-2 text-sm"
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
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Danh mục</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Màu</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Đơn giá</th>
                <th className="px-4 py-3">Tồn kho</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((item) => (
                <tr key={item.variantId} className={item.lowStock ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3 font-medium">{item.productName}</td>
                  <td className="px-4 py-3">{item.categoryName}</td>
                  <td className="px-4 py-3">{item.size}</td>
                  <td className="px-4 py-3">{item.color}</td>
                  <td className="px-4 py-3 text-stone-500">{item.sku || '—'}</td>
                  <td className="px-4 py-3">{formatVnd(item.price)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => quickAdjustStock(item, -1)}
                        className="w-6 h-6 border border-stone-300 text-stone-600 hover:border-stone-900"
                      >
                        −
                      </button>
                      <span className={`w-8 text-center font-semibold ${item.lowStock ? 'text-red-600' : ''}`}>
                        {item.stockQuantity}
                      </span>
                      <button
                        onClick={() => quickAdjustStock(item, 1)}
                        className="w-6 h-6 border border-stone-300 text-stone-600 hover:border-stone-900"
                      >
                        +
                      </button>
                      {item.lowStock && <span className="text-xs text-red-600">Sắp hết</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEditForm(item)} className="text-xs border border-stone-300 px-2 py-1 hover:border-stone-900">
                        Sửa
                      </button>
                      <button onClick={() => handleDelete(item)} className="text-xs border border-red-300 text-red-600 px-2 py-1 hover:bg-red-50">
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-stone-400">
                    Không có mặt hàng tồn kho nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center overflow-y-auto py-10 z-50">
          <div className="bg-white w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">
              {editingId ? 'Sửa mặt hàng tồn kho' : 'Thêm mặt hàng tồn kho mới'}
            </h2>

            {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-stone-600 mb-1">Sản phẩm</p>
                {editingId ? (
                  <p className="text-sm px-3 py-2 bg-stone-50 border border-stone-200">
                    {products.find((p) => p.productId === createForm.productId)?.productName ?? `#${createForm.productId}`}
                  </p>
                ) : (
                  <select
                    value={createForm.productId}
                    onChange={(e) => setCreateForm({ ...createForm, productId: Number(e.target.value) })}
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                  >
                    <option value={0}>-- Chọn sản phẩm --</option>
                    {products.map((p) => (
                      <option key={p.productId} value={p.productId}>
                        {p.productName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-stone-600 mb-1">Size</p>
                  <input
                    value={createForm.size}
                    onChange={(e) => setCreateForm({ ...createForm, size: e.target.value })}
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-600 mb-1">Màu</p>
                  <input
                    value={createForm.color}
                    onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-600 mb-1">SKU (tuỳ chọn)</p>
                  <input
                    value={createForm.sku}
                    onChange={(e) => setCreateForm({ ...createForm, sku: e.target.value })}
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-600 mb-1">Tồn kho</p>
                  <input
                    type="number"
                    min={0}
                    value={createForm.stockQuantity}
                    onChange={(e) => setCreateForm({ ...createForm, stockQuantity: Number(e.target.value) })}
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-orange-700 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold px-6 py-3"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 border border-stone-300 text-sm hover:bg-stone-50">
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
