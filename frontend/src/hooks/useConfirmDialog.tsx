import { useCallback, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

/** Thay cho window.confirm() -- await confirm('...') y hệt cú pháp cũ, nhưng hiện modal có style riêng
 * thay vì popup xấu của trình duyệt. Nhớ render {dialog} 1 lần ở cuối component. */
export function useConfirmDialog() {
  const [pending, setPending] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setPending({ message, resolve })
    })
  }, [])

  function handleConfirm() {
    pending?.resolve(true)
    setPending(null)
  }
  function handleCancel() {
    pending?.resolve(false)
    setPending(null)
  }

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      message={pending?.message ?? ''}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, dialog }
}
