/**
 * Pasek akcji — navy (#1e293b) w light, złoto (`brand-gold-bright`) w dark (jak reszta projektu).
 */
export const INTERACTION_BAR_ROW = 'flex flex-row items-center gap-x-4'

const tapTransition = { type: 'spring' as const, stiffness: 520, damping: 30 }

export const interactionMotionTap = { whileTap: { scale: 0.97 }, transition: tapTransition }

const iconMuted = 'text-fg-primary/60 dark:text-zinc-400'
const iconHover =
  'hover:text-[#1e293b] hover:bg-[#1e293b]/10 dark:hover:text-brand-gold-bright dark:hover:bg-brand-gold-bright/10'
const svgHover =
  '[&_svg]:transition-colors [&_svg]:group-hover:text-[#1e293b] dark:[&_svg]:group-hover:text-brand-gold-bright'

/** Komentarz / odpowiedź — jak Heart, bez tła wydziałowego */
export function secondaryInteractionButtonClass(isActive: boolean): string {
  return [
    'group inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-2.5 py-2 transition-colors',
    isActive
      ? 'text-[#1e293b] bg-[#1e293b]/10 dark:text-brand-gold-bright dark:bg-brand-gold-bright/12'
      : [iconMuted, iconHover, svgHover].join(' '),
  ].join(' ')
}

export function likeActionButtonClass(isLiked: boolean): string {
  return [
    'group relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-2.5 py-2 transition-colors disabled:opacity-50',
    isLiked
      ? 'text-[#1e293b] bg-[#1e293b]/10 dark:text-brand-gold-bright dark:bg-brand-gold-bright/12'
      : [iconMuted, iconHover, svgHover].join(' '),
  ].join(' ')
}

/** Wypełnione serce — ten sam akcent co przycisk komentarza w stanie aktywnym */
export const heartLikedIconClass =
  'transition-colors shrink-0 fill-[#1e293b] stroke-[#1e293b] dark:fill-brand-gold-bright dark:stroke-brand-gold-bright'

export const shareActionButtonClass =
  `ml-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 ${iconMuted} ${iconHover} transition-colors`

/** Badge WFz przy nicku — navy + border w light, złoty tekst/border w dark */
export const DEPT_BADGE_SPAN_CLASS =
  'shrink-0 inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full leading-none border border-[#1e293b] text-[#1e293b] bg-[#1e293b]/[0.08] dark:border-brand-gold-bright/40 dark:text-brand-gold-bright dark:bg-brand-gold/10'
