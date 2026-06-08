import { CalendarX, Search, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { EVENTS_HUB } from '../../styles/mobile-theme'

/**
 * EventsEmptyState — wyświetlany gdy `EventsView` nie ma nic do pokazania
 * po zastosowaniu filtra/searcha (lub baza wydarzeń jest pusta na starcie).
 *
 * Pożycza wzorzec z `OmniSearchHub.SmartHintsSection` — duża ikona-bąbel,
 * krótki nagłówek, miękki podpis, opcjonalne "szybkie wyjścia" (np. resetuj
 * filtr / wyczyść search).
 */

type SuggestedAction = {
  id: string
  label: string
  onClick: () => void
}

type Props = {
  /** Mode: `no-data` (baza pusta) lub `no-match` (filtr nic nie złapał). */
  variant: 'no-data' | 'no-match'
  /** Aktywne zapytanie / filtr — wyświetlane w podpisie. */
  context?: string
  /** Sugerowane akcje wyjścia z empty state. */
  suggestions?: SuggestedAction[]
}

const E = EVENTS_HUB.empty

export default function EventsEmptyState({ variant, context, suggestions = [] }: Props) {
  const isNoMatch = variant === 'no-match'
  const Icon = isNoMatch ? Search : CalendarX

  const title = isNoMatch
    ? 'Brak wyników dla aktualnego filtra'
    : 'Brak wydarzeń do pokazania'

  const subtitle = isNoMatch
    ? context
      ? `Nie znaleźliśmy nic pasującego do "${context}". Spróbuj zmienić filtr lub wpisać inne słowo.`
      : 'Spróbuj zmienić kategorię, wyczyścić wyszukiwanie lub poczekać aż pojawi się coś nowego.'
    : 'Nie ma jeszcze żadnych nadchodzących wydarzeń. Sprawdź ponownie za chwilę lub dodaj własne.'

  return (
    <motion.div
      variants={EVENTS_HUB.motion.fadeUp}
      initial="hidden"
      animate="show"
      className={E.wrapClass}
      role="status"
      aria-live="polite"
    >
      <div className={E.iconBubbleClass}>
        <Icon size={24} strokeWidth={2} aria-hidden />
      </div>
      <h3 className={E.titleClass}>{title}</h3>
      <p className={E.subtitleClass}>{subtitle}</p>

      {suggestions.length > 0 ? (
        <div className={E.hintsWrapClass}>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={s.onClick}
              className={E.hintChipClass}
            >
              <Sparkles size={13} strokeWidth={2} className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>
  )
}
