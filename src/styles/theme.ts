/**
 * UJverse design tokens — jedyne źródło prawdy dla wyglądu kart / sekcji.
 *
 * Dwa tokeny akcentowe:
 *   - `gold.primary` — atrament UI (`brand-ink`: navy / błękit UJ / …).
 *   - `gold.bright`  (#e8c84a) — dark-mode highlight (`brand-gold-bright`).
 */

export const theme = {
  colors: {
    gold: {
      /** Domyślny light; runtime bierze `var(--brand-ink)`. */
      primary: '#1e293b',
      muted: '#1e293b',
      bright: '#e8c84a',
    },
    surface: {
      /** Zewnętrzna karta — półprzezroczyste czarne szkło. */
      base: 'bg-white dark:bg-zinc-950/50',
      /** Wewnętrzne wiersze (np. pojedyncze ogłoszenie w widgecie). */
      inner: 'bg-zinc-50/50 dark:bg-black/40',
      /** Karta-modal / hover (Kołą, klub). */
      card: 'bg-white dark:bg-black/70',
      glass: 'backdrop-blur-md',
    },
    border: {
      base: 'border-zinc-200 dark:border-white/10',
      subtle: 'border-zinc-800',
      gold: 'border-brand-ink/45',
      goldStrong: 'border-brand-ink/60',
    },
  },
  radius: {
    card: 'rounded-2xl',
    inner: 'rounded-xl',
    pill: 'rounded-full',
  },
  shadow: {
    card: 'shadow-sm dark:shadow-xl',
    /**
     * Aureola pod kartą w hover — kolor systemowy:
     *   - light: subtelny granat (`rgba(15,23,42,0.22)`),
     *   - dark:  złoty hint (`rgba(212,175,55,0.55)`).
     * Zastąpiła wcześniejszy „goldGlow" który leciał w obu trybach.
     */
    cardGlow:
      'shadow-[0_0_26px_-14px_rgba(15,23,42,0.22)] ' +
      'dark:shadow-[0_0_26px_-14px_rgba(212,175,55,0.55)]',
    /** Alias deprecated — zostawiony dla wstecznej kompatybilności (mapuje na `cardGlow`). */
    goldGlow:
      'shadow-[0_0_26px_-14px_rgba(15,23,42,0.22)] ' +
      'dark:shadow-[0_0_26px_-14px_rgba(212,175,55,0.55)]',
    /**
     * Mocniejsza poświata dla wariantu premium (oficjalne wydarzenia).
     *   - light: subtelna navy aureola,
     *   - dark:  ciepły złoty.
     */
    premium:
      'shadow-[0_0_36px_-14px_rgba(15,23,42,0.18)] ' +
      'dark:shadow-[0_0_36px_-14px_rgba(201,162,39,0.25)]',
  },
  transition: {
    base: '',
    colors: '',
  },
  text: {
    primary: 'text-zinc-900 dark:text-zinc-100',
    muted: 'text-zinc-500 dark:text-zinc-400',
    gold: 'text-brand-ink',
    goldMuted: 'text-brand-ink dark:text-brand-gold-bright',
    sectionHeader: 'text-brand-ink dark:text-brand-gold-bright',
  },
  button: {
    /**
     * Wypełniony CTA – jedyne źródło prawdy dla „głównej akcji" w kartach,
     * modalach i karuzelach (RSVP, „Otwórz w portalu UJ", „Zapisz").
     * Light: navy fill, biały tekst. Dark: brand-gold fill, czarny tekst.
     */
    primary:
      'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-ink text-white ' +
      'font-bold transition-colors hover:bg-brand-ink/90 ' +
      'dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85',
    /**
     * Obrysowany CTA – „akcja drugorzędna" (Udostępnij, Anuluj, „Bierzesz udział").
     */
    outline:
      'inline-flex items-center justify-center gap-2 rounded-xl border bg-transparent ' +
      'border-brand-ink/45 text-brand-ink font-semibold transition-colors hover:bg-brand-ink/5 ' +
      'dark:border-brand-gold/45 dark:text-brand-gold-bright dark:hover:bg-brand-gold/10',
    /**
     * Pływający przycisk-ikona nad plakatem (modal toolbar, hero karuzela).
     * Symetryczny: jasne tło na jasnym layoucie, ciemne na ciemnym.
     */
    floatingIcon:
      'inline-flex items-center justify-center rounded-full p-2 backdrop-blur-sm transition-colors ' +
      'border border-brand-ink/25 bg-white/75 text-brand-ink hover:bg-white/95 ' +
      'dark:border-brand-gold/35 dark:bg-black/40 dark:text-brand-gold-bright dark:hover:bg-black/55',
    floatingIconDanger:
      'inline-flex items-center justify-center rounded-full p-2 backdrop-blur-sm transition-colors ' +
      'border border-red-500/35 bg-white/75 text-red-600 hover:bg-white/95 ' +
      'dark:border-red-500/45 dark:bg-black/40 dark:text-red-400 dark:hover:bg-black/55 dark:hover:text-red-300',
  },
} as const

export type Theme = typeof theme

/**
 * Mapowanie tonu badge/akcentu na klasy Tailwind (spójne dla całego UI).
 * Używane przez BaseCard pills oraz komponenty listujące badges.
 */
export const toneClasses = {
  gold: 'bg-brand-ink/10 text-brand-ink border-brand-ink',
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  neutral: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
} as const
