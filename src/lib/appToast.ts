import hotToast from 'react-hot-toast'
import type { ToastOptions } from 'react-hot-toast'

function withDedupeId(message: string, kind: string, opts?: ToastOptions): ToastOptions {
  return { ...opts, id: opts?.id ?? `${kind}:${message}` }
}

/** Toast z domyślną deduplikacją po treści (ten sam komunikat nie stackuje się wielokrotnie). */
export const toast = Object.assign(
  (message: string, opts?: ToastOptions) =>
    hotToast(message, withDedupeId(message, 'blank', opts)),
  {
    success: (message: string, opts?: ToastOptions) =>
      hotToast.success(message, withDedupeId(message, 'success', opts)),
    error: (message: string, opts?: ToastOptions) =>
      hotToast.error(message, withDedupeId(message, 'error', opts)),
    loading: hotToast.loading,
    custom: hotToast.custom,
    dismiss: hotToast.dismiss,
    remove: hotToast.remove,
    promise: hotToast.promise,
  },
)

export { Toaster } from 'react-hot-toast'
