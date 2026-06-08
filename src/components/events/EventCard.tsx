import { Users } from 'lucide-react'
import { formatEventDateParts } from '../../data/mockEvents'
import { theme } from '../../styles/theme'
import type { Profile } from '../../types'
import type { EventMeta, UnifiedContent } from '../../types/content'
import UserAvatar from '../UserAvatar'
import BaseCard from '../ui/BaseCard'
import OfficialBadge from '../ui/OfficialBadge'

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

const goldMuted = theme.text.goldMuted

export default function EventCard({ content, onSelect }: Props) {
  const eventDate = new Date(content.metadata.date)
  const { monthLabel, dayNum } = formatEventDateParts(eventDate)
  const official = content.metadata.isOfficial
  const tag = facultyTag(content)
  const posterUrl = content.metadata.imageUrl?.trim() || null
  const authorProfile: Profile = {
    id: content.author.id,
    full_name: content.author.displayName,
    avatar_url: content.author.avatarUrl ?? null,
    username: null,
  }

  const body = (
    <div className="relative z-[2] flex items-start gap-3">
      <div className="min-w-[40px] shrink-0 text-center">
        <span className={`block text-[10px] font-bold uppercase leading-none tracking-wide ${goldMuted}`}>
          {monthLabel}
        </span>
        <span className="block text-lg font-extrabold leading-tight text-fg-primary">{dayNum}</span>
      </div>
      <div className="min-w-0 flex-1">
        {official && tag ? (
          <span className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide border-[#1e293b]/35 bg-[#1e293b]/[0.06] ${goldMuted} dark:border-brand-gold/40 dark:bg-brand-gold/10`}>
            {tag}
          </span>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <p
            className={`min-w-0 text-sm leading-snug text-fg-primary ${
              official ? 'font-extrabold' : 'font-semibold'
            }`}
          >
            {content.title}
          </p>
          {official ? <OfficialBadge size="sm" variant="inline" className="shrink-0" /> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-fg-secondary">
          {content.metadata.location}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <UserAvatar
            profile={authorProfile}
            name={content.author.displayName}
            className="h-6 w-6"
            textSize="text-[10px]"
          />
          <span className="truncate text-xs font-semibold text-fg-primary">
            {content.author.displayName}
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-secondary">
          <Users size={16} strokeWidth={2} className={`shrink-0 ${goldMuted}`} aria-hidden />
          <span>{content.metadata.attendees} uczestników</span>
        </p>
      </div>
    </div>
  )

  return (
    <BaseCard
      as="button"
      type="button"
      variant={official ? 'premium' : 'default'}
      interactive
      flush
      onClick={() => onSelect(content.id)}
      className={`relative w-full overflow-hidden text-left ${official ? 'official-card-premium' : ''}`}
    >
      {posterUrl ? (
        <div className="aspect-video w-full overflow-hidden">
          <img src={posterUrl} alt={content.title} className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className="p-4">{body}</div>
    </BaseCard>
  )
}
