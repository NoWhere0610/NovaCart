import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  createAddressApi,
  deleteAddressApi,
  getMyAddressesApi,
  type AddressDto,
} from '../api/addressApi'
import BackButton from '../components/BackButton'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [addresses, setAddresses] = useState<AddressDto[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [form, setForm] = useState({ receiverName: '', phone: '', detailAddress: '' })
  const [submitting, setSubmitting] = useState(false)

    // Được bảo vệ bởi <ProtectedRoute/> nên chắc chắn có user khi tới đây,
  // nhưng vẫn load địa chỉ ngay khi mount trang
  useEffect(() => {
    loadAddresses()
  }, [])

  async function loadAddresses() {
    setLoadingAddresses(true)
    try {
      const data = await getMyAddressesApi()
      setAddresses(data)
    } finally {
      setLoadingAddresses(false)
    }
  }

  async function handleAddAddress(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createAddressApi({
        receiverName: form.receiverName,
        phone: form.phone,
        detailAddress: form.detailAddress,
        province: null,
        district: null,
        ward: null,
        isDefault: addresses.length === 0,// địa chỉ đầu tiên tự làm mặc định
      })
      setForm({ receiverName: '', phone: '', detailAddress: '' })
      await loadAddresses()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(addressId: number) {
    await deleteAddressApi(addressId)
    await loadAddresses()
  }

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <BackButton />
        <div className="bg-white border border-stone-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Tài khoản của tôi</h1>
            <p className="text-sm text-stone-500 mt-1">
              {user?.fullName || user?.username} — {user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-stone-600 hover:text-stone-900 underline"
          >
            Đăng xuất
          </button>
        </div>

        <Link
          to="/orders"
          className="flex items-center justify-between border border-stone-200 hover:border-stone-900 transition-colors px-4 py-3 mb-6 text-sm"
        >
          <span className="flex items-center gap-2 text-stone-900 font-medium">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h6" />
            </svg>
            Đơn hàng của tôi
          </span>
          <span className="text-stone-400">→</span>
        </Link>

        <h2 className="text-lg font-medium text-stone-900 mb-3">Sổ địa chỉ</h2>

        {loadingAddresses ? (
          <p className="text-sm text-stone-500">Đang tải...</p>
        ) : addresses.length === 0 ? (
          <p className="text-sm text-stone-500 mb-4">Bạn chưa có địa chỉ nào.</p>
        ) : (
          <ul className="space-y-2 mb-6">
            {addresses.map((addr) => (
              <li
                key={addr.addressId}
                className="flex items-center justify-between border border-stone-200 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {addr.receiverName} — {addr.phone}
                    {addr.isDefault && (
                      <span className="ml-2 text-[11px] bg-orange-700 text-white px-2 py-0.5">
                        Mặc định
                      </span>
                    )}
                  </p>
                  <p className="text-stone-500">{addr.detailAddress}</p>
                </div>
                <button
                  onClick={() => handleDelete(addr.addressId)}
                  className="text-red-600 hover:underline"
                >
                  Xoá
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddAddress} className="space-y-3 border-t border-stone-200 pt-6">
          <p className="text-sm font-medium text-stone-700">Thêm địa chỉ mới</p>
          <input
            required
            placeholder="Tên người nhận"
            value={form.receiverName}
            onChange={(e) => setForm((p) => ({ ...p, receiverName: e.target.value }))}
            className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          />
          <input
            required
            placeholder="Số điện thoại"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          />
          <input
            placeholder="Địa chỉ chi tiết"
            value={form.detailAddress}
            onChange={(e) => setForm((p) => ({ ...p, detailAddress: e.target.value }))}
            className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-orange-700 hover:bg-orange-600 disabled:opacity-60 transition-colors text-stone-50 text-sm font-semibold px-6 py-2"
          >
            {submitting ? 'Đang lưu...' : 'Thêm địa chỉ'}
          </button>
        </form>
      </div>
      </div>
    </div>
  )
}