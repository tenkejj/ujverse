import { theme } from '../styles/theme'

/**
 * Wspólny wygląd lewej i prawej kolumny feedu (Komunikaty, Niezbędnik, Wydarzenia).
 */

export const widgetGoldCls = 'text-[#1e293b] dark:text-brand-gold-bright'

/** Kontener przewijanej kolumny bocznej — szkło pod kartami (bez ciężkiego „bloku”). */
export const sideAsideTrackCls =
  'bg-white/[0.07] backdrop-blur-md dark:bg-black/30 dark:backdrop-blur-md'

/**
 * Wspólny zestaw glass (dark): półprzezroczyste tło + blur + jasna krawędź + uniesienie.
 * Używany przez karty sekcji i wewnętrzne wiersze — jedna seria wizualna.
 */
const sideGlassLight =
  'border border-zinc-200 bg-white/70 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/50 dark:shadow-xl dark:backdrop-blur-md'

const sideGlassInnerLight =
  'border border-zinc-200 bg-white/70 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-black/40 dark:shadow-xl dark:backdrop-blur-md'

/** Zewnętrzna karta sekcji (Komunikaty / Niezbędnik / Wydarzenia). */
export const sideCardCls = `rounded-2xl p-4 min-h-0 ${sideGlassLight}`

/** Wewnętrzne wiersze: linki, skróty wydarzeń, pojedyncze ogłoszenie. */
export const sideInnerRowCls = `rounded-2xl p-3 min-h-0 ${sideGlassInnerLight}`

export const sidePanelHoverFocus =
  'hover:bg-black/[0.04] dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/35 dark:focus-visible:ring-brand-gold/35'

export const sectionTitleCls =
  `font-bold text-[10px] uppercase tracking-[0.2em] ${theme.text.sectionHeader}`

export const sideMutedCls = 'text-logo-navy/60 dark:text-slate-400'

export const sideMutedLinkCls =
  'text-logo-navy/60 dark:text-slate-300 group-hover:text-[#1e293b] dark:group-hover:text-brand-gold-bright'

/** Tekstowy link w nagłówku karty (bez otaczającego `group`). */
export const sideHeaderLinkCls =
  'text-logo-navy/60 dark:text-slate-300 hover:text-[#1e293b] dark:hover:text-brand-gold-bright'
