import { useMemo } from 'react'
import { Archive, ExternalLink, Radio } from 'lucide-react'
import { formatEventDateParts, type UJEvent } from '../data/mockEvents'
import { theme } from '../styles/theme'
import BaseCard from './ui/BaseCard'
import OfficialBadge from './ui/OfficialBadge'

type Props = {
  events: UJEvent[]
  /** True gdy feed działa na statycznym fallbacku (brak świeżych danych z sieci). */
  showOfflineHint?: boolean
}

function facultyChipLabel(ev: UJEvent): string {
  if (ev.faculty === 'WZiKS') return 'WZiKS'
  if (ev.source_name && ev.source_name !== 'Uniwersytet Jagielloński') return ev.source_name
  return 'UJ'
}

/**
 * Karuzela pozioma — oficjalne wpisy z hubu wiadomości UJ, WZiKS i kalendarza.
 *
 * Każdy kafel używa `BaseCard variant="premium"` + `OfficialBadge` — czyli
 * dokładnie tych samych prymitywów co `EventCard` w siatce. Spójność
 * jasny ↔ ciemny tryb jest zapewniona przez warianty BaseCard.
 */
export default function WziksOfficialHub({ events, showOfflineHint }: Props) {
  const official = useMemo(() => {
    return [...events]
      .filter((e) => e.is_official)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 16)
  }, [events])

  if (official.length === 0) return null

  return (
    <section className="mb-8" aria-labelledby="official-uj-hub-title">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3 px-0.5">
        <div className="min-w-0">
          <h2
            id="official-uj-hub-title"
            className={`text-sm font-extrabold uppercase tracking-[0.14em] ${theme.text.sectionHeader}`}
          >
            Oficjalne UJ
          </h2>
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0 text-slate-600 dark:text-slate-400"
          role="status"
        >
          {showOfflineHint ? (
            <>
              <Archive size={13} className={theme.text.goldMuted} strokeWidth={2.5} aria-hidden />
              <span className={theme.text.goldMuted}>Archiwum / Polecane</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <Radio size={13} className="text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />
              <span className="text-emerald-800 dark:text-emerald-300">Live</span>
            </>
          )}
        </span>
      </div>
      <div
        className="flex w-full min-w-0 max-w-full gap-4 overflow-x-auto overscroll-x-contain pb-2 px-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] custom-scrollbar"
        style={{ scrollbarGutter: 'stable' }}
      >
        {official.map((ev) => (
          <OfficialUjCard key={ev.id} event={ev} />
        ))}
      </div>
    </section>
  )
}

function OfficialUjCard({ event }: { event: UJEvent }) {
  const { monthLabel, dayNum } = formatEventDateParts(event.date)
  const href = event.event_url || 'https://www.uj.edu.pl/wiadomosci'
  const goldMuted = theme.text.goldMuted

  return (
    <BaseCard
      as="article"
      variant="premium"
      flush
      className="official-card-premium snap-start shrink-0 w-[min(280px,78vw)] overflow-hidden flex flex-col"
    >
      <div className="relative z-[2] h-28 bg-zinc-200/80 dark:bg-zinc-900/80 shrink-0">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#1e293b]/[0.12] to-transparent dark:from-brand-gold/15 dark:to-transparent"
            aria-hidden
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <div className="absolute top-2 left-2 z-[3] flex flex-col gap-1.5">
          <OfficialBadge size="sm" variant="floating" />
          <div className="inline-flex w-fit min-w-[3rem] flex-col items-center rounded-lg border border-[#1e293b]/35 bg-white/80 px-2 py-1 text-center backdrop-blur-sm dark:border-brand-gold/40 dark:bg-black/55">
            <span className={`block text-[9px] font-bold uppercase leading-none ${goldMuted}`}>
              {monthLabel}
            </span>
            <span className="block text-base font-extrabold text-fg-primary leading-tight">{dayNum}</span>
          </div>
        </div>
      </div>
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col gap-2 border-t border-zinc-200/90 bg-white/95 p-3 shadow-sm dark:border-white/10 dark:bg-transparent dark:shadow-none">
        <span className={`inline-flex w-fit rounded-full border border-[#1e293b]/35 bg-[#1e293b]/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${goldMuted} dark:border-brand-gold/40 dark:bg-brand-gold/10`}>
          {facultyChipLabel(event)}
        </span>
        <h3 className="text-[13px] font-extrabold text-fg-primary leading-snug line-clamp-3">{event.title}</h3>
        {event.description ? (
          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 flex-1 leading-relaxed">
            {event.description}
          </p>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-auto relative z-[3] w-full px-3 py-2.5 text-xs ${theme.button.primary}`}
        >
          <ExternalLink size={14} strokeWidth={2.5} aria-hidden />
          Otwórz w portalu UJ
        </a>
      </div>
    </BaseCard>
  )
}
