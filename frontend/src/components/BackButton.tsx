import { useNavigate } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'

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
      className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-gold-dark mb-6 -ml-3 px-3 py-1.5 rounded-full hover:bg-stone-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
    >
      <IconArrowLeft size={16} stroke={2} />
      {label}
    </button>
  )
}