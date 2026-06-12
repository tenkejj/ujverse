/**
 * UJverse — UsosRegistrationFormModal: dodawanie nowej rejestracji USOS.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Community-driven: każdy zalogowany może dodać. Front-side walidacja:
 *   - title 4-140
 *   - registration_url 8-500 + musi być URL
 *   - opens_at wymagane
 *   - closes_at > opens_at (gdy podane)
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { theme } from '../../styles/theme'
import {
  REGISTRATION_KINDS,
  REGISTRATION_KIND_META,
  type RegistrationKind,
} from '../../types/usosRegistrations'
import { UsosRegistrationsService } from '../../services/UsosRegistrationsService'

type Props = {
  userId: string
  /** Pre-fill kierunku z profilu zalogowanego użytkownika. */
  defaultStudyProgram?: string | null
  defaultYear?: number | null
  onClose: () => void
  onCreated: (registrationId?: string) => void
}

/** Format ISO timestamp for `datetime-local` input (YYYY-MM-DDTHH:mm). */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function UsosRegistrationFormModal({
  userId,
  defaultStudyProgram,
  defaultYear,
  onClose,
  onCreated,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [studyProgram, setStudyProgram] = useState(defaultStudyProgram ?? '')
  const [year, setYear] = useState<string>(defaultYear != null ? String(defaultYear) : '')
  const [audienceLabel, setAudienceLabel] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [registrationUrl, setRegistrationUrl] = useState('https://usosweb.uj.edu.pl/')
  const [infoUrl, setInfoUrl] = useState('')
  const [kind, setKind] = useState<RegistrationKind>('obieralne')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default opens_at = za 7 dni o 09:00 (wstępna podpowiedź)
  const opensAtPlaceholder = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setHours(9, 0, 0, 0)
    return isoToLocalInput(d.toISOString())
  }, [])

  const yearNum = year ? parseInt(year, 10) : null
  const validYear = yearNum == null || (Number.isFinite(yearNum) && yearNum >= 1 && yearNum <= 7)
  const opensDate = opensAt ? new Date(opensAt) : null
  const closesDate = closesAt ? new Date(closesAt) : null
  const opensValid = opensDate !== null && !Number.isNaN(opensDate.getTime())
  const closesValid =
    closesDate === null ||
    (!Number.isNaN(closesDate.getTime()) && opensDate !== null && closesDate.getTime() > opensDate.getTime())

  const canSubmit =
    title.trim().length >= 4 &&
    title.trim().length <= 140 &&
    registrationUrl.trim().length >= 8 &&
    /^https?:\/\//i.test(registrationUrl.trim()) &&
    opensValid &&
    closesValid &&
    validYear &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const { data: created, error: err } = await UsosRegistrationsService.create({
      createdBy: userId,
      title: title.trim(),
      description: description.trim() || null,
      studyProgram: studyProgram.trim() || null,
      year: yearNum,
      audienceLabel: audienceLabel.trim() || null,
      opensAt: new Date(opensAt).toISOString(),
      closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      registrationUrl: registrationUrl.trim(),
      infoUrl: infoUrl.trim() || null,
      kind,
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    onCreated(created?.id)
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dodaj rejestrację USOS"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl dark:bg-bg-app"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <h2 className={`text-lg font-bold ${theme.text.primary}`}>Dodaj rejestrację USOS</h2>
            <p className={`mt-0.5 text-[12px] ${theme.text.muted}`}>
              Pomagasz całemu rocznikowi nie przegapić rejestracji. Dzięki!
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full p-1.5 ${theme.text.muted} hover:bg-zinc-100 dark:hover:bg-white/10`}
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Title */}
          <div>
            <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
              Tytuł rejestracji <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 140))}
              placeholder="np. Informatyka II rok — przedmioty obieralne"
              className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-base sm:text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
            />
          </div>

          {/* Kind */}
          <div>
            <label className={`text-[12px] font-semibold ${theme.text.primary}`}>Typ rejestracji</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REGISTRATION_KINDS.map((k) => {
                const meta = REGISTRATION_KIND_META[k]
                const active = kind === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                      active
                        ? 'border-brand-gold bg-brand-gold/15 text-brand-gold dark:border-brand-gold-bright dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright'
                        : `border-zinc-200 ${theme.text.muted} hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.05]`
                    }`}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Audience: program + year + label */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
                Kierunek <span className={theme.text.muted}>(puste = dla wszystkich)</span>
              </label>
              <input
                type="text"
                value={studyProgram}
                onChange={(e) => setStudyProgram(e.target.value.slice(0, 80))}
                placeholder="np. Informatyka"
                className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-base sm:text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
              />
            </div>
            <div>
              <label className={`text-[12px] font-semibold ${theme.text.primary}`}>Rok</label>
              <input
                type="number"
                min={1}
                max={7}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="1-7"
                className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-base sm:text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
              />
              {!validYear && <p className="mt-0.5 text-[11px] text-red-600">Rok musi być 1-7.</p>}
            </div>
          </div>

          <div>
            <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
              Dokładnie dla kogo <span className={theme.text.muted}>(opcjonalnie)</span>
            </label>
            <input
              type="text"
              value={audienceLabel}
              onChange={(e) => setAudienceLabel(e.target.value.slice(0, 200))}
              placeholder="np. Wszyscy studenci I roku I stopnia, Wydział Filologiczny"
              className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-base sm:text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
            />
          </div>

          {/* Daty */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
                Otwarcie <span className="text-red-600">*</span>
              </label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                placeholder={opensAtPlaceholder}
                className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-base sm:text-[13px] ${theme.text.primary} focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03]`}
              />
            </div>
            <div>
              <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
                Zamknięcie <span className={theme.text.muted}>(opcjonalnie)</span>
              </label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-base sm:text-[13px] ${theme.text.primary} focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03]`}
              />
              {closesAt && !closesValid && (
                <p className="mt-0.5 text-[11px] text-red-600">Zamknięcie musi być po otwarciu.</p>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
                Link do rejestracji <span className="text-red-600">*</span>
              </label>
              <input
                type="url"
                value={registrationUrl}
                onChange={(e) => setRegistrationUrl(e.target.value.slice(0, 500))}
                placeholder="https://usosweb.uj.edu.pl/..."
                className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-base sm:text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
              />
            </div>
            <div>
              <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
                Link do opisu <span className={theme.text.muted}>(opcjonalnie)</span>
              </label>
              <input
                type="url"
                value={infoUrl}
                onChange={(e) => setInfoUrl(e.target.value.slice(0, 500))}
                placeholder="https://... (sylabus / lista przedmiotów)"
                className={`mt-1 block w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-base sm:text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={`text-[12px] font-semibold ${theme.text.primary}`}>
              Opis / co warto wiedzieć <span className={theme.text.muted}>(opcjonalnie)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1500))}
              placeholder="Limity miejsc, najpopularniejsze przedmioty, tipy..."
              rows={3}
              className={`mt-1 block w-full resize-none rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-base sm:text-[13px] ${theme.text.primary} placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500`}
            />
            <p className={`mt-0.5 text-[10.5px] ${theme.text.muted}`}>{description.length} / 1500</p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-500/15 dark:text-red-200">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-bg-app">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${theme.text.muted}`}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-gold-bright dark:text-zinc-900"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Dodaj rejestrację
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
