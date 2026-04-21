/**
 * UJverse design tokens — jedyne źródło prawdy dla wyglądu kart / sekcji.
 *
 * Dwa tokeny akcentowe:
 *   - `gold.primary` (#1e293b) — główny akcent Light Mode (tekst, border, interakcje).
 *   - `gold.muted`   (#1e293b) — ikony sekcji i tytuły sekcyjne (spójne z logotypem).
 *   - `gold.bright`  (#e8c84a) — dark-mode highlight (obecny Tailwind `brand-gold-bright`).
 */

export const theme = {
  colors: {
    gold: {
      primary: '#1e293b',
      muted: '#1e293b',
      bright: '#e8c84a',
    },
    surface: {
      /** Zewnętrzna karta — półprzezroczyste czarne szkło. */
      base: 'bg-white dark:bg-zinc-950/50',
      /** Wewnętrzne wiersze (np. pojedyncze ogłoszenie w widgecie). */
      inner: 'bg-slate-50/50 dark:bg-black/40',
      /** Karta-modal / hover (Kołą, klub). */
      card: 'bg-white dark:bg-black/70',
      glass: 'backdrop-blur-md',
    },
    border: {
      base: 'border-zinc-200 dark:border-white/10',
      subtle: 'border-zinc-800',
      gold: 'border-[#1e293b]/45',
      goldStrong: 'border-[#1e293b]/60',
    },
  },
  radius: {
    card: 'rounded-2xl',
    inner: 'rounded-xl',
    pill: 'rounded-full',
  },
  shadow: {
    card: 'shadow-sm dark:shadow-xl',
    /** Delikatna złota aureola pod kartą w hover. */
    goldGlow: 'shadow-[0_0_26px_-14px_rgba(212,175,55,0.55)]',
    /** Mocniejsza poświata dla wariantu premium (oficjalne wydarzenia). */
    premium: 'shadow-[0_0_36px_-14px_rgba(201,162,39,0.25)]',
  },
  transition: {
    base: 'transition-all duration-200',
    colors: 'transition-colors duration-200',
  },
  text: {
    primary: 'text-zinc-900 dark:text-zinc-100',
    muted: 'text-zinc-500 dark:text-zinc-400',
    gold: 'text-[#1e293b]',
    goldMuted: 'text-[#1e293b] dark:text-brand-gold-bright',
    sectionHeader: 'text-[#1e293b] dark:text-brand-gold-bright',
  },
} as const

export type Theme = typeof theme

/**
 * Mapowanie tonu badge/akcentu na klasy Tailwind (spójne dla całego UI).
 * Używane przez BaseCard pills oraz komponenty listujące badges.
 */
export const toneClasses = {
  gold: 'bg-[#1e293b]/10 text-[#1e293b] border-[#1e293b]',
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  neutral: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
} as const
