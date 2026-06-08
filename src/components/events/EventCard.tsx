import { Users } from 'lucide-react'
import { formatEventDateParts } from '../../data/mockEvents'
import { theme } from '../../styles/theme'
import type { Profile } from '../../types'
import type { EventMeta, UnifiedContent } from '../../types/content'
import UserAvatar from '../UserAvatar'
import BaseCard from '../ui/BaseCard'
import InstitutionAvatar from '../ui/InstitutionAvatar'
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

  return (
    <BaseCard
      as="button"
      type="button"
      variant={official ? 'premium' : 'default'}
      interactive
      flush
      onClick={() => onSelect(content.id)}
      className={`relative flex h-full w-full flex-col overflow-hidden text-left ${official ? 'official-card-premium' : ''}`}
    >
      {posterUrl ? (
        <div className="relative aspect-video w-full overflow-hidden">
          <img src={posterUrl} alt={content.title} className="h-full w-full object-cover" />
          {official ? (
            <div className="absolute left-3 top-3 z-[3]">
              <OfficialBadge size="sm" variant="floating" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative z-[2] flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-[40px] shrink-0 text-center">
            <span className={`block text-[10px] font-bold uppercase leading-none tracking-wide ${goldMuted}`}>
              {monthLabel}
            </span>
            <span className="block text-lg font-extrabold leading-tight text-fg-primary">{dayNum}</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {official ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {tag ? (
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide border-[#1e293b]/35 bg-[#1e293b]/[0.06] ${goldMuted} dark:border-brand-gold/40 dark:bg-brand-gold/10`}
                  >
                    {tag}
                  </span>
                ) : null}
                {posterUrl ? null : <OfficialBadge size="sm" variant="inline" />}
              </div>
            ) : null}

            <p
              className={`min-w-0 break-words text-sm leading-snug text-fg-primary line-clamp-3 ${
                official ? 'font-extrabold' : 'font-semibold'
              }`}
            >
              {content.title}
            </p>

            <p className="mt-0.5 line-clamp-2 text-xs text-fg-secondary">
              {content.metadata.location}
            </p>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            {official ? (
              <InstitutionAvatar
                className="h-6 w-6"
                label={content.author.displayName}
              />
            ) : (
              <UserAvatar
                profile={authorProfile}
                name={content.author.displayName}
                className="h-6 w-6"
                textSize="text-[10px]"
              />
            )}
            <span className="min-w-0 truncate text-xs font-semibold text-fg-primary">
              {content.author.displayName}
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <Users size={16} strokeWidth={2} className={`shrink-0 ${goldMuted}`} aria-hidden />
            <span>{content.metadata.attendees} uczestników</span>
          </p>
        </div>
      </div>
    </BaseCard>
  )
}
