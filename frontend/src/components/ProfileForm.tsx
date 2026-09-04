import { useEffect, useState, type FormEvent } from 'react'
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react'
import { getMyProfileApi, updateMyProfileApi, type Profile } from '../api/userApi'
import { useAuth } from '../contexts/AuthContext'
import { LOI_SO_DIEN_THOAI, laSoDienThoaiVN } from '../utils/phone'

/**
 * Thông tin cá nhân của tài khoản: họ tên + số điện thoại.
 *
 * PHÂN BIỆT với sổ địa chỉ ở cùng màn hình: số điện thoại ở ĐÂY là số liên hệ của TÀI KHOẢN. Số điện
 * thoại NGƯỜI NHẬN của từng đơn hàng nằm trong sổ địa chỉ và có thể khác (mua hộ, gửi cho người nhà).
 * Trộn hai thứ làm một sẽ dẫn tới chuyện đổi số liên hệ mà vô tình đổi luôn số nhận hàng của mọi đơn.
 *
 * @param onProfileLoaded gọi lại mỗi khi hồ sơ được tải/lưu -- để trang cha biết còn thiếu số điện thoại không.
 */
export default function ProfileForm({
  onProfileLoaded,
}: {
  onProfileLoaded?: (profile: Profile) => void
}) {
  const { updateUser } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [loiTai, setLoiTai] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loi, setLoi] = useState<string | null>(null)
  const [daLuu, setDaLuu] = useState(false)
  const [dangLuu, setDangLuu] = useState(false)

  useEffect(() => {
    void tai()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function tai() {
    setDangTai(true)
    setLoiTai(null)
    try {
      const p = await getMyProfileApi()
      apDung(p)
    } catch {
      // Không để lỗi tải trông giống hệt "hồ sơ trống" -- người dùng sẽ tưởng dữ liệu của mình mất.
      setLoiTai('Không tải được thông tin tài khoản.')
    } finally {
      setDangTai(false)
    }
  }

  function apDung(p: Profile) {
    setProfile(p)
    setFullName(p.fullName ?? '')
    setPhone(p.phone ?? '')
    onProfileLoaded?.(p)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoi(null)
    setDaLuu(false)

    if (!fullName.trim()) {
      setLoi('Vui lòng nhập họ tên')
      return
    }
    if (!laSoDienThoaiVN(phone)) {
      setLoi(LOI_SO_DIEN_THOAI)
      return
    }

    setDangLuu(true)
    try {
      const p = await updateMyProfileApi({ fullName: fullName.trim(), phone: phone.trim() })
      apDung(p)
      // Đồng bộ sang phiên đăng nhập, nếu không Header vẫn hiện tên cũ.
      updateUser({ fullName: p.fullName })
      setDaLuu(true)
    } catch (err: any) {
      const fieldErrors = err.response?.data?.fieldErrors
      const dauTien = fieldErrors ? Object.values(fieldErrors)[0] : null
      setLoi((dauTien as string) ?? err.response?.data?.message ?? 'Không lưu được thông tin')
    } finally {
      setDangLuu(false)
    }
  }

  if (dangTai) return <p className="text-sm text-stone-500">Đang tải thông tin...</p>

  if (loiTai) {
    return (
      <div className="text-sm text-stone-600">
        <p className="mb-2">{loiTai}</p>
        <button onClick={tai} className="text-gold-dark font-medium underline">
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {profile?.thieuSoDienThoai && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
          <IconAlertTriangle size={18} stroke={1.8} className="shrink-0 mt-0.5" />
          <span>
            Tài khoản của bạn chưa có số điện thoại. Hãy bổ sung để chúng tôi liên hệ được khi có vấn đề
            về đơn hàng.
          </span>
        </div>
      )}

      {loi && <p className="text-sm text-red-600">{loi}</p>}
      {daLuu && (
        <p className="flex items-center gap-1.5 text-sm text-green-700">
          <IconCheck size={16} stroke={2} />
          Đã lưu thông tin tài khoản.
        </p>
      )}

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Tên đăng nhập</label>
        <input
          value={profile?.username ?? ''}
          disabled
          className="w-full border border-stone-200 bg-stone-100 text-stone-500 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Email</label>
        <input
          value={profile?.email ?? ''}
          disabled
          className="w-full border border-stone-200 bg-stone-100 text-stone-500 px-3 py-2 text-sm"
        />
        {/* Nói rõ VÌ SAO không sửa được, thay vì để người dùng bấm mãi vào ô xám mà không hiểu. */}
        <p className="text-[11px] text-stone-400 mt-1">
          Email là địa chỉ nhận link đặt lại mật khẩu nên không tự đổi được. Cần đổi, vui lòng liên hệ
          bộ phận hỗ trợ.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">
          Họ và tên <span className="text-red-500">*</span>
        </label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nguyễn Văn A"
          className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">
          Số điện thoại <span className="text-red-500">*</span>
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0912345678"
          className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
        />
        <p className="text-[11px] text-stone-400 mt-1">
          Số liên hệ của tài khoản. Số người nhận của từng đơn hàng lấy theo địa chỉ giao hàng bên dưới.
        </p>
      </div>

      <button
        type="submit"
        disabled={dangLuu}
        className="bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-stone-50 text-sm font-semibold px-6 py-2"
      >
        {dangLuu ? 'Đang lưu...' : 'Lưu thông tin'}
      </button>
    </form>
  )
}
