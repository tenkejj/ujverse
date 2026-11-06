import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Landmark, X } from 'lucide-react'
import { DEPT_SHORT, UJ_DEPARTMENTS } from '../../lib/departments'
import { facultyShortLabel } from '../../lib/info/faculty'
import type { FacultySource } from '../../lib/info/preferences'
import { FOCUS_RING } from './infoUi'
import { useDialogA11y } from './useDialogA11y'

type Props = {
  faculty: string | null
  source: FacultySource
  persistent: boolean
  onChange: (faculty: string | null) => void
  className?: string
  /** `chip` — header; `hero` — duży panel na Start. */
  variant?: 'chip' | 'hero'
}

const TRIGGER_BASE =
  `inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors ${FOCUS_RING} ` +
  'border-brand-ink/30 bg-white/60 text-brand-ink hover:border-brand-ink/50 hover:bg-white ' +
  'dark:border-brand-gold-bright/35 dark:bg-white/[0.03] dark:text-brand-gold-bright dark:hover:border-brand-gold-bright/55 dark:hover:bg-white/[0.06]'

const HERO_TRIGGER =
  `group flex w-full items-center gap-4 rounded-[1.75rem] border px-5 py-5 text-left transition-colors sm:px-6 sm:py-6 ${FOCUS_RING} ` +
  'border-brand-ink/25 bg-gradient-to-br from-white via-white to-brand-ink/[0.04] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] ' +
  'hover:border-brand-ink/45 hover:to-brand-ink/[0.07] ' +
  'dark:border-brand-gold-bright/30 dark:from-zinc-950/70 dark:via-zinc-950/50 dark:to-brand-gold-bright/[0.07] ' +
  'dark:hover:border-brand-gold-bright/50'

const OPTION_BASE =
  `group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${FOCUS_RING}`
const OPTION_IDLE =
  'border-transparent hover:border-zinc-200 hover:bg-white/70 dark:hover:border-white/10 dark:hover:bg-white/[0.04]'
const OPTION_ACTIVE =
  'border-brand-ink/35 bg-brand-ink/[0.06] dark:border-brand-gold-bright/45 dark:bg-brand-gold-bright/10'

export default function FacultyPicker({
  faculty,
  source,
  persistent,
  onChange,
  className = '',
  variant = 'chip',
}: Props) {
  const [open, setOpen] = useState(false)
  // „Wybierz wydział" dopóki nic nie wybrano; „Cały UJ" tylko po świadomym wyborze.
  const shortLabel = faculty
    ? (facultyShortLabel(faculty) ?? faculty)
    : source === 'none'
      ? 'Wybierz wydział'
      : 'Cały UJ'
  const fullLabel = faculty ?? (source === 'none' ? null : 'Cały UJ — wszystkie wydziały')
  const needsChoice = !faculty && source === 'none'

  return (
    <>
      {variant === 'hero' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={faculty ? `Wydział: ${faculty}. Zmień wydział` : 'Wybierz wydział'}
          className={`${HERO_TRIGGER} ${className}`.trim()}
        >
          <span
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-ink/[0.08] text-brand-ink dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright"
            aria-hidden
          >
            <Landmark size={22} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-brand-ink dark:text-brand-gold-bright">
              Twój wydział
            </span>
            <span className="sr-only">Wydział: </span>
            <span className="mt-1 block truncate text-xl font-extrabold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
              {shortLabel}
            </span>
            <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">
              {needsChoice
                ? 'Wybierz, żeby zobaczyć komunikaty i rejestracje dla siebie.'
                : fullLabel && fullLabel !== shortLabel
                  ? fullLabel
                  : 'Kliknij, żeby zmienić.'}
            </span>
          </span>
          <ChevronDown
            size={20}
            strokeWidth={2.25}
            className="shrink-0 text-zinc-400 transition-transform group-hover:translate-y-0.5 dark:text-zinc-500"
            aria-hidden
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={faculty ? `Wydział: ${faculty}. Zmień wydział` : 'Wybierz wydział'}
          className={`${TRIGGER_BASE} ${className}`.trim()}
        >
          <Landmark size={15} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="sr-only">Wydział: </span>
          <span className="truncate">{shortLabel}</span>
          <ChevronDown size={14} strokeWidth={2.25} className="shrink-0 opacity-70" aria-hidden />
        </button>
      )}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <FacultyDialog
              faculty={faculty}
              source={source}
              persistent={persistent}
              onClose={() => setOpen(false)}
              onSelect={(next) => {
                onChange(next)
                setOpen(false)
              }}
            />,
            document.body,
          )
        : null}
    </>
  )
}

function FacultyDialog({
  faculty,
  source,
  persistent,
  onClose,
  onSelect,
}: {
  faculty: string | null
  source: FacultySource
  persistent: boolean
  onClose: () => void
  onSelect: (faculty: string | null) => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  useDialogA11y(true, panelRef, onClose, selectedRef)

  const options: Array<{ value: string | null; short: string; name: string }> = [
    { value: null, short: 'UJ', name: 'Cały UJ — wszystkie wydziały' },
    ...UJ_DEPARTMENTS.map((dept) => ({ value: dept, short: DEPT_SHORT[dept] ?? dept, name: dept })),
  ]

  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center sm:items-start sm:pt-[10vh]">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px] dark:bg-black/65"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-zinc-200 bg-bg-app shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)] outline-none animate-slide-up motion-reduce:animate-none sm:w-[min(32rem,calc(100vw-2rem))] sm:rounded-3xl dark:border-white/10 dark:shadow-[0_30px_80px_-24px_rgba(0,0,0,0.85)]"
      >
        <div className="flex items-start gap-3 border-b border-zinc-200 px-5 pb-3 pt-4 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Wybierz wydział
            </h2>
            <p id={descriptionId} className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Dopasujemy komunikaty, rejestracje i sekcję „Ważne teraz". Bez zakładania konta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij wybór wydziału"
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-black/5 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 ${FOCUS_RING}`}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3" role="list">
          {options.map((option) => {
            const active = option.value === faculty
            return (
              <li key={option.value ?? 'all'}>
                <button
                  ref={active ? selectedRef : undefined}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(option.value)}
                  className={`${OPTION_BASE} ${active ? OPTION_ACTIVE : OPTION_IDLE}`}
                >
                  <span className="inline-flex h-8 min-w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white/70 px-1.5 text-[11px] font-bold text-brand-ink dark:border-white/10 dark:bg-white/[0.04] dark:text-brand-gold-bright">
                    {option.short}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {option.name}
                  </span>
                  {active ? (
                    <Check size={16} strokeWidth={2.5} className="shrink-0 text-brand-ink dark:text-brand-gold-bright" aria-hidden />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>

        <p className="border-t border-zinc-200 px-5 py-3 text-[11px] text-zinc-500 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10 dark:text-zinc-400">
          {source === 'profile'
            ? 'Domyślnie używamy wydziału z Twojego profilu. Zmiana tutaj dotyczy tylko tego urządzenia i nie zmienia profilu.'
            : persistent
              ? 'Wybór zapisuje się tylko w tej przeglądarce.'
              : 'Ta przeglądarka nie pozwala zapisać wyboru — będzie obowiązywał do zamknięcia karty.'}
        </p>
      </div>
    </div>
  )
}
