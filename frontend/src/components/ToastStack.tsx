import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react'

export type LoaiToast = 'thanhCong' | 'loi' | 'thongTin'

export interface Toast {
  id: number
  noiDung: string
  loai: LoaiToast
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
          className={`toast-vao pointer-events-auto w-full flex items-start gap-2.5 border shadow-lg px-4 py-3 ${mauNen(t.loai)}`}
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
