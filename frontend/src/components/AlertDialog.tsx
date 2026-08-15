interface AlertDialogProps {
  open: boolean
  message: string
  okLabel?: string
  onClose: () => void
}

/** Modal thông báo dùng chung, thay cho window.alert() (không đồng bộ giao diện, không style được).
 * Dùng qua hook useAlertDialog() thay vì render trực tiếp component này. */
export default function AlertDialog({ open, message, okLabel = 'Đã hiểu', onClose }: AlertDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60 px-4">
      <div className="bg-white max-w-sm w-full p-6">
        <p className="text-sm text-stone-700 mb-6 whitespace-pre-line">{message}</p>
        <button
          onClick={onClose}
          className="w-full bg-stone-900 border-gold-metallic gold-glow text-white text-sm font-semibold py-2.5"
        >
          {okLabel}
        </button>
      </div>
    </div>
  )
}
