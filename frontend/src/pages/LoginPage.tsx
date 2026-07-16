import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ usernameOrEmail, password })
      // Quay lại đúng trang user định vào trước khi bị đá ra login (do ProtectedRoute),
      // nếu vào thẳng /login thì mặc định về trang chủ
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/'
      navigate(redirectTo, { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Đăng nhập thất bại, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-stone-200 p-8">
        <h1 className="text-2xl font-semibold text-stone-900 mb-1">Đăng nhập</h1>
        <p className="text-sm text-stone-500 mb-6">Chào mừng bạn quay lại NovaCart</p>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Tên đăng nhập hoặc email
            </label>
            <input
              type="text"
              required
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-orange-700 hover:bg-orange-600 disabled:opacity-60 transition-colors text-stone-50 text-sm font-semibold px-6 py-3"
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="mt-6 text-sm text-stone-500 text-center">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-stone-900 font-medium underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  )
}