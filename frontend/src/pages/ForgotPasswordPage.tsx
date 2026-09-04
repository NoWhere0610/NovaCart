import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IconMailForward } from '@tabler/icons-react'
import { forgotPasswordApi } from '../api/authApi'

/**
 * Xin link đặt lại mật khẩu.
 *
 * LƯU Ý VỀ CÁCH HIỂN THỊ: khi backend trả về thành công, trang này hiện đúng câu backend đưa và KHÔNG
 * nói gì thêm kiểu "đã gửi tới email của bạn". Backend cố tình trả lời như nhau dù email có tài khoản
 * hay không -- khẳng định chắc chắn ở giao diện sẽ phá mất chính điều đó, biến trang công khai này
 * thành cách dò xem email nào đã đăng ký.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [thongBao, setThongBao] = useState<string | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [dangGui, setDangGui] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoi(null)
    setThongBao(null)
    setDangGui(true)
    try {
      setThongBao(await forgotPasswordApi(email.trim()))
    } catch (err: any) {
      setLoi(err.response?.data?.message ?? 'Không gửi được yêu cầu, vui lòng thử lại.')
    } finally {
      setDangGui(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-stone-200 p-8">
        <h1 className="font-display text-2xl font-semibold text-stone-900 mb-1">Quên mật khẩu</h1>
        <p className="text-sm text-stone-500 mb-6">
          Nhập email bạn đã dùng để đăng ký. Chúng tôi sẽ gửi link đặt lại mật khẩu.
        </p>

        {thongBao ? (
          <div className="text-center">
            <IconMailForward size={40} stroke={1.4} className="mx-auto text-gold-dark mb-3" />
            <p className="text-sm text-stone-700 mb-6">{thongBao}</p>
            <Link
              to="/login"
              className="inline-block bg-stone-900 border-gold-metallic gold-glow text-stone-50 text-sm font-semibold px-6 py-2.5"
            >
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <>
            {loi && (
              <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                {loi}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@example.com"
                  className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
                />
              </div>
              <button
                type="submit"
                disabled={dangGui}
                className="w-full bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-stone-50 text-sm font-semibold px-6 py-3"
              >
                {dangGui ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
              </button>
            </form>

            <p className="mt-6 text-sm text-stone-500 text-center">
              Nhớ ra mật khẩu rồi?{' '}
              <Link to="/login" className="text-stone-900 font-medium underline">
                Đăng nhập
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
