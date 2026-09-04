import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { IconPackage, IconChevronRight } from '@tabler/icons-react'
import { useAuth } from '../contexts/AuthContext'
import {
  createAddressApi,
  updateAddressApi,
  deleteAddressApi,
  getMyAddressesApi,
  type AddressDto,
} from '../api/addressApi'
import { reverseGeocodeApi } from '../api/mapsApi'
import {
  loadProvinces,
  loadAllWards,
  findProvinceByName,
  findWardByName,
  type ProvinceEntry,
  type WardEntry,
} from '../utils/vietnamAdmin'
import BackButton from '../components/BackButton'
import AddressMapPicker from '../components/AddressMapPicker'
import SearchableSelect from '../components/SearchableSelect'
import ProfileForm from '../components/ProfileForm'
import ChangePasswordForm from '../components/ChangePasswordForm'

const EMPTY_FORM = {
  receiverName: '',
  phone: '',
  province: '',
  ward: '',
  detailAddress: '',
  latitude: null as number | null,
  longitude: null as number | null,
  isDefault: false,
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [addresses, setAddresses] = useState<AddressDto[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  // 1 dòng chữ đỏ ngay trong form -- KHÔNG dùng modal cho lỗi validate/lưu, cảm giác nặng nề không cần
  // thiết cho lỗi kiểu "thiếu trường/sai định dạng", chỉ cần rõ ràng tại chỗ.
  const [formError, setFormError] = useState<string | null>(null)
  // null = đang thêm mới; có giá trị = đang sửa đúng địa chỉ này (đổi hẳn form sang chế độ sửa)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Danh sách Tỉnh/Thành + Phường/Xã theo cấu trúc hành chính MỚI (bỏ cấp huyện từ 01/07/2025) --
  // xem utils/vietnamAdmin.ts. Tải TOÀN BỘ 1 lần (không lọc theo tỉnh) vì ô Phường/Xã cho tìm trên
  // cả nước -- chọn phường trước sẽ tự suy ra tỉnh, không bắt buộc phải chọn tỉnh trước như cũ.
  const [provinces, setProvinces] = useState<ProvinceEntry[]>([])
  const [wards, setWards] = useState<WardEntry[]>([])
  const [provinceCode, setProvinceCode] = useState('')
  const [wardCode, setWardCode] = useState('')
  // VietMap Autocomplete/Reverse trả tên phường theo cấu trúc CŨ -- không phải lúc nào cũng khớp được
  // với danh sách phường MỚI (đã sáp nhập), báo cho khách biết để tự chọn tay khi không khớp được.
  const [wardNeedsManualPick, setWardNeedsManualPick] = useState(false)

    // Được bảo vệ bởi <ProtectedRoute/> nên chắc chắn có user khi tới đây,
  // nhưng vẫn load địa chỉ ngay khi mount trang
  useEffect(() => {
    loadAddresses()
    loadProvinces().then(setProvinces)
    loadAllWards().then(setWards)
  }, [])

  async function loadAddresses() {
    setLoadingAddresses(true)
    setAddressError(null)
    try {
      const data = await getMyAddressesApi()
      setAddresses(data)
    } catch {
      // Không để lỗi tải sổ địa chỉ hiển thị giống hệt "chưa có địa chỉ nào" (addresses.length === 0)
      setAddressError('Không thể tải sổ địa chỉ. Vui lòng thử lại.')
    } finally {
      setLoadingAddresses(false)
    }
  }

  // Thử khớp tên tỉnh/phường CŨ (VietMap trả về) sang tỉnh/phường MỚI -- dùng chung cho cả luồng bấm
  // bản đồ lẫn luồng sửa địa chỉ đã lưu trước đây.
  async function applyProvinceAndWardGuess(rawProvinceName: string | null, rawWardName: string | null) {
    const provinceList = provinces.length > 0 ? provinces : await loadProvinces()
    const wardList = wards.length > 0 ? wards : await loadAllWards()

    const matchedProvince = findProvinceByName(provinceList, rawProvinceName)
    if (!matchedProvince) {
      setProvinceCode('')
      setWardCode('')
      setWardNeedsManualPick(false)
      return
    }
    setProvinceCode(matchedProvince.code)
    setForm((p) => ({ ...p, province: matchedProvince.name_with_type }))

    // Chỉ so khớp trong đúng các phường THUỘC tỉnh đã khớp -- tránh trùng tên phường ở tỉnh khác.
    const matchedWard = findWardByName(
      wardList.filter((w) => w.parent_code === matchedProvince.code),
      rawWardName,
    )
    if (matchedWard) {
      setWardCode(matchedWard.code)
      setForm((p) => ({ ...p, ward: matchedWard.name_with_type }))
      setWardNeedsManualPick(false)
    } else {
      setWardCode('')
      setForm((p) => ({ ...p, ward: '' }))
      // Có tên phường cũ nhưng không khớp được -> chắc chắn đã đổi ranh giới, cần chọn tay.
      // Không có tên phường cũ (vd VietMap không trả) thì thôi, không cần cảnh báo.
      setWardNeedsManualPick(Boolean(rawWardName))
    }
  }

  // Bấm/kéo ghim trên bản đồ -- lấy toạ độ NGAY (chính xác theo đúng chỗ khách chọn), rồi đổi ngược
  // sang địa chỉ để gợi ý Tỉnh/Phường + tự điền Địa chỉ chi tiết (khách vẫn sửa/chọn tay lại được).
  async function handleMapPick(lat: number, lng: number) {
    setForm((p) => ({ ...p, latitude: lat, longitude: lng }))
    try {
      const detail = await reverseGeocodeApi(lat, lng)
      setForm((p) => ({
        ...p,
        detailAddress: [detail.hsNum, detail.street].filter(Boolean).join(' ') || detail.display || p.detailAddress,
      }))
      await applyProvinceAndWardGuess(detail.city, detail.ward)
    } catch {
      // Không đổi ngược được địa chỉ (vd vị trí quá hẻo lánh, VietMap không có dữ liệu) -- vẫn giữ
      // đúng toạ độ vừa chọn, khách tự chọn Tỉnh/Phường tay.
    }
  }

  async function startEdit(addr: AddressDto) {
    setEditingId(addr.addressId)
    setForm({
      receiverName: addr.receiverName,
      phone: addr.phone,
      province: addr.province ?? '',
      ward: addr.ward ?? '',
      detailAddress: addr.detailAddress ?? '',
      latitude: addr.latitude,
      longitude: addr.longitude,
      isDefault: addr.isDefault,
    })
    await applyProvinceAndWardGuess(addr.province, addr.ward)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setProvinceCode('')
    setWardCode('')
    setWardNeedsManualPick(false)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.receiverName.trim()) {
      setFormError('Vui lòng nhập tên người nhận')
      return
    }
    if (!form.phone.trim()) {
      setFormError('Vui lòng nhập số điện thoại')
      return
    }
    if (!form.province) {
      setFormError('Vui lòng chọn Tỉnh/Thành phố')
      return
    }
    if (!form.ward) {
      setFormError('Vui lòng chọn Phường/Xã')
      return
    }
    if (!form.detailAddress.trim()) {
      setFormError('Vui lòng nhập địa chỉ chi tiết (số nhà, tên đường)')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        receiverName: form.receiverName,
        phone: form.phone,
        province: form.province || null,
        // Cấp huyện đã bỏ từ 01/07/2025 -- không thu thập nữa, luôn gửi null.
        district: null,
        ward: form.ward || null,
        detailAddress: form.detailAddress,
        latitude: form.latitude,
        longitude: form.longitude,
        isDefault: editingId ? form.isDefault : addresses.length === 0, // địa chỉ đầu tiên tự làm mặc định
      }
      if (editingId) {
        await updateAddressApi(editingId, payload)
      } else {
        await createAddressApi(payload)
      }
      cancelEdit()
      await loadAddresses()
    } catch (err: any) {
      // fieldErrors (vd "Số điện thoại không đúng định dạng") cụ thể hơn hẳn message chung "Dữ liệu không hợp lệ".
      const fieldErrors = err.response?.data?.fieldErrors
      const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0] : null
      setFormError((firstFieldError as string) ?? err.response?.data?.message ?? (editingId ? 'Không thể lưu địa chỉ' : 'Không thể thêm địa chỉ'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(addressId: number) {
    setFormError(null)
    try {
      await deleteAddressApi(addressId)
      if (editingId === addressId) cancelEdit()
      await loadAddresses()
    } catch (err: any) {
      setFormError(err.response?.data?.message ?? 'Không thể xoá địa chỉ')
    }
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
            <h1 className="font-display text-2xl font-semibold text-stone-900">Tài khoản của tôi</h1>
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
            <IconPackage size={18} stroke={1.7} />
            Đơn hàng của tôi
          </span>
          <IconChevronRight size={16} className="text-stone-400" />
        </Link>

        <h2 className="text-lg font-medium text-stone-900 mb-3">Thông tin cá nhân</h2>
        <ProfileForm />

        <div className="border-t border-stone-200 my-6 pt-6">
          <ChangePasswordForm />
        </div>

        {/* Số điện thoại ở phần trên là số liên hệ của TÀI KHOẢN; số dưới đây là số NGƯỜI NHẬN của từng
            địa chỉ giao hàng, cố ý tách riêng vì mua hộ/gửi người nhà thì hai số khác nhau. */}
        <h2 className="text-lg font-medium text-stone-900 mb-3 border-t border-stone-200 pt-6">Sổ địa chỉ</h2>

        {loadingAddresses ? (
          <p className="text-sm text-stone-500">Đang tải...</p>
        ) : addressError ? (
          <div className="mb-6 text-sm text-stone-600">
            <p className="mb-2">{addressError}</p>
            <button onClick={loadAddresses} className="text-gold-dark font-medium underline">
              Thử lại
            </button>
          </div>
        ) : addresses.length === 0 ? (
          <p className="text-sm text-stone-500 mb-4">Bạn chưa có địa chỉ nào.</p>
        ) : (
          <ul className="space-y-2 mb-6">
            {addresses.map((addr) => (
              <li
                key={addr.addressId}
                className={`flex items-center justify-between border px-4 py-3 text-sm ${
                  editingId === addr.addressId ? 'border-stone-900' : 'border-stone-200'
                }`}
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {addr.receiverName} — {addr.phone}
                    {addr.isDefault && (
                      <span className="ml-2 text-[11px] bg-stone-900 border-gold-metallic text-white px-2 py-0.5">
                        Mặc định
                      </span>
                    )}
                  </p>
                  <p className="text-stone-500">
                    {[addr.detailAddress, addr.ward, addr.province].filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => startEdit(addr)}
                    className="text-stone-600 hover:underline"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(addr.addressId)}
                    className="text-red-600 hover:underline"
                  >
                    Xoá
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 border-t border-stone-200 pt-6">
          <p className="text-sm font-medium text-stone-700">
            {editingId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}
          </p>
          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}
          <input
            placeholder="Tên người nhận"
            value={form.receiverName}
            onChange={(e) => setForm((p) => ({ ...p, receiverName: e.target.value }))}
            className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          />
          <input
            placeholder="Số điện thoại"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          />

          <AddressMapPicker lat={form.latitude} lng={form.longitude} onPick={handleMapPick} />
          {form.latitude != null && (
            <p className="text-xs text-green-700">Đã có toạ độ chính xác -- phí ship sẽ tính theo khoảng cách thật.</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <SearchableSelect
              placeholder="-- Gõ tìm Tỉnh/Thành phố --"
              value={provinceCode}
              options={provinces.map((p) => ({ value: p.code, label: p.name_with_type }))}
              onChange={(code) => {
                const p = provinces.find((pr) => pr.code === code) ?? null
                setProvinceCode(code)
                setForm((f) => ({ ...f, province: p?.name_with_type ?? '' }))
                // Đổi tỉnh khác với tỉnh của phường đang chọn -> phường cũ không còn hợp lệ, bỏ chọn.
                const currentWard = wards.find((w) => w.code === wardCode)
                if (currentWard && currentWard.parent_code !== code) {
                  setWardCode('')
                  setForm((f) => ({ ...f, ward: '' }))
                }
              }}
            />
            <SearchableSelect
              placeholder="-- Gõ tìm Phường/Xã --"
              value={wardCode}
              minChars={2}
              options={wards.map((w) => ({ value: w.code, label: w.path_with_type, searchText: w.name_with_type }))}
              onChange={(code) => {
                const w = wards.find((wd) => wd.code === code) ?? null
                setWardCode(code)
                setWardNeedsManualPick(false)
                if (w) {
                  // Chọn phường trước (kể cả chưa chọn tỉnh) -> tự suy ra tỉnh.
                  const p = provinces.find((pr) => pr.code === w.parent_code) ?? null
                  setProvinceCode(p?.code ?? '')
                  setForm((f) => ({ ...f, ward: w.name_with_type, province: p?.name_with_type ?? f.province }))
                } else {
                  setForm((f) => ({ ...f, ward: '' }))
                }
              }}
            />
          </div>
          {wardNeedsManualPick && (
            <p className="text-xs text-amber-600">
              Không tự xác định được phường/xã theo địa giới mới (đã sáp nhập từ 01/07/2025) -- vui lòng tự chọn ở ô trên.
            </p>
          )}
          <input
            placeholder="Địa chỉ chi tiết (số nhà, tên đường)"
            value={form.detailAddress}
            onChange={(e) => setForm((p) => ({ ...p, detailAddress: e.target.value }))}
            className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          />

          {editingId && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
              />
              Đặt làm địa chỉ mặc định
            </label>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-stone-50 text-sm font-semibold px-6 py-2"
            >
              {submitting ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Thêm địa chỉ'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-sm text-stone-500 hover:text-stone-900 underline"
              >
                Huỷ
              </button>
            )}
          </div>
        </form>
      </div>
      </div>
    </div>
  )
}
