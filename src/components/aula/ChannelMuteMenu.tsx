/**
 * UJverse — ChannelMuteMenu: dropdown z mode + snooze dla wyciszenia sali.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * UX:
 *   - 3 podstawowe tryby (Wszystko / Tylko wzmianki / Wyłącz) z highlight
 *     aktywnego.
 *   - 4 snooze duration (1h / 8h / 24h / Zawsze) widoczne TYLKO gdy user
 *     przesunie się z 'all' — przy wyborze trybu pyta o duration.
 *   - Aktywny snooze pokazuje countdown "Wycisz do HH:MM" + przycisk
 *     "Wznów teraz".
 *
 * Komponent jest "controlled menu" — parent zarządza open/close, ten render
 * sam dropdown. Pozycjonowanie absolute względem najbliższego relative parent.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellMinus, BellOff, Check, Clock, X } from 'lucide-react'
import type { ChannelMuteMode } from '../../types/database'

type SnoozeChoice = 1 | 8 | 24 | 'forever'

const SNOOZE_OPTIONS: Array<{ value: SnoozeChoice; label: string }> = [
  { value: 1, label: '1 godzinę' },
  { value: 8, label: '8 godzin' },
  { value: 24, label: '24 godziny' },
  { value: 'forever', label: 'Zawsze (do ręcznego wznowienia)' },
]

type Props = {
  /** Aktualny tryb (z hooka `useCohortChannelMutes`). */
  currentMode: ChannelMuteMode
  /** Aktywny snooze do tej chwili (null = na zawsze lub default). */
  mutedUntil: Date | null
  /** Nazwa sali do tekstu nagłówka (Sala główna lub konkretna sala). */
  channelLabel: string
  /** Wywoływane gdy user wybierze tryb (+ ew. snooze). */
  onChange: (mode: ChannelMuteMode, snoozeHours: number | null) => void
  /** Zamyka menu (Esc, click outside, po akcji). */
  onClose: () => void
}

/**
 * `currentMode` + `mutedUntil` w jednej zwięzłej etykiecie do statusu.
 * Wykorzystywane w hint pod nagłówkiem menu i w `ChannelHeader` tooltipie.
 */
export function describeMute(mode: ChannelMuteMode, mutedUntil: Date | null): string {
  if (mode === 'all') return 'Wszystkie powiadomienia włączone'
  const base =
    mode === 'mentions_only'
      ? 'Tylko @wzmianki'
      : 'Wszystkie powiadomienia wyłączone'
  if (mutedUntil == null) return `${base} — bezterminowo`
  const now = Date.now()
  const diffMs = mutedUntil.getTime() - now
  if (diffMs <= 0) return base
  const hours = Math.round(diffMs / 3600_000)
  if (hours < 1) {
    const mins = Math.max(1, Math.round(diffMs / 60_000))
    return `${base} — wraca za ${mins} min`
  }
  if (hours < 24) return `${base} — wraca za ${hours}h`
  const days = Math.round(hours / 24)
  return `${base} — wraca za ${days}d`
}

export default function ChannelMuteMenu({
  currentMode,
  mutedUntil,
  channelLabel,
  onChange,
  onClose,
}: Props) {
  // Stage: 'modes' = pokazujemy 3 tryby; 'snooze' = wybór duration po
  // klikinięciu 'mentions_only' lub 'none'.
  const [stage, setStage] = useState<'modes' | 'snooze'>('modes')
  const [pendingMode, setPendingMode] = useState<ChannelMuteMode | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Esc + click outside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointer = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // delay attach żeby kliknięcie otwierające menu nie zamknęło od razu
    const t = window.setTimeout(() => window.addEventListener('mousedown', onPointer), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.clearTimeout(t)
    }
  }, [onClose])

  const pickMode = useCallback(
    (mode: ChannelMuteMode) => {
      if (mode === 'all') {
        onChange('all', null)
        onClose()
        return
      }
      setPendingMode(mode)
      setStage('snooze')
    },
    [onChange, onClose],
  )

  const pickSnooze = useCallback(
    (choice: SnoozeChoice) => {
      if (pendingMode == null) return
      const hours = choice === 'forever' ? null : choice
      onChange(pendingMode, hours)
      onClose()
    },
    [pendingMode, onChange, onClose],
  )

  const isMuted = currentMode !== 'all'

  return (
    <div
      ref={containerRef}
      role="menu"
      aria-label={`Powiadomienia: ${channelLabel}`}
      className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-bg-card"
    >
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-white/10">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#1e293b] dark:text-brand-gold-bright">
          Powiadomienia
        </p>
        <p className="mt-0.5 truncate text-xs text-fg-secondary" title={channelLabel}>
          {channelLabel}
        </p>
        {isMuted && (
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {describeMute(currentMode, mutedUntil)}
          </p>
        )}
      </div>

      {stage === 'modes' ? (
        <div className="p-1">
          <MuteModeItem
            icon={<Bell size={14} />}
            label="Wszystkie"
            hint="Pełne powiadomienia (reply + wzmianki)"
            active={currentMode === 'all'}
            onClick={() => pickMode('all')}
          />
          <MuteModeItem
            icon={<BellMinus size={14} />}
            label="Tylko wzmianki"
            hint="Tylko gdy ktoś napisze @ciebie"
            active={currentMode === 'mentions_only'}
            onClick={() => pickMode('mentions_only')}
          />
          <MuteModeItem
            icon={<BellOff size={14} />}
            label="Wycisz"
            hint="Nic nie powiadamia (nawet wzmianki)"
            active={currentMode === 'none'}
            onClick={() => pickMode('none')}
          />
        </div>
      ) : (
        <div className="p-1">
          <div className="mb-1 flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} />
              Na jak długo?
            </span>
            <button
              type="button"
              onClick={() => {
                setStage('modes')
                setPendingMode(null)
              }}
              className="rounded-md p-0.5 text-zinc-400 hover:bg-black/[0.04] hover:text-zinc-700 dark:hover:bg-white/[0.05] dark:hover:text-zinc-200"
              aria-label="Wróć do trybów"
            >
              <X size={12} />
            </button>
          </div>
          {SNOOZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => pickSnooze(opt.value)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-fg-primary transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
            >
              <span>{opt.label}</span>
              {opt.value === 'forever' && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">domyślne</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MuteModeItem({
  icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitemradio"
      aria-checked={active}
      className={[
        'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
        active
          ? 'bg-[#1e293b]/[0.06] text-[#1e293b] dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright'
          : 'text-fg-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]',
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 shrink-0',
          active ? 'text-[#1e293b] dark:text-brand-gold-bright' : 'text-fg-secondary',
        ].join(' ')}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-[11px] text-fg-secondary">{hint}</span>
      </span>
      {active && (
        <Check size={14} className="mt-0.5 shrink-0 text-[#1e293b] dark:text-brand-gold-bright" />
      )}
    </button>
  )
}
