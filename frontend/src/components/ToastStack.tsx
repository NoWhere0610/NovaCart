import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react'

export type LoaiToast = 'thanhCong' | 'loi' | 'thongTin'

/**
 * Hiệu ứng biến mất chạy bao lâu (ms).
 *
 * Khai báo ĐÚNG MỘT LẦN ở đây rồi gán thẳng vào style của phần tử, chứ không viết cứng trong CSS. Lý
 * do: ToastContext phải giữ phần tử lại đúng bằng khoảng này trước khi gỡ khỏi cây React. Nếu để hai
 * bản (một trong CSS, một trong TypeScript) thì sửa một bên quên bên kia là hiệu ứng cụt ngang, hoặc
 * toast nằm trơ trong suốt một lúc -- kiểu lỗi "trông hơi kỳ" rất khó chỉ ra sai ở đâu.
 */
export const THOI_GIAN_THOAT = 200

export interface Toast {
  id: number
  noiDung: string
  loai: LoaiToast
  /**
   * Đang chạy hiệu ứng biến mất, sắp bị gỡ khỏi cây React.
   *
   * Cần một trạng thái trung gian như thế này vì gỡ thẳng phần tử khỏi React là nó biến mất tức thì,
   * không còn gì trên trang để mà chạy hiệu ứng. Phải giữ nó lại thêm đúng bằng thời lượng hiệu ứng.
   */
  dangThoat?: boolean
}

/**
 * Chồng thông báo ngắn. Render một lần duy nhất, do ToastProvider đặt -- đừng dùng trực tiếp.
 *
 * VỊ TRÍ: giữa-trên. Không đặt góc dưới-phải vì chỗ đó đã có cụm nút mạng xã hội + nút chat
 * (FloatingSocialButtons, ChatWidget) -- toast sẽ đè lên nhau. top-24 để lọt xuống dưới header dính
 * (cao h-20) thay vì che mất nó.
 */
export default function ToastStack({
  toasts,
  onDong,
}: {
  toasts: Toast[]
  onDong: (id: number) => void
}) {
  return (
    // LUÔN render lớp bọc này, kể cả khi chưa có toast nào -- KHÔNG được "return null khi rỗng".
    // Trình đọc màn hình chỉ đọc thay đổi bên trong một vùng aria-live ĐÃ CÓ SẴN trong trang từ trước;
    // nếu vùng đó vừa xuất hiện cùng lúc với nội dung thì toast đầu tiên thường bị bỏ qua không đọc.
    //
    // pointer-events-none ở lớp bọc để vùng trống hai bên không chặn thao tác với trang bên dưới;
    // từng thẻ toast bật lại pointer-events để vẫn bấm được nút đóng.
    <div
      className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 px-4 w-full max-w-md pointer-events-none"
      // polite: trình đọc màn hình đọc khi rảnh, không cắt ngang thứ người dùng đang nghe.
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          // Đổi HẲN lớp chứ không chồng thêm: hai animation cùng chạy trên một phần tử sẽ tranh nhau
          // opacity/transform, kết quả phụ thuộc thứ tự khai báo trong CSS -- rất khó lần ra khi sai.
          className={`${t.dangThoat ? 'toast-ra' : 'toast-vao'} pointer-events-auto w-full flex items-start gap-2.5 border shadow-lg px-4 py-3 ${mauNen(t.loai)}`}
          // Thời lượng đặt inline (đè lên giá trị trong CSS) để nó chỉ tồn tại ở MỘT chỗ duy nhất --
          // xem THOI_GIAN_THOAT ở đầu file.
          style={t.dangThoat ? { animationDuration: `${THOI_GIAN_THOAT}ms` } : undefined}
        >
          {bieuTuong(t.loai)}
          <p className="flex-1 text-sm leading-snug">{t.noiDung}</p>
          <button
            onClick={() => onDong(t.id)}
            aria-label="Đóng thông báo"
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <IconX size={16} stroke={1.8} />
          </button>
        </div>
      ))}
    </div>
  )
}

function mauNen(loai: LoaiToast): string {
  switch (loai) {
    case 'thanhCong':
      return 'bg-white border-green-300 text-stone-800'
    case 'loi':
      return 'bg-white border-red-300 text-stone-800'
    default:
      return 'bg-white border-stone-300 text-stone-800'
  }
}

// Màu KHÔNG phải là thứ duy nhất phân biệt loại thông báo -- kèm biểu tượng để người mù màu, hoặc
// người đọc trên màn hình chói, vẫn nhận ra ngay đây là báo thành công hay báo lỗi.
function bieuTuong(loai: LoaiToast) {
  switch (loai) {
    case 'thanhCong':
      return <IconCircleCheck size={18} stroke={1.8} className="shrink-0 mt-0.5 text-green-600" />
    case 'loi':
      return <IconAlertTriangle size={18} stroke={1.8} className="shrink-0 mt-0.5 text-red-600" />
    default:
      return <IconInfoCircle size={18} stroke={1.8} className="shrink-0 mt-0.5 text-stone-500" />
  }
}
