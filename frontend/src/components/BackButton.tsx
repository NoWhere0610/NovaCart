import { useNavigate } from 'react-router-dom'

/**
 * Nút quay lại — dùng useNavigate(-1) để quay ĐÚNG trang vừa xem trước đó
 * (giống nút Back trình duyệt). Nếu không có lịch sử điều hướng trước đó
 * (vd dán thẳng URL), fallback về trang chủ "/".
 */
export default function BackButton({ label = 'Quay lại' }: { label?: string }) {
  const navigate = useNavigate()

  function handleBack() {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 mb-6 transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  )
}