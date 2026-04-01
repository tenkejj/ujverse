import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { formatEventDateParts, type UJEvent } from '../data/mockEvents'

type Props = {
  events: UJEvent[]
  /** Krótki dopisek przy danych z fallbacku ingestora. */
  showOfflineHint?: boolean
}

/**
 * Karuzela pozioma — oficjalne wpisy zsynchronizowane z WZiKS UJ.
 */
export default function WziksOfficialHub({ events, showOfflineHint }: Props) {
  const wziks = useMemo(() => {
    return [...events]
      .filter((e) => e.is_official && e.faculty === 'WZiKS')
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 16)
  }, [events])

  if (wziks.length === 0) return null

  return (
    <section className="mb-8" aria-labelledby="wziks-official-hub-title">
      <div className="flex items-end justify-between gap-3 mb-3 px-0.5">
        <h2
          id="wziks-official-hub-title"
          className="text-sm font-bold uppercase tracking-[0.14em] text-uj-navy dark:text-slate-300"
        >
          Oficjalne z WZiKS
        </h2>
        <span className="text-[11px] text-slate-500 dark:text-slate-500 shrink-0 text-right">
          {showOfflineHint ? (
            <span className="text-amber-700 dark:text-amber-400 font-medium">Wersja archiwalna</span>
          ) : (
            'Aktualności wydziału'
          )}
        </span>
      </div>
      <div
        className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]"
        style={{ scrollbarGutter: 'stable' }}
      >
        {wziks.map((ev) => (
          <WziksCard key={ev.id} event={ev} />
        ))}
      </div>
    </section>
  )
}

function WziksCard({ event }: { event: UJEvent }) {
  const { monthLabel, dayNum } = formatEventDateParts(event.date)
  const href = event.event_url || 'https://wziks.uj.edu.pl/wiadomosci/aktualnosci'

  return (
    <article
      className="snap-start shrink-0 w-[min(280px,78vw)] rounded-2xl border-2 border-[#ffa000]/55 bg-gradient-to-br from-amber-50/95 to-white shadow-[0_0_26px_-10px_rgba(255,160,0,0.55)] ring-1 ring-amber-400/25 dark:from-[#ffa000]/[0.09] dark:to-transparent dark:border-[#ffa000]/45 dark:ring-[#ffa000]/20 dark:shadow-[0_0_32px_-12px_rgba(255,160,0,0.4)] overflow-hidden flex flex-col"
    >
      <div className="relative h-28 bg-slate-200/80 dark:bg-slate-800/80 shrink-0">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-uj-navy/90 to-slate-900 opacity-90"
            aria-hidden
          />
        )}
        <div className="absolute top-2 left-2 rounded-lg bg-black/55 px-2 py-1 text-center backdrop-blur-sm border border-[#ffa000]/35">
          <span className="block text-[9px] font-bold uppercase text-[#ffa000] leading-none">
            {monthLabel}
          </span>
          <span className="block text-base font-extrabold text-white leading-tight">{dayNum}</span>
        </div>
      </div>
      <div className="p-3 flex flex-col flex-1 min-h-0 gap-2">
        <h3 className="text-[13px] font-semibold text-fg-primary leading-snug line-clamp-3">{event.title}</h3>
        {event.description ? (
          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 flex-1">{event.description}</p>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffa000] px-3 py-2.5 text-xs font-bold text-black hover:bg-[#e69000] transition-colors"
        >
          <ExternalLink size={14} strokeWidth={2.5} aria-hidden />
          Otwórz w portalu UJ
        </a>
      </div>
    </article>
  )
}
