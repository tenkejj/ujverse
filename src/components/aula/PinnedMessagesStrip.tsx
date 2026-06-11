import { useState } from 'react'
import { ChevronDown, ChevronUp, Pin } from 'lucide-react'
import { relativeTime } from '../../lib/utils'
import UserAvatar from '../UserAvatar'
import type { Profile } from '../../types'
import type { CohortMessageWithAuthor } from '../../services/CohortService'

type Props = {
  pinned: CohortMessageWithAuthor[]
  onJump: (messageId: number) => void
}

function snippet(content: string, max = 110): string {
  if (content.length <= max) return content
  return content.slice(0, max).trimEnd() + '…'
}

export default function PinnedMessagesStrip({ pinned, onJump }: Props) {
  // Domyślnie expanded jeśli ≤3 wpisów (mało miejsca), collapsed gdy więcej.
  const [expanded, setExpanded] = useState(() => pinned.length > 0 && pinned.length <= 3)

  if (pinned.length === 0) return null

  return (
    <div className="border-b border-zinc-200 bg-[#1e293b]/[0.03] dark:border-white/10 dark:bg-brand-gold-bright/[0.04]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2 text-[#1e293b] dark:text-brand-gold-bright">
          <Pin size={14} strokeWidth={2.25} />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">
            Przypięte ({pinned.length})
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-zinc-500 dark:text-zinc-400" />
        ) : (
          <ChevronDown size={14} className="text-zinc-500 dark:text-zinc-400" />
        )}
      </button>
      {expanded && (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto px-2 pb-2">
          {pinned.map((m) => {
            const name = m.profiles?.full_name || m.profiles?.username || 'Użytkownik'
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onJump(m.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                >
                  <UserAvatar
                    profile={(m.profiles ?? null) as Profile | null}
                    name={name}
                    className="mt-0.5 h-6 w-6 shrink-0"
                    textSize="text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-xs font-semibold text-fg-primary">
                        {name}
                      </span>
                      <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {relativeTime(m.created_at)}
                      </span>
                    </div>
                    <p className="truncate text-[12px] text-zinc-600 dark:text-zinc-300">
                      {snippet(m.content)}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
