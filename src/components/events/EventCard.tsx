import { Shield, Users } from 'lucide-react'
import { formatEventDateParts } from '../../data/mockEvents'
import type { EventMeta, UnifiedContent } from '../../types/content'
import BaseCard from '../ui/BaseCard'

function facultyTag(content: UnifiedContent<EventMeta>): string | null {
  if (!content.metadata.isOfficial) return null
  if (content.metadata.faculty === 'WZiKS') return 'WZiKS'
  const src = content.metadata.sourceName
  if (src && src.length < 28) return src
  return 'UJ'
}

type Props = {
  content: UnifiedContent<EventMeta>
  onSelect: (id: string) => void
}

export default function EventCard({ content, onSelect }: Props) {
  const eventDate = new Date(content.metadata.date)
  const { monthLabel, dayNum } = formatEventDateParts(eventDate)
  const official = content.metadata.isOfficial
  const tag = facultyTag(content)

  const body = (
    <div className="relative z-[2] flex items-start gap-3">
      <div className="min-w-[40px] shrink-0 text-center">
        <span
          className={`block text-[10px] font-bold uppercase leading-none tracking-wide ${
            official ? 'text-brand-gold dark:text-brand-gold-bright' : 'text-accent-interactive'
          }`}
        >
          {monthLabel}
        </span>
        <span className="block text-lg font-extrabold leading-tight text-fg-primary">{dayNum}</span>
      </div>
      <div className="min-w-0 flex-1">
        {official && tag ? (
          <span className="mb-1 inline-flex rounded-full border border-[#c9a227]/40 bg-[#c9a227]/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-uj-navy dark:text-[#e8c84a]">
            {tag}
          </span>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <p
            className={`min-w-0 text-sm leading-snug ${
              official ? 'font-extrabold text-fg-primary' : 'font-semibold text-fg-primary'
            }`}
          >
            {content.title}
          </p>
          {official ? (
            <span
              className="shrink-0 inline-flex items-center gap-0.5 rounded-full border border-[#c9a227]/45 bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-uj-navy dark:bg-black/30 dark:text-[#f0d060]"
              title={content.metadata.sourceName ? `Źródło: ${content.metadata.sourceName}` : undefined}
            >
              <Shield size={11} className="text-[#b8922a] dark:text-[#e8c84a]" strokeWidth={2.5} aria-hidden />
              OFICJALNE UJ
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
          {content.metadata.location}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <Users size={16} strokeWidth={2} className="shrink-0 text-accent-interactive" aria-hidden />
          <span>{content.metadata.attendees} uczestników</span>
        </p>
      </div>
    </div>
  )

  if (official) {
    return (
      <BaseCard
        as="button"
        variant="premium"
        interactive
        flush
        type="button"
        onClick={() => onSelect(content.id)}
        className="official-card-premium relative w-full cursor-pointer bg-gradient-to-br from-gray-100 via-brand-gold/10 to-gray-100 p-4 text-left dark:from-[#1a1508]/90 dark:via-brand-gold/[0.07] dark:to-transparent"
      >
        {body}
      </BaseCard>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(content.id)}
      className="relative w-full cursor-pointer rounded-2xl border border-gray-200 bg-gray-100 p-4 text-left transition-colors hover:bg-gray-200/60 dark:border-border-app dark:bg-bg-card dark:hover:bg-white/5"
    >
      {body}
    </button>
  )
}
