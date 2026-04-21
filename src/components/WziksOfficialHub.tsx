import { useMemo } from 'react'
import { Archive, ExternalLink, Radio, Shield } from 'lucide-react'
import { formatEventDateParts, type UJEvent } from '../data/mockEvents'

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
            className="text-sm font-extrabold uppercase tracking-[0.14em] text-uj-navy dark:text-slate-200"
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
              <Archive size={13} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.5} aria-hidden />
              <span className="text-brand-gold dark:text-brand-gold-bright/90">Archiwum / Polecane</span>
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

  return (
    <article
      className="official-card-premium snap-start shrink-0 w-[min(280px,78vw)] rounded-2xl border-2 border-brand-gold/60 bg-gradient-to-br from-[#fdf8ed] via-brand-gold/12 to-white shadow-[0_2px_8px_rgba(15,23,42,0.08),0_0_26px_-10px_rgba(201,162,39,0.42)] ring-1 ring-zinc-300/90 dark:from-[#1a1508]/95 dark:via-brand-gold/[0.07] dark:to-transparent dark:border-brand-gold/45 dark:ring-brand-gold/15 dark:shadow-[0_0_36px_-12px_rgba(201,162,39,0.28)] overflow-hidden flex flex-col"
    >
      <div className="relative z-[2] h-28 bg-slate-200/80 dark:bg-slate-800/80 shrink-0">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-uj-navy/90 to-slate-900 opacity-90"
            aria-hidden
          />
        )}
        <div className="absolute top-2 left-2 z-[3] flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-lg border border-[#c9a227]/50 bg-black/60 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#f5e6a8] backdrop-blur-sm">
            <Shield size={11} className="text-[#f0d060]" strokeWidth={2.5} aria-hidden />
            OFICJALNE UJ
          </span>
          <div className="rounded-lg bg-black/55 px-2 py-1 text-center backdrop-blur-sm border border-[#c9a227]/35 w-fit min-w-[3rem]">
            <span className="block text-[9px] font-bold uppercase text-[#f5e6a8] leading-none">
              {monthLabel}
            </span>
            <span className="block text-base font-extrabold text-white leading-tight">{dayNum}</span>
          </div>
        </div>
      </div>
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col gap-2 border-t border-zinc-200/90 bg-white/95 p-3 shadow-sm dark:border-white/10 dark:bg-transparent dark:shadow-none">
        <span className="inline-flex w-fit rounded-full border border-[#c9a227]/40 bg-[#c9a227]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-uj-navy dark:text-[#e8c84a]">
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
          className="mt-auto relative z-[3] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#c9a227] to-[#e8b84d] px-3 py-2.5 text-xs font-extrabold text-[#1a1508] hover:from-[#b8922a] hover:to-[#d9a840] transition-colors shadow-sm"
        >
          <ExternalLink size={14} strokeWidth={2.5} aria-hidden />
          Otwórz w portalu UJ
        </a>
      </div>
    </article>
  )
}
