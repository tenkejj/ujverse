/**
 * UJverse — przycisk subskrypcji wykładowcy („dzwonek" przy nazwisku
 * w karcie / drawerze komunikatu).
 */
import { Bell, BellOff } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useLecturerSubscriptionsContext } from '../../lib/lecturerSubscriptionsContext'

type Variant = 'compact' | 'pill'

type Props = {
  /** Pełna nazwa wykładowcy jak w `announcements.lecturer_name` (raw). */
  lecturerName: string
  /**
   * `compact` — okrągły 24px ikon-only obok nazwiska w karcie listy.
   * `pill`     — duża pigułka do drawera (z labelem).
   */
  variant?: Variant
  /** Klasy dorzucone do wrappera (np. align/margin w hostującym layoucie). */
  className?: string
  /**
   * Zatrzymanie propagacji kliku — domyślne `true`, bo karta komunikatu
   * często sama jest klikalna (otwiera drawer), a dzwonek to inna akcja.
   */
  stopPropagation?: boolean
}

const COMPACT_BASE =
  'inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors [-webkit-tap-highlight-color:transparent]'
const COMPACT_OFF =
  'border-zinc-200 bg-white/70 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200'
const COMPACT_ON =
  'border-brand-gold/40 bg-brand-gold/15 text-brand-gold-bright hover:bg-brand-gold/25 dark:border-brand-gold-bright/40 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/20'

const PILL_BASE =
  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors [-webkit-tap-highlight-color:transparent]'
const PILL_OFF =
  'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]'
const PILL_ON =
  'border-brand-gold/40 bg-brand-gold/15 text-brand-gold-bright hover:bg-brand-gold/25 dark:border-brand-gold-bright/40 dark:bg-brand-gold-bright/10 dark:hover:bg-brand-gold-bright/20'

export default function LecturerSubscribeBell({
  lecturerName,
  variant = 'compact',
  className = '',
  stopPropagation = true,
}: Props) {
  const ctx = useLecturerSubscriptionsContext()
  if (!ctx || !ctx.userId) return null
  if (!lecturerName.trim() || lecturerName.toLowerCase().startsWith('komunikat')) return null

  const subscribed = ctx.isSubscribed(lecturerName)

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.stopPropagation()
      event.preventDefault()
    }
    void ctx.toggle(lecturerName)
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={subscribed}
        title={subscribed ? 'Wyłącz powiadomienia o tym wykładowcy' : 'Włącz powiadomienia o tym wykładowcy'}
        className={`${PILL_BASE} ${subscribed ? PILL_ON : PILL_OFF} ${className}`}
      >
        {subscribed ? <BellOff size={16} strokeWidth={2.25} /> : <Bell size={16} strokeWidth={2.25} />}
        <span>{subscribed ? 'Subskrybujesz' : 'Powiadamiaj o tym wykładowcy'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={subscribed}
      aria-label={subscribed ? 'Wyłącz powiadomienia o wykładowcy' : 'Włącz powiadomienia o wykładowcy'}
      title={subscribed ? 'Subskrybujesz tego wykładowcę' : 'Powiadom mnie o nowych komunikatach'}
      className={`${COMPACT_BASE} ${subscribed ? COMPACT_ON : COMPACT_OFF} ${className}`}
    >
      {subscribed ? <BellOff size={14} strokeWidth={2.5} /> : <Bell size={14} strokeWidth={2.5} />}
    </button>
  )
}
