interface ConfirmDialogProps {
  open: boolean
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Modal xác nhận dùng chung, thay cho window.confirm() (không đồng bộ giao diện, không style được).
 * Dùng qua hook useConfirmDialog() thay vì render trực tiếp component này. */
export default function ConfirmDialog({
  open,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60 px-4">
      <div className="bg-white max-w-sm w-full p-6">
        <p className="text-sm text-stone-700 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-stone-300 text-sm py-2.5 hover:bg-stone-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
