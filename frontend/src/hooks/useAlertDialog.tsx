import { useCallback, useState } from 'react'
import AlertDialog from '../components/AlertDialog'

/** Thay cho window.alert() -- await alertDialog('...') y hệt cú pháp cũ, nhưng hiện modal có style
 * riêng thay vì popup xấu của trình duyệt (và không lặp lại chữ "localhost:5173 says"). Nhớ render
 * {dialog} 1 lần ở cuối component. */
export function useAlertDialog() {
  const [pending, setPending] = useState<{ message: string; resolve: () => void } | null>(null)

  const alertDialog = useCallback((message: string) => {
    return new Promise<void>((resolve) => {
      setPending({ message, resolve })
    })
  }, [])

  function handleClose() {
    pending?.resolve()
    setPending(null)
  }

  const dialog = <AlertDialog open={pending !== null} message={pending?.message ?? ''} onClose={handleClose} />

  return { alertDialog, dialog }
}
