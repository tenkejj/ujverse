import type { ReactionAggregate } from '../../hooks/useCohortReactions'

type Props = {
  reactions: ReactionAggregate[]
  onToggle: (emoji: string) => void
  /**
   * Mapowanie userId → display name (full_name / username). Używane tylko
   * do tooltipa — dla nieznanych ID pokazujemy "Użytkownik". Pochodzi
   * z `members` w AulaView.
   */
  userNames?: Map<string, string>
}

function buildTooltip(agg: ReactionAggregate, userNames?: Map<string, string>): string {
  const names = agg.userIds
    .slice(0, 3)
    .map((id) => userNames?.get(id) ?? 'Użytkownik')
  const rest = agg.userIds.length - names.length
  const suffix = rest > 0 ? ` i jeszcze ${rest}` : ''
  return names.join(', ') + suffix
}

export default function ReactionBar({ reactions, onToggle, userNames }: Props) {
  if (reactions.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((agg) => (
        <button
          key={agg.emoji}
          type="button"
          onClick={() => onToggle(agg.emoji)}
          title={buildTooltip(agg, userNames)}
          aria-pressed={agg.mine}
          aria-label={`Reakcja ${agg.emoji}, ${agg.count} osób${agg.mine ? ', już zareagowałeś/aś' : ''}`}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-none transition-all ${
            agg.mine
              ? 'border-[#1e293b]/30 bg-[#1e293b]/[0.08] text-[#1e293b] hover:bg-[#1e293b]/[0.12] dark:border-brand-gold-bright/40 dark:bg-brand-gold-bright/[0.12] dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/[0.18]'
              : 'border-zinc-200 bg-black/[0.03] text-zinc-700 hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]'
          }`}
        >
          <span className="text-[13px] leading-none" aria-hidden>
            {agg.emoji}
          </span>
          <span className="font-semibold tabular-nums">{agg.count}</span>
        </button>
      ))}
    </div>
  )
}
