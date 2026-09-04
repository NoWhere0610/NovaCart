import { useState, type FormEvent } from 'react'
import { IconCheck, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { changePasswordApi } from '../api/userApi'

const DO_DAI_TOI_THIEU = 6

/**
 * Đổi mật khẩu khi đang đăng nhập.
 *
 * Thu gọn mặc định: đây là việc hiếm khi làm, mở sẵn sẽ chiếm chỗ của những phần dùng thường xuyên hơn
 * (thông tin cá nhân, sổ địa chỉ) trên cùng một màn hình.
 *
 * Backend bắt nhập lại mật khẩu hiện tại dù đã đăng nhập -- xem ChangePasswordRequest.java.
 */
export default function ChangePasswordForm() {
  const [moRong, setMoRong] = useState(false)
  const [hienTai, setHienTai] = useState('')
  const [moi, setMoi] = useState('')
  const [nhapLai, setNhapLai] = useState('')
  const [loi, setLoi] = useState<string | null>(null)
  const [thanhCong, setThanhCong] = useState<string | null>(null)
  const [dangLuu, setDangLuu] = useState(false)

  function dongVaXoa() {
    setHienTai('')
    setMoi('')
    setNhapLai('')
    setLoi(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoi(null)
    setThanhCong(null)

    if (moi.length < DO_DAI_TOI_THIEU) {
      setLoi(`Mật khẩu mới phải có ít nhất ${DO_DAI_TOI_THIEU} ký tự`)
      return
    }
    if (moi !== nhapLai) {
      setLoi('Hai mật khẩu mới nhập không khớp')
      return
    }

    setDangLuu(true)
    try {
      setThanhCong(await changePasswordApi(hienTai, moi))
      // Xoá sạch 3 ô ngay khi xong -- không để mật khẩu nằm lại trong form sau khi đã dùng xong.
      dongVaXoa()
      setMoRong(false)
    } catch (err: any) {
      const fieldErrors = err.response?.data?.fieldErrors
      const dauTien = fieldErrors ? Object.values(fieldErrors)[0] : null
      setLoi((dauTien as string) ?? err.response?.data?.message ?? 'Không đổi được mật khẩu')
    } finally {
      setDangLuu(false)
    }
  }

  const oClass =
    'w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900'

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setMoRong((v) => !v)
          setThanhCong(null)
          if (moRong) dongVaXoa()
        }}
        aria-expanded={moRong}
        className="flex items-center gap-1.5 text-sm font-medium text-stone-700 hover:text-gold-dark transition-colors"
      >
        {moRong ? <IconChevronDown size={16} stroke={1.8} /> : <IconChevronRight size={16} stroke={1.8} />}
        Đổi mật khẩu
      </button>

      {thanhCong && !moRong && (
        <p className="flex items-center gap-1.5 text-sm text-green-700 mt-2">
          <IconCheck size={16} stroke={2} />
          {thanhCong}
        </p>
      )}

      {moRong && (
        <form onSubmit={handleSubmit} className="space-y-3 mt-3">
          {loi && <p className="text-sm text-red-600">{loi}</p>}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Mật khẩu hiện tại</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={hienTai}
              onChange={(e) => setHienTai(e.target.value)}
              className={oClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Mật khẩu mới</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={moi}
              onChange={(e) => setMoi(e.target.value)}
              className={oClass}
            />
            <p className="text-[11px] text-stone-400 mt-1">Ít nhất {DO_DAI_TOI_THIEU} ký tự.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nhập lại mật khẩu mới</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={nhapLai}
              onChange={(e) => setNhapLai(e.target.value)}
              className={oClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={dangLuu}
              className="bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-stone-50 text-sm font-semibold px-6 py-2"
            >
              {dangLuu ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
            <button
              type="button"
              onClick={() => {
                dongVaXoa()
                setMoRong(false)
              }}
              className="text-sm text-stone-500 hover:text-stone-900 underline"
            >
              Huỷ
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
