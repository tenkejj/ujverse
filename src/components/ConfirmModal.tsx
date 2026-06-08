import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'

type Props = {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Usuń',
  onConfirm,
  onClose,
}: Props) {
  const [isClosing, setIsClosing] = useState(false)

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(onClose, 200)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirm = () => {
    onConfirm()
    handleClose()
  }

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-app bg-bg-card shadow-uj-soft backdrop-blur-md backdrop-saturate-150 dark:shadow-[0_30px_80px_-32px_rgba(0,0,0,0.9)]"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: isClosing ? 0 : 1, y: isClosing ? 8 : 0, scale: isClosing ? 0.97 : 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pb-4 pt-6">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/15">
            <AlertTriangle size={18} className="text-rose-500 dark:text-rose-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-snug text-fg-primary">
              {title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-fg-secondary">
              {message}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 pb-5">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[40px] rounded-xl px-4 text-sm font-semibold text-fg-secondary transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10"
          >
            Anuluj
          </button>
          <motion.button
            type="button"
            onClick={handleConfirm}
            whileTap={{ scale: 0.94 }}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:bg-rose-500 dark:hover:bg-rose-400"
          >
            {confirmLabel}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
