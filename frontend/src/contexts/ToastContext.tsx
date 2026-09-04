import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import ToastStack, { type Toast, type LoaiToast } from '../components/ToastStack'
import { themVaoHangDoi } from '../utils/toastQueue'

/**
 * Thông báo ngắn, tự biến mất.
 *
 * DÙNG KHI NÀO: xác nhận một hành động vừa xảy ra mà giao diện không tự nói lên điều đó -- đăng xuất,
 * phiên hết hạn. KHÔNG dùng cho lỗi trong form (báo ngay tại chỗ, cạnh ô nhập, để người dùng biết sửa
 * ở đâu) và không dùng cho việc cần người dùng quyết định (dùng ConfirmDialog/AlertDialog).
 *
 * Vì sao là context chứ không phải state cục bộ: đăng xuất bấm được từ Header lẫn trang Tài khoản, còn
 * phiên hết hạn thì do đồng hồ trong AuthContext tự kích -- không có một component chung nào để đặt
 * state. Provider PHẢI bọc ngoài AuthProvider để AuthContext gọi được useToast().
 */

interface ToastContextValue {
  /** Hiện một thông báo. Trả về id để tự đóng sớm nếu cần. */
  hienToast: (noiDung: string, loai?: LoaiToast) => number
  dongToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

/** Số toast hiện cùng lúc tối đa. Nhiều hơn thì che mất trang và chẳng ai đọc kịp. */
const TOI_DA = 3

/**
 * Tự đóng sau bao lâu (ms).
 *
 * Hết thời gian là gỡ khỏi cây React NGAY, cố ý không có hiệu ứng mờ dần lúc biến mất -- toast tắt dứt
 * khoát chứ không nhùng nhằng thêm vài trăm mili giây nữa. Chỉ giữ hiệu ứng lúc XUẤT HIỆN (.toast-vao
 * trong index.css), vì lúc đó chuyển động giúp mắt bắt được thứ vừa hiện ra; lúc biến mất thì không
 * còn gì để bắt nữa.
 */
const THOI_GIAN_SONG = 2000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Id tăng dần thay vì Date.now(): hai toast bắn trong cùng một mili giây sẽ trùng id, và React coi
  // hai phần tử trùng key là một -- toast thứ hai không hiện, hoặc hiện rồi biến mất bất thường.
  const idTiepTheo = useRef(1)
  const dongHo = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dongToast = useCallback((id: number) => {
    const h = dongHo.current.get(id)
    if (h) {
      clearTimeout(h)
      dongHo.current.delete(id)
    }
    setToasts((truoc) => truoc.filter((t) => t.id !== id))
  }, [])

  const hienToast = useCallback(
    (noiDung: string, loai: LoaiToast = 'thongTin') => {
      const id = idTiepTheo.current++
      // Cắt bớt từ ĐẦU danh sách: toast cũ nhất bị đẩy đi, cái vừa xảy ra luôn được thấy.
      setToasts((truoc) => themVaoHangDoi(truoc, { id, noiDung, loai }, TOI_DA))
      dongHo.current.set(id, setTimeout(() => dongToast(id), THOI_GIAN_SONG))
      return id
    },
    [dongToast],
  )

  // Dọn mọi đồng hồ đang chạy khi provider bị gỡ, tránh setState trên component đã unmount.
  useEffect(() => {
    const dsDongHo = dongHo.current
    return () => {
      dsDongHo.forEach(clearTimeout)
      dsDongHo.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ hienToast, dongToast }}>
      {children}
      <ToastStack toasts={toasts} onDong={dongToast} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast() phải được gọi bên trong <ToastProvider>')
  }
  return ctx
}
