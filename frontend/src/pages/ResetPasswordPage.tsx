import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { IconCircleCheck } from '@tabler/icons-react'
import { resetPasswordApi } from '../api/authApi'

const DO_DAI_TOI_THIEU = 6

/** Đặt mật khẩu mới, mở từ link trong email: /reset-password?token=... */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [matKhau, setMatKhau] = useState('')
  const [nhapLai, setNhapLai] = useState('')
  const [loi, setLoi] = useState<string | null>(null)
  const [xong, setXong] = useState(false)
  const [dangGui, setDangGui] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoi(null)

    // Kiểm ở trình duyệt TRƯỚC khi gọi API: hai lỗi dưới đây người dùng tự sửa được ngay, không cần
    // vòng đi vòng về máy chủ. Backend vẫn kiểm lại độ dài (@Size trong ResetPasswordRequest).
    if (matKhau.length < DO_DAI_TOI_THIEU) {
      setLoi(`Mật khẩu phải có ít nhất ${DO_DAI_TOI_THIEU} ký tự`)
      return
    }
    if (matKhau !== nhapLai) {
      setLoi('Hai mật khẩu nhập không khớp')
      return
    }

    setDangGui(true)
    try {
      await resetPasswordApi(token, matKhau)
      setXong(true)
    } catch (err: any) {
      setLoi(err.response?.data?.message ?? 'Không đặt lại được mật khẩu, vui lòng thử lại.')
    } finally {
      setDangGui(false)
    }
  }

  // Vào thẳng đường dẫn mà không có mã (gõ tay, hoặc mail client cắt mất đuôi link).
  if (!token) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white border border-stone-200 p-8 text-center">
          <h1 className="font-display text-xl font-semibold text-stone-900 mb-2">Link không hợp lệ</h1>
          <p className="text-sm text-stone-500 mb-6">
            Đường dẫn thiếu mã đặt lại mật khẩu. Hãy mở lại đúng link trong email, hoặc yêu cầu link mới.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block bg-stone-900 border-gold-metallic gold-glow text-stone-50 text-sm font-semibold px-6 py-2.5"
          >
            Yêu cầu link mới
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-stone-200 p-8">
        {xong ? (
          <div className="text-center">
            <IconCircleCheck size={40} stroke={1.4} className="mx-auto text-green-600 mb-3" />
            <h1 className="font-display text-xl font-semibold text-stone-900 mb-2">Đã đổi mật khẩu</h1>
            <p className="text-sm text-stone-500 mb-6">
              Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full bg-stone-900 border-gold-metallic gold-glow text-stone-50 text-sm font-semibold px-6 py-2.5"
            >
              Đăng nhập
            </button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-stone-900 mb-1">Đặt mật khẩu mới</h1>
            <p className="text-sm text-stone-500 mb-6">Nhập mật khẩu mới cho tài khoản của bạn.</p>

            {loi && (
              <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                {loi}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={matKhau}
                  onChange={(e) => setMatKhau(e.target.value)}
                  className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
                />
                <p className="text-[11px] text-stone-400 mt-1">Ít nhất {DO_DAI_TOI_THIEU} ký tự.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Nhập lại mật khẩu mới</label>
                <input
                  type="password"
                  required
                  value={nhapLai}
                  onChange={(e) => setNhapLai(e.target.value)}
                  className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
                />
              </div>
              <button
                type="submit"
                disabled={dangGui}
                className="w-full bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-stone-50 text-sm font-semibold px-6 py-3"
              >
                {dangGui ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
