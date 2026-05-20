import BaseCard from '../ui/BaseCard'
import { DEPT_BADGE_SPAN_CLASS } from '../../lib/interactionBar'
import { getDeptAbbreviation } from '../../lib/departments'
import type { SearchUserHit } from '../../types/search'

type Props = {
  hit: SearchUserHit
  onOpen: (userId: string) => void
}

function pickInitial(hit: SearchUserHit): string {
  const source = hit.fullName ?? hit.username ?? 'U'
  return source.charAt(0).toUpperCase() || 'U'
}

export default function SearchUserResultRow({ hit, onOpen }: Props) {
  const displayName = hit.fullName ?? hit.username ?? 'Użytkownik'
  const initial = pickInitial(hit)

  return (
    <BaseCard
      as="button"
      type="button"
      variant="inner"
      interactive
      onClick={() => onOpen(hit.id)}
      className="w-full text-left"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {hit.avatarUrl ? (
          <img
            src={hit.avatarUrl}
            alt={displayName}
            className="h-12 w-12 shrink-0 rounded-full object-cover object-center ring-2 ring-[#1e293b]/20 dark:ring-brand-gold/30"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1e293b]/10 ring-2 ring-[#1e293b]/20 dark:bg-brand-gold-bright/15 dark:ring-brand-gold/30">
            <span className="text-sm font-bold text-[#1e293b] dark:text-brand-gold-bright">
              {initial}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {displayName}
          </p>
          {hit.username && (
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              @{hit.username}
            </p>
          )}
        </div>

        {hit.department && (
          <span className={DEPT_BADGE_SPAN_CLASS}>
            {getDeptAbbreviation(hit.department)}
          </span>
        )}
      </div>
    </BaseCard>
  )
}
