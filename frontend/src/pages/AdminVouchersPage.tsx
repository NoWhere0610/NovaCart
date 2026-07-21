import { useEffect, useState } from 'react'
import {
  createAdminVoucherApi,
  deleteAdminVoucherApi,
  getAdminVouchersApi,
  type AdminVoucherDto,
  type AdminVoucherPayload,
} from '../api/adminApi'

const formatVnd = (n: number) => n.toLocaleString('vi-VN') + '₫'

const EMPTY_FORM: AdminVoucherPayload = {
  code: '',
  discountType: 'PERCENT',
  discountValue: 10,
  minOrderAmount: null,
  maxDiscountAmount: null,
  usageLimit: null,
  isActive: true,
}

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<AdminVoucherDto[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<AdminVoucherPayload>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadVouchers()
  }, [])

  async function loadVouchers() {
    setLoading(true)
    try {
      setVouchers(await getAdminVouchersApi())
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    setError(null)
    setSaving(true)
    try {
      await createAdminVoucherApi(form)
      setForm(EMPTY_FORM)
      setShowForm(false)
      await loadVouchers()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể tạo mã giảm giá')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(voucherId: number) {
    if (!confirm('Ngừng hoạt động mã giảm giá này?')) return
    await deleteAdminVoucherApi(voucherId)
    await loadVouchers()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Mã giảm giá</h1>
        <button
          onClick={() => {
            setForm(EMPTY_FORM)
            setError(null)
            setShowForm(true)
          }}
          className="bg-orange-700 hover:bg-orange-600 text-white text-sm px-4 py-2"
        >
          + Tạo mã mới
        </button>
      </div>

      {loading ? (
        <p className="text-stone-500">Đang tải...</p>
      ) : (
        <div className="bg-white border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-left text-stone-500">
              <tr>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Loại giảm</th>
                <th className="px-4 py-3">Giá trị</th>
                <th className="px-4 py-3">Đơn tối thiểu</th>
                <th className="px-4 py-3">Đã dùng / Giới hạn</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {vouchers.map((v) => (
                <tr key={v.voucherId}>
                  <td className="px-4 py-3 font-medium">{v.code}</td>
                  <td className="px-4 py-3">{v.discountType === 'PERCENT' ? 'Phần trăm' : 'Số tiền cố định'}</td>
                  <td className="px-4 py-3">
                    {v.discountType === 'PERCENT' ? `${v.discountValue}%` : formatVnd(v.discountValue)}
                  </td>
                  <td className="px-4 py-3">{v.minOrderAmount ? formatVnd(v.minOrderAmount) : '—'}</td>
                  <td className="px-4 py-3">
                    {v.usedCount} / {v.usageLimit ?? '∞'}
                  </td>
                  <td className="px-4 py-3">{v.isActive ? 'Đang chạy' : 'Đã ngừng'}</td>
                  <td className="px-4 py-3">
                    {v.isActive && (
                      <button
                        onClick={() => handleDelete(v.voucherId)}
                        className="text-xs border border-red-300 text-red-600 px-2 py-1 hover:bg-red-50"
                      >
                        Ngừng
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {vouchers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                    Chưa có mã giảm giá nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center overflow-y-auto py-10 z-50">
          <div className="bg-white w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Tạo mã giảm giá</h2>

            {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

            <div className="space-y-3 mb-6">
              <input
                placeholder="Mã (vd: GIAM10)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full border border-stone-300 px-3 py-2 text-sm"
              />
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as 'PERCENT' | 'FIXED' })}
                className="w-full border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="PERCENT">Giảm theo % </option>
                <option value="FIXED">Giảm số tiền cố định</option>
              </select>
              <input
                type="number"
                placeholder={form.discountType === 'PERCENT' ? 'Giá trị % (vd 10)' : 'Số tiền giảm (VNĐ)'}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                className="w-full border border-stone-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Đơn hàng tối thiểu (bỏ trống nếu không giới hạn)"
                value={form.minOrderAmount ?? ''}
                onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value ? Number(e.target.value) : null })}
                className="w-full border border-stone-300 px-3 py-2 text-sm"
              />
              {form.discountType === 'PERCENT' && (
                <input
                  type="number"
                  placeholder="Giảm tối đa (VNĐ, chặn giảm quá nhiều)"
                  value={form.maxDiscountAmount ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, maxDiscountAmount: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                />
              )}
              <input
                type="number"
                placeholder="Giới hạn số lượt dùng (bỏ trống nếu không giới hạn)"
                value={form.usageLimit ?? ''}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value ? Number(e.target.value) : null })}
                className="w-full border border-stone-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-orange-700 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold px-6 py-3"
              >
                {saving ? 'Đang lưu...' : 'Tạo mã'}
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