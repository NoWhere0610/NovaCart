import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconPhonePlus, IconX } from '@tabler/icons-react'
import { getMyProfileApi, updateMyProfileApi } from '../api/userApi'
import { useAuth } from '../contexts/AuthContext'
import { LOI_SO_DIEN_THOAI, laSoDienThoaiVN } from '../utils/phone'

/**
 * Nhắc bổ sung số điện thoại cho TÀI KHOẢN, hiện ở màn đặt hàng.
 *
 * VÌ SAO CHỈ NHẮC CHỨ KHÔNG CHẶN: đơn hàng không bao giờ thiếu số người nhận -- OrderService lấy số đó
 * từ địa chỉ giao hàng đã chọn, mà mỗi địa chỉ bắt buộc có số hợp lệ và checkout bắt buộc chọn địa chỉ.
 * Thứ đang trống là số liên hệ của tài khoản, dùng khi cửa hàng cần gọi cho CHỦ tài khoản (đổi trả,
 * xác minh thanh toán) chứ không phải để giao hàng. Chặn không cho đặt hàng vì thiếu nó là dựng một
 * rào cản không có lý do nghiệp vụ, ngay tại bước dễ mất khách nhất.
 *
 * Tự ẩn khi tài khoản đã có số, hoặc khi người dùng bấm bỏ qua.
 *
 * @param soGoiY số điện thoại của địa chỉ giao hàng đang chọn -- điền sẵn để bấm một nút là xong.
 * @param tenGoiY tên người nhận của địa chỉ đang chọn, dùng khi tài khoản cũng chưa có họ tên.
 */
export default function AccountPhonePrompt({
  soGoiY,
  tenGoiY,
}: {
  soGoiY?: string | null
  tenGoiY?: string | null
}) {
  const { updateUser } = useAuth()

  const [hien, setHien] = useState(false)
  const [thieuHoTen, setThieuHoTen] = useState(false)
  const [phone, setPhone] = useState('')
  const [hoTen, setHoTen] = useState('')
  const [loi, setLoi] = useState<string | null>(null)
  const [dangLuu, setDangLuu] = useState(false)

  useEffect(() => {
    let huy = false
    getMyProfileApi()
      .then((p) => {
        if (huy) return
        setHien(p.thieuSoDienThoai)
        setThieuHoTen(!p.fullName || p.fullName.trim() === '')
        setHoTen(p.fullName ?? '')
      })
      .catch(() => {
        // Không tải được hồ sơ thì im lặng không nhắc. Đây là tính năng phụ trợ -- không được phép làm
        // ồn hay cản trở màn đặt hàng chỉ vì bản thân nó lỗi.
      })
    return () => {
      huy = true
    }
  }, [])

  // Điền sẵn theo địa chỉ đang chọn, nhưng KHÔNG đè lên thứ người dùng đã tự gõ.
  useEffect(() => {
    if (soGoiY) setPhone((truoc) => truoc || soGoiY)
  }, [soGoiY])
  useEffect(() => {
    if (tenGoiY) setHoTen((truoc) => truoc || tenGoiY)
  }, [tenGoiY])

  if (!hien) return null

  async function luu() {
    setLoi(null)
    if (!laSoDienThoaiVN(phone)) {
      setLoi(LOI_SO_DIEN_THOAI)
      return
    }
    if (!hoTen.trim()) {
      setLoi('Vui lòng nhập họ tên')
      return
    }
    setDangLuu(true)
    try {
      const p = await updateMyProfileApi({ fullName: hoTen.trim(), phone: phone.trim() })
      updateUser({ fullName: p.fullName })
      setHien(false)
    } catch (err: any) {
      const fieldErrors = err.response?.data?.fieldErrors
      const dauTien = fieldErrors ? Object.values(fieldErrors)[0] : null
      setLoi((dauTien as string) ?? err.response?.data?.message ?? 'Không lưu được số điện thoại')
    } finally {
      setDangLuu(false)
    }
  }

  return (
    <div className="mb-6 border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <IconPhonePlus size={18} stroke={1.8} className="shrink-0 mt-0.5 text-amber-700" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            Tài khoản của bạn chưa có số điện thoại
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            Đơn hàng vẫn đặt được bình thường -- số người nhận lấy theo địa chỉ giao hàng bạn chọn. Bổ
            sung số liên hệ của tài khoản giúp chúng tôi gọi được cho bạn khi cần xác minh đơn hoặc xử
            lý đổi trả.
          </p>

          {loi && <p className="text-xs text-red-700 mt-2">{loi}</p>}

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {thieuHoTen && (
              <input
                value={hoTen}
                onChange={(e) => setHoTen(e.target.value)}
                placeholder="Họ và tên"
                className="w-44 border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-600"
              />
            )}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              inputMode="tel"
              className="w-40 border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-600"
            />
            <button
              type="button"
              onClick={luu}
              disabled={dangLuu}
              className="bg-stone-900 border-gold-metallic text-stone-50 text-sm font-semibold px-4 py-1.5 disabled:opacity-60"
            >
              {dangLuu ? 'Đang lưu...' : 'Lưu vào tài khoản'}
            </button>
            <Link to="/account" className="text-xs text-amber-800 underline">
              Sửa ở trang Tài khoản
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHien(false)}
          aria-label="Bỏ qua"
          className="shrink-0 text-amber-700 hover:text-amber-900"
        >
          <IconX size={16} stroke={1.8} />
        </button>
      </div>
    </div>
  )
}
