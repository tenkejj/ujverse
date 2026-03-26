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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <motion.div
        className="w-full max-w-sm bg-white dark:bg-dark-card rounded-2xl shadow-uj-soft dark:shadow-none border border-slate-100 dark:border-gray-700 overflow-hidden"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: isClosing ? 0 : 1, y: isClosing ? 8 : 0, scale: isClosing ? 0.97 : 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-blue-50 leading-snug">
              {title}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Anuluj
          </button>
          <motion.button
            type="button"
            onClick={handleConfirm}
            whileTap={{ scale: 0.94 }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
          >
            {confirmLabel}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
