/**
 * UJverse — PollDisplay: renderowanie ankiety wewnątrz `AulaMessageItem`.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Anatomia opcji (Slack-like): wiersz z radio, label opcji, procent po prawej,
 * pasek wypełnienia w tle. Klik kontrolki = optimistic vote (lub cofnięcie).
 * Jeśli `myVoteIndex === null` paski pokazujemy bardziej subtelnie (zamglone) —
 * social pressure żeby zagłosować zanim zobaczysz wyniki, ale nie blokujemy
 * informacji (każdy widzi sumę totalVotes na dole).
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Check, Lock } from 'lucide-react'
import type { CohortPollAggregate } from '../../types/database'

type Props = {
  aggregate: CohortPollAggregate
  /** Aktualny user (do detekcji „jesteś twórcą" → przycisk Zamknij). */
  currentUserId: string
  /** Mapa userId → display name (do tooltipów voterów). Opcjonalne. */
  userNames?: Map<string, string>
  onVote: (messageId: number, optionIndex: number | null) => void
  onClose?: (messageId: number) => void
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

export default function PollDisplay({
  aggregate,
  currentUserId,
  userNames,
  onVote,
  onClose,
}: Props) {
  const { poll, countsPerOption, votersPerOption, totalVotes, myVoteIndex } = aggregate
  const isClosed = poll.closed_at != null
  const isOwner = poll.user_id === currentUserId
  const hasVoted = myVoteIndex != null
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)

  const maxCount = useMemo(
    () => countsPerOption.reduce((m, c) => Math.max(m, c), 0),
    [countsPerOption],
  )

  const handlePick = (i: number) => {
    if (isClosed) return
    setPendingIndex(i)
    const next = myVoteIndex === i ? null : i
    onVote(poll.message_id, next)
    // Reset pendingIndex po 400ms — wystarczy żeby Realtime / optimistic
    // zaktualizowały aggregate. Niezbyt krytyczne.
    window.setTimeout(() => setPendingIndex(null), 400)
  }

  return (
    <div className="mt-2 max-w-md rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1e293b]/10 text-[#1e293b] dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright">
          <BarChart3 size={11} strokeWidth={2.5} />
        </span>
        <h4 className="min-w-0 flex-1 text-sm font-bold leading-snug text-fg-primary">
          {poll.question}
        </h4>
        {isClosed && (
          <span
            title={`Zamknięta ${new Date(poll.closed_at as string).toLocaleString('pl-PL')}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-400"
          >
            <Lock size={8} />
            Zamknięta
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {poll.options.map((label, i) => {
          const count = countsPerOption[i] ?? 0
          const percent = pct(count, totalVotes)
          const isMine = myVoteIndex === i
          const isTop = !isClosed ? false : count > 0 && count === maxCount
          const isPending = pendingIndex === i

          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => handlePick(i)}
                disabled={isClosed}
                aria-pressed={isMine}
                className={[
                  'group relative block w-full overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors',
                  isMine
                    ? 'border-[#1e293b]/40 bg-white dark:border-brand-gold-bright/40 dark:bg-white/[0.05]'
                    : 'border-zinc-200 bg-white/70 hover:border-zinc-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.05]',
                  isClosed ? 'cursor-default' : 'cursor-pointer',
                ].join(' ')}
              >
                {/* Pasek w tle */}
                <motion.div
                  aria-hidden
                  className={[
                    'absolute inset-y-0 left-0 z-0',
                    isMine
                      ? 'bg-[#1e293b]/12 dark:bg-brand-gold-bright/15'
                      : isTop
                        ? 'bg-emerald-500/10 dark:bg-emerald-400/10'
                        : 'bg-zinc-300/35 dark:bg-white/[0.06]',
                    !hasVoted && !isClosed ? 'opacity-50' : 'opacity-100',
                  ].join(' ')}
                  initial={false}
                  animate={{ width: `${percent}%` }}
                  transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                />
                <div className="relative z-10 flex items-center gap-2.5">
                  <span
                    className={[
                      'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isMine
                        ? 'border-[#1e293b] bg-[#1e293b] text-white dark:border-brand-gold-bright dark:bg-brand-gold-bright dark:text-bg-card'
                        : 'border-zinc-300 bg-transparent dark:border-white/25',
                    ].join(' ')}
                  >
                    {isMine && <Check size={9} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg-primary">
                    {label}
                  </span>
                  <span
                    className={[
                      'shrink-0 text-xs tabular-nums transition-colors',
                      isMine
                        ? 'font-bold text-[#1e293b] dark:text-brand-gold-bright'
                        : 'font-semibold text-zinc-500 dark:text-zinc-400',
                    ].join(' ')}
                  >
                    {percent}%
                    <span className="ml-1 text-[10px] font-medium text-zinc-400">
                      ({count})
                    </span>
                  </span>
                </div>
                {/* Awatary-imiona voterów (do 3 widocznych + reszta) */}
                {votersPerOption[i].length > 0 && (
                  <div className="relative z-10 mt-0.5 flex flex-wrap items-center gap-1 pl-6 text-[10px] text-zinc-500 dark:text-zinc-400">
                    {votersPerOption[i].slice(0, 3).map((uid) => (
                      <span
                        key={uid}
                        className="inline-flex max-w-[8rem] truncate rounded-full bg-black/[0.04] px-1.5 py-0.5 dark:bg-white/[0.04]"
                        title={userNames?.get(uid) ?? uid}
                      >
                        {userNames?.get(uid) ?? '…'}
                      </span>
                    ))}
                    {votersPerOption[i].length > 3 && (
                      <span className="text-[10px] font-medium text-zinc-400">
                        +{votersPerOption[i].length - 3}
                      </span>
                    )}
                  </div>
                )}
                {/* Loader pseudo-stan na czas pending vote */}
                {isPending && (
                  <span aria-hidden className="sr-only">
                    Zapisuję głos…
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>
          {totalVotes === 0
            ? 'Nikt jeszcze nie zagłosował.'
            : `${totalVotes} ${totalVotes === 1 ? 'głos' : totalVotes < 5 ? 'głosy' : 'głosów'}`}
          {hasVoted && !isClosed && (
            <button
              type="button"
              onClick={() => onVote(poll.message_id, null)}
              className="ml-2 text-[11px] font-semibold text-zinc-500 underline-offset-2 hover:text-[#1e293b] hover:underline dark:text-zinc-400 dark:hover:text-brand-gold-bright"
            >
              cofnij głos
            </button>
          )}
        </span>
        {isOwner && !isClosed && onClose && (
          <button
            type="button"
            onClick={() => onClose(poll.message_id)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-zinc-600 transition-colors hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.06]"
          >
            <Lock size={10} />
            Zamknij ankietę
          </button>
        )}
      </div>
    </div>
  )
}
