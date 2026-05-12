import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

const REPORT_REASONS = [
  'Spam',
  'Nękanie lub hejt',
  'Nieodpowiednie treści',
  'Prawa autorskie',
  'Inne',
] as const

type ReportReason = (typeof REPORT_REASONS)[number]

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void | Promise<void>
  title?: string
  confirmLabel?: string
  isSubmitting?: boolean
}

export default function ReportModal({
  open,
  onClose,
  onConfirm,
  title = 'Zgłoś treść',
  confirmLabel = 'Zgłoś',
  isSubmitting = false,
}: Props) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null)

  useEffect(() => {
    if (!open) {
      setSelectedReason(null)
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSubmitting, onClose, open])

  const handleConfirm = async () => {
    if (!selectedReason || isSubmitting) return
    await onConfirm(selectedReason)
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) {
              onClose()
            }
          }}
        >
          <motion.div
            className="w-full max-w-md rounded-2xl border border-border-app bg-bg-card shadow-uj-soft dark:shadow-none overflow-hidden p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-fg-primary">{title}</h3>
            <div className="mb-5">
              {REPORT_REASONS.map((reason) => {
                const isSelected = selectedReason === reason
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all mb-2 ${
                      isSelected
                        ? 'border-border-app bg-black/5 dark:bg-white/10 text-slate-900 dark:text-zinc-100'
                        : 'border-border-app bg-bg-card hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-gray-500 dark:text-gray-400'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {reason}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedReason || isSubmitting}
                className="min-h-[44px] rounded-xl px-4 text-sm font-semibold bg-red-600/90 hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
