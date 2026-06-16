import type { DisplaySummary } from '../../lib/announcementSummary'

type Props = {
  summary: DisplaySummary
  /** `card` = kompakt na liście; `drawer` = większy w modalu mobilnym. */
  variant?: 'card' | 'drawer'
}

/**
 * Blok TL;DR komunikatu — wyraźnie oznacza że to streszczenie, nie pełna treść.
 * Gdy `source === 'ai'` → badge „Versuś w skrócie" (model z passu scrapera).
 * Gdy `heuristic` → „Podgląd" (pierwsze zdanie z body, AI jeszcze nie ruszyło).
 */
export default function AnnouncementTldr({ summary, variant = 'card' }: Props) {
  const isAi = summary.source === 'ai'
  const textCls =
    variant === 'drawer'
      ? 'text-[15px] leading-snug text-fg-primary'
      : 'text-xs leading-snug text-zinc-800 dark:text-zinc-200'

  return (
    <div
      className={
        variant === 'drawer'
          ? 'mt-4 rounded-xl border border-brand-gold/25 bg-brand-gold/[0.06] px-3 py-2.5 dark:border-brand-gold-bright/25 dark:bg-brand-gold-bright/[0.06]'
          : 'mb-2 rounded-lg border border-brand-gold/20 bg-brand-gold/[0.05] px-2.5 py-2 dark:border-brand-gold-bright/20 dark:bg-brand-gold-bright/[0.05]'
      }
      role="note"
      aria-label={isAi ? 'Streszczenie AI Versuś' : 'Podgląd treści komunikatu'}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${
            isAi
              ? 'bg-brand-gold/20 text-logo-navy dark:bg-brand-gold-bright/20 dark:text-brand-gold-bright'
              : 'bg-zinc-200/80 text-zinc-600 dark:bg-white/10 dark:text-zinc-400'
          }`}
        >
          {isAi ? 'Versuś w skrócie' : 'Podgląd'}
        </span>
        {isAi ? (
          <span className="text-[9px] text-fg-secondary opacity-70">streszczenie AI</span>
        ) : null}
      </div>
      <p className={`font-medium ${textCls}`}>{summary.text}</p>
    </div>
  )
}
