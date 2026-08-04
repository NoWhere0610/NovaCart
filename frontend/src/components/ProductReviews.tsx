import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { createReviewApi, getProductReviewsApi, type ReviewDto } from '../api/productApi'

/** Sao đánh giá, dùng chung cho cả hiển thị (readOnly) và form chọn sao. */
function StarRating({
  value,
  onChange,
  readOnly = false,
}: {
  value: number
  onChange?: (v: number) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={`text-lg leading-none ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
            star <= value ? 'text-gold-dark' : 'text-stone-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function ProductReviews({ productId }: { productId: number }) {
  const { isAuthenticated } = useAuth()
  const [reviews, setReviews] = useState<ReviewDto[]>([])
  const [loading, setLoading] = useState(true)

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadReviews()
  }, [productId])

  async function loadReviews() {
    setLoading(true)
    try {
      const res = await getProductReviewsApi(productId, 0, 20)
      setReviews(res.content)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitReview() {
    // Không setFormMessage(null) ở đây -- để message cũ hiển thị nguyên tới khi có kết quả mới,
    // tránh message biến mất rồi hiện lại làm trang giật chiều cao.
    setSubmitting(true)
    try {
      const created = await createReviewApi(productId, rating, comment)
      setComment('')
      setFormMessage({ type: 'success', text: 'Cảm ơn bạn đã đánh giá!' })
      // Thêm thẳng đánh giá mới vào đầu danh sách, không gọi lại loadReviews() để tránh giật layout.
      setReviews((prev) => [created, ...prev])
    } catch (err: any) {
      // Lỗi phổ biến: chưa mua hàng / đơn chưa COMPLETED / đã đánh giá rồi (xem ReviewService.create() backend)
      setFormMessage({ type: 'error', text: err.response?.data?.message ?? 'Không thể gửi đánh giá' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto mt-12 px-0">
      <h2 className="font-display text-lg font-semibold text-stone-900 mb-4">Đánh giá sản phẩm</h2>

      {/* Chỉ hiện form nếu đã đăng nhập; điều kiện "đã mua & nhận hàng" backend tự kiểm tra */}
      {isAuthenticated ? (
        <div className="bg-white border border-stone-200 p-4 mb-6">
          <p className="text-sm font-medium text-stone-700 mb-2">Viết đánh giá của bạn</p>
          <div className="mb-3">
            <StarRating value={rating} onChange={setRating} />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Chia sẻ cảm nhận của bạn về sản phẩm này..."
            rows={3}
            className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 mb-3"
          />
          {formMessage && (
            <p className={`text-sm mb-3 ${formMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
              {formMessage.text}
            </p>
          )}
          <button
            onClick={handleSubmitReview}
            disabled={submitting}
            className="bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-white text-sm font-semibold px-5 py-2"
          >
            {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
          </button>
          <p className="text-xs text-stone-400 mt-2">
            * Chỉ áp dụng với sản phẩm bạn đã mua và nhận hàng thành công.
          </p>
        </div>
      ) : (
        <p className="text-sm text-stone-500 mb-6">Đăng nhập để viết đánh giá cho sản phẩm này.</p>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Đang tải đánh giá...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-stone-400">Chưa có đánh giá nào cho sản phẩm này.</p>
      ) : (
        <div className="divide-y divide-stone-100 bg-white border border-stone-200">
          {reviews.map((r) => (
            <div key={r.reviewId} className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-stone-900">{r.username}</span>
                <span className="text-xs text-stone-400">
                  {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <StarRating value={r.rating} readOnly />
              {r.comment && <p className="text-sm text-stone-600 mt-2">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}