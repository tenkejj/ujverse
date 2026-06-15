import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag } from 'lucide-react'

const REPORT_REASONS = [
  'Spam',
  'Nękanie lub hejt',
  'Nieodpowiednie treści',
  'Prawa autorskie',
  'Inne',
] as const

type ReportReason = (typeof REPORT_REASONS)[number]

const DETAILS_MAX_LEN = 1000

type Props = {
  open: boolean
  onClose: () => void
  /**
   * `details` to opcjonalny opis od zgłaszającego (kontekst dla admina).
   * Trafia do `public.reports.details` — limit 1000 znaków po stronie DB.
   */
  onConfirm: (reason: string, details: string) => void | Promise<void>
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
  const [details, setDetails] = useState('')

  useEffect(() => {
    if (!open) {
      setSelectedReason(null)
      setDetails('')
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
    await onConfirm(selectedReason, details.trim())
  }

  if (typeof document === 'undefined') return null

  const canSubmit = Boolean(selectedReason) && !isSubmitting
  const detailsCount = details.length
  const detailsRemaining = DETAILS_MAX_LEN - detailsCount

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-110 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) {
              onClose()
            }
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border-app bg-bg-card shadow-uj-soft backdrop-blur-md backdrop-saturate-150 dark:shadow-[0_30px_80px_-32px_rgba(0,0,0,0.9)]"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4 px-6 pb-4 pt-6">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/15">
                <Flag size={18} className="text-rose-500 dark:text-rose-400" />
              </div>
              <div className="min-w-0">
                <h3
                  id="report-modal-title"
                  className="text-base font-bold leading-snug text-fg-primary"
                >
                  {title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-fg-secondary">
                  Wybierz powód — pomoże nam to szybciej zareagować na zgłoszenie.
                </p>
              </div>
            </div>

            <div className="px-6 pb-5">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-fg-secondary">
                Powód
              </span>
              <div className="mb-4 space-y-1.5">
                {REPORT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-[#1e293b]/45 bg-[#1e293b]/8 text-[#1e293b] dark:border-brand-gold/45 dark:bg-brand-gold/10 dark:text-brand-gold-bright'
                          : 'border-border-app bg-transparent text-fg-secondary hover:border-[#1e293b]/25 hover:bg-[#1e293b]/4 hover:text-fg-primary dark:hover:border-brand-gold/25 dark:hover:bg-white/5 dark:hover:text-zinc-100'
                      }`}
                      aria-pressed={isSelected}
                    >
                      {reason}
                    </button>
                  )
                })}
              </div>

              <div className="mb-5">
                <label
                  htmlFor="report-details"
                  className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-fg-secondary"
                >
                  <span>Szczegóły (opcjonalnie)</span>
                  <span
                    className={`font-mono normal-case tracking-normal text-[10px] ${
                      detailsRemaining < 0 ? 'text-rose-500' : 'text-fg-tertiary'
                    }`}
                    aria-live="polite"
                  >
                    {detailsCount}/{DETAILS_MAX_LEN}
                  </span>
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value.slice(0, DETAILS_MAX_LEN))}
                  rows={3}
                  maxLength={DETAILS_MAX_LEN}
                  placeholder="Opisz, dlaczego zgłaszasz tę treść (np. konkretny fragment, kontekst). Pomoże to administracji szybciej zareagować."
                  className="w-full resize-none rounded-xl border border-border-app bg-transparent px-4 py-3 text-sm leading-relaxed text-fg-primary placeholder:text-fg-tertiary outline-none transition-colors focus:border-[#1e293b]/45 focus:bg-[#1e293b]/3 dark:focus:border-brand-gold/45 dark:focus:bg-white/4"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-fg-secondary transition-colors hover:bg-black/5 active:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5 dark:active:bg-white/10"
                >
                  Anuluj
                </button>
                <motion.button
                  type="button"
                  onClick={handleConfirm}
                  whileTap={canSubmit ? { scale: 0.96 } : undefined}
                  disabled={!canSubmit}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-500 dark:hover:bg-rose-400"
                >
                  {isSubmitting && (
                    <span
                      className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent"
                      aria-hidden
                    />
                  )}
                  {confirmLabel}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
