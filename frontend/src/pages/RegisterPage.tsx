import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    phone: '',
  })
  // Lỗi theo từng field (khớp fieldErrors trả về từ GlobalExceptionHandler bên backend)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGeneralError(null)
    setFieldErrors({})
    setSubmitting(true)
    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (err: any) {
      const data = err.response?.data
      if (data?.fieldErrors) {
        setFieldErrors(data.fieldErrors)
      } else {
        setGeneralError(data?.message ?? 'Đăng ký thất bại, vui lòng thử lại')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white border border-stone-200 p-8">
        <h1 className="font-display text-2xl font-semibold text-stone-900 mb-1">Tạo tài khoản</h1>
        <p className="text-sm text-stone-500 mb-6">Tham gia NovaCart để mua sắm nhanh hơn</p>

        {generalError && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Tên đăng nhập"
            value={form.username}
            onChange={(v) => updateField('username', v)}
            error={fieldErrors.username}
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => updateField('email', v)}
            error={fieldErrors.email}
          />
          <Field
            label="Mật khẩu"
            type="password"
            value={form.password}
            onChange={(v) => updateField('password', v)}
            error={fieldErrors.password}
          />
          <Field
            label="Họ tên (không bắt buộc)"
            value={form.fullName}
            onChange={(v) => updateField('fullName', v)}
          />
          <Field
            label="Số điện thoại (không bắt buộc)"
            value={form.phone}
            onChange={(v) => updateField('phone', v)}
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-stone-50 text-sm font-semibold px-6 py-3"
          >
            {submitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </button>
        </form>

        <p className="mt-6 text-sm text-stone-500 text-center">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-stone-900 font-medium underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  )
}

/** Input field tái sử dụng, tự hiển thị lỗi validate của field đó nếu có. */
function Field({
  label,
  value,
  onChange,
  type = 'text',
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  error?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border px-3 py-2 text-sm outline-none focus:border-stone-900 ${
          error ? 'border-red-400' : 'border-stone-300'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}