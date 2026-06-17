export const ICONS_MOBILE = {
  touchTargetClass: 'min-w-[40px] min-h-[40px]',
  touchTargetDesktopResetClass: 'md:min-w-0 md:min-h-0',
  strongStrokeClass: 'stroke-[2.5] md:stroke-2',
  headerThemeToggleSize: 26,
  headerThemeToggleStrokeWidth: 2,
  searchTriggerSize: 26,
  searchDesktopTriggerSize: 20,
  searchInputIconSize: 18,
  searchInputIconStrokeWidth: 2,
  searchBackIconSize: 24,
  searchBackIconStrokeWidth: 2.25,
  searchSectionIconSize: 14,
  searchSectionIconStrokeWidth: 2.25,
  searchResultIconSize: 18,
  searchResultIconStrokeWidth: 2,
  composePlusIconSize: 26,
  composePlusIconStrokeWidth: 1,
  bottomNavIconSize: 28,
  bottomNavActiveStrokeWidth: 2.35,
  bottomNavInactiveStrokeWidth: 1.85,
} as const

export const HEADER_MOBILE = {
  containerClass:
    'relative h-14 md:h-16 gap-2 px-4 flex items-center justify-between shrink-0 ' +
    'sticky top-0 z-50 lg:fixed lg:left-72 lg:right-0',
  sideSectionClass: 'w-[100px] min-w-[100px] md:w-24 md:min-w-24',
  rightSectionClass:
    'flex-shrink-0 flex items-center justify-end gap-2 md:gap-3 relative z-10 ml-auto min-w-0',
  /**
   * Desktop: header = `left-72..right-0`, treść ma `lg:-ml-36` — oś feedu to
   * środek viewportu, czyli `50%` paska minus połowa sidebara (`9rem`).
   */
  logoAnchorClass:
    'pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 ' +
    'left-1/2 -translate-x-1/2 lg:left-[calc(50%-9rem)] lg:-translate-x-1/2',
  logoClass:
    'h-32 w-32 sm:w-40 md:w-48 scale-[0.85] translate-y-[2.25px] translate-x-[1.75px] md:translate-x-0',
  themeToggleButtonClass:
    'shrink-0 min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center rounded-full p-2',
  userMenuButtonClass:
    'group flex items-center gap-2 rounded-full pl-1 pr-1 py-1 min-h-[40px] min-w-[40px] md:min-h-0 md:min-w-0 md:pl-1.5 md:pr-2 md:py-1',
  userAvatarClass: 'h-9 w-9',
  userAvatarTextSize: 'text-xs',
  userNameMaxWidthClass: 'max-w-[100px]',
  userDepartmentBadgeClass: 'text-[9px] px-1.5 py-0.5',
} as const

export const SEARCH_MOBILE = {
  triggerButtonClass:
    'md:hidden min-w-[40px] min-h-[40px] w-9 h-9 flex items-center justify-center rounded-full text-zinc-500 dark:text-gray-400 hover:text-[#1e293b] dark:hover:text-brand-gold-bright hover:bg-black/5 dark:hover:bg-white/10 transition-colors',
  backButtonClass:
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#1e293b] transition-colors duration-200 hover:bg-black/[0.06] dark:text-brand-gold-bright dark:hover:bg-white/[0.06] [-webkit-tap-highlight-color:transparent]',
  mobileOverlayClass: 'fixed inset-0 z-[200] md:hidden flex flex-col bg-bg-app/95',
  mobileOverlayContainerClass:
    'relative flex w-full max-w-full overflow-x-clip flex-1 min-h-0 flex-col px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]',
  mobileHeaderRowClass: 'mb-5 flex shrink-0 items-center gap-2',
  mobilePillsWrapperClass:
    'mb-6 w-full min-w-0 max-w-full shrink-0 overflow-x-clip border-b border-border-app dark:border-white/10',
  mobilePillsNavClass:
    'relative flex w-full min-w-0 max-w-full gap-0.5 overflow-x-auto overscroll-x-contain px-2 scrollbar-none [-webkit-overflow-scrolling:touch]',
  mobilePillTabBaseClass:
    'relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors duration-200 border-b-2 border-transparent -mb-px [-webkit-tap-highlight-color:transparent]',
  mobilePillIndicatorClass: 'absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#1e293b] dark:bg-brand-gold-bright',
  mobileInputClass:
    'ujverse-search-input relative z-[1] h-12 w-full rounded-2xl border border-[#0f172a]/10 bg-black/[0.06] pl-11 pr-3 text-[16px] text-logo-navy shadow-none outline-none ring-0 transition-[border-color] duration-150 ease-in-out placeholder:text-fg-secondary focus:border-[#0f172a]/20 focus:ring-0 dark:border-white/10 dark:bg-black/40 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-white/25 caret-[#1e293b] dark:caret-brand-gold-bright',
  mobileResultsScrollClass: 'flex-1 overflow-y-auto overscroll-contain min-h-0 -mx-1',
  mobileHistorySectionClass: 'mx-auto w-full max-w-5xl px-1 pb-6',
  mobileResultsWrapperClass: 'px-1 pb-6',
  mobileResults: {
    searchingClass: 'flex items-center gap-2.5 px-4 py-4 text-[13px]',
    shortHintClass: 'px-4 py-3 text-[12px]',
    emptyClass: 'px-4 py-5 text-center text-[13px]',
    sectionWrapperClass: 'px-2 pt-2',
    sectionSecondaryWrapperClass: 'px-2 pb-2',
    sectionTitleClass: 'flex items-center gap-2 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest',
    rowClass:
      'w-full flex items-center gap-3 py-2.5 px-1 rounded-xl cursor-pointer text-left transition-colors duration-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] active:bg-black/[0.06] dark:active:bg-white/[0.07]',
    tapScale: 0.985,
    bottomSpacerClass: 'h-1',
  },
  motion: {
    springContent: { type: 'spring' as const, stiffness: 300, damping: 30 },
    overlayEntry: { duration: 0.4, ease: 'easeOut' as const },
    staggerContainer: { hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } } },
    historyStaggerContainer: { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0 } } },
  },
} as const

/**
 * AUTH_MOBILE — Linear spotlight auth (UJverse palette).
 *
 * Widoczny stożek światła (blobs + vignette), nowoczesne pola, bez „karty szkła”.
 */
export const AUTH_MOBILE = {
  mesh: {
    wrapperClass: 'pointer-events-none fixed inset-0 overflow-hidden',
    /** Miękki kamień — bez ostrej kości słoniowej / żółtego kremu. */
    baseLightClass:
      'absolute inset-0 dark:hidden ' +
      'bg-[linear-gradient(165deg,#f0eeeb_0%,#e6e2dc_45%,#d8d3cb_100%)]',
    ambientLightClass:
      'absolute inset-0 dark:hidden ' +
      'bg-[radial-gradient(ellipse_90%_60%_at_50%_-8%,rgba(245,243,240,0.75)_0%,transparent_58%)]',
    floorWashLightClass:
      'absolute inset-x-0 bottom-0 h-[50vh] dark:hidden ' +
      'bg-[linear-gradient(to_top,rgba(164,137,85,0.07)_0%,rgba(164,137,85,0.02)_35%,transparent_72%)]',
    baseDarkClass: 'absolute inset-0 hidden bg-[#030303] dark:block',
    vignetteLightClass:
      'absolute inset-0 dark:hidden ' +
      'bg-[radial-gradient(ellipse_130%_92%_at_50%_0%,transparent_36%,rgba(30,41,59,0.2)_100%)]',
    vignetteDarkClass:
      'absolute inset-0 hidden dark:block ' +
      'bg-[radial-gradient(ellipse_120%_85%_at_50%_0%,transparent_38%,rgba(0,0,0,0.88)_100%)]',
  },
  spotlight: {
    /** Pełna szerokość viewportu — stożek z góry ekranu, bez capów w rem na desktopie. */
    orbPrimaryLightClass:
      'absolute left-1/2 top-[-8%] h-[min(78vh,42rem)] w-[100vw] max-w-none -translate-x-1/2 rounded-[100%] ' +
      'bg-[radial-gradient(ellipse_100%_88%_at_50%_0%,rgba(248,246,243,0.92)_0%,rgba(240,237,232,0.45)_38%,transparent_68%)] ' +
      'blur-2xl dark:hidden',
    orbPrimaryDarkClass:
      'absolute left-1/2 top-[-10%] hidden h-[min(80vh,44rem)] w-[100vw] max-w-none -translate-x-1/2 rounded-[100%] ' +
      'bg-[radial-gradient(ellipse_100%_88%_at_50%_0%,rgba(255,255,255,0.24)_0%,rgba(255,255,255,0.09)_40%,transparent_70%)] ' +
      'blur-3xl dark:block',
    orbGoldLightClass:
      'absolute left-1/2 top-[-4%] h-[min(52vh,26rem)] w-[100vw] max-w-none -translate-x-1/2 rounded-[100%] ' +
      'bg-[radial-gradient(ellipse_100%_80%_at_50%_0%,rgba(164,137,85,0.22)_0%,rgba(180,155,110,0.08)_32%,transparent_68%)] blur-3xl dark:hidden',
    orbGoldDarkClass:
      'absolute left-1/2 top-[-6%] hidden h-[min(54vh,28rem)] w-[100vw] max-w-none -translate-x-1/2 rounded-[100%] ' +
      'bg-[radial-gradient(ellipse_100%_80%_at_50%_0%,rgba(232,200,74,0.1)_0%,transparent_68%)] blur-3xl dark:block',
    orbNavyLightClass:
      'absolute left-1/2 top-[6%] h-[min(38vh,18rem)] w-[100vw] max-w-none -translate-x-1/2 rounded-[100%] ' +
      'bg-[radial-gradient(ellipse_100%_75%_at_50%_0%,rgba(30,41,59,0.14)_0%,transparent_72%)] blur-2xl dark:hidden',
  },
  panel: {
    className:
      'rounded-2xl border p-6 sm:p-7 ' +
      'border-white/60 bg-white/62 backdrop-blur-2xl backdrop-saturate-150 ' +
      'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_28px_72px_-30px_rgba(30,41,59,0.22),0_10px_28px_-14px_rgba(164,137,85,0.12)] ' +
      'ring-1 ring-[#1e293b]/[0.05] ' +
      'dark:border-white/10 dark:bg-zinc-950/88 dark:backdrop-blur-none dark:ring-0 ' +
      'dark:shadow-[0_20px_60px_-28px_rgba(0,0,0,0.75)]',
  },
  shell: {
    pageClass:
      'relative flex min-h-dvh flex-col items-center justify-start overflow-x-hidden overflow-y-auto ' +
      'px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),2rem)] ' +
      'sm:justify-center sm:px-6 sm:py-[max(env(safe-area-inset-top),1rem)] sm:pb-[max(env(safe-area-inset-bottom),1.5rem)]',
    columnClass: 'relative z-10 flex w-full max-w-[22rem] flex-col items-center text-center sm:max-w-md md:max-w-lg',
    themeToggleClass:
      'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border p-2 ' +
      'border-white/70 bg-white/55 text-zinc-600 shadow-[0_4px_16px_-8px_rgba(30,41,59,0.18)] backdrop-blur-xl ' +
      'transition-colors hover:bg-white/85 hover:text-[#1e293b] ' +
      'dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70 dark:shadow-none dark:hover:bg-white/10 dark:hover:text-white',
  },
  logo: {
    /** Przycięty asset tylko na auth — bez pustego paddingu z logo.png (728×1372). */
    assetPath: '/logo-auth.png',
    markClass:
      'mb-6 h-[4.75rem] w-auto max-w-[min(80vw,18rem)] shrink-0 drop-shadow-[0_6px_18px_rgba(30,41,59,0.12)] ' +
      'sm:mb-7 sm:h-[6rem] sm:max-w-[20rem] md:h-[6.5rem] md:max-w-[22rem] ' +
      'aspect-[542/607] bg-logo-navy dark:bg-brand-gold-bright dark:drop-shadow-[0_4px_20px_rgba(232,200,74,0.25)] transition-colors duration-150 ease-in-out',
  },
  header: {
    titleClass:
      'text-[1.65rem] font-semibold leading-tight tracking-tight text-[#1e293b] dark:text-white sm:text-3xl',
    subtitleClass: 'mt-3 text-sm leading-relaxed text-[#6b6560] dark:text-white/50 sm:mt-3.5',
    blockClass: 'mb-7 w-full text-center sm:mb-8',
  },
  tabs: {
    rowClass:
      'mb-7 grid w-full grid-cols-2 gap-1.5 rounded-xl border p-1.5 ' +
      'border-white/55 bg-white/38 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8),0_2px_10px_-6px_rgba(30,41,59,0.08)] backdrop-blur-sm ' +
      'dark:border-white/10 dark:bg-black/40 dark:shadow-none sm:mb-8',
    tabClass:
      'relative rounded-lg px-3 py-3 text-sm font-semibold transition-colors focus:outline-none min-h-[48px]',
    tabActiveClass: 'text-white dark:text-[#1e293b]',
    tabInactiveClass:
      'text-zinc-600 hover:text-zinc-900 dark:text-white/50 dark:hover:text-white/80',
    pillClass:
      'absolute inset-0 rounded-lg bg-gradient-to-b from-[#2a3a52] to-[#1e293b] ' +
      'shadow-[0_2px_12px_-4px_rgba(30,41,59,0.35)] ' +
      'dark:bg-brand-gold-bright dark:from-brand-gold-bright dark:to-brand-gold-bright dark:shadow-[0_2px_12px_-4px_rgba(232,200,74,0.5)]',
    layoutId: 'auth-tab-pill',
  },
  input: {
    baseClass:
      'w-full rounded-xl border px-4 py-3.5 text-base text-zinc-900 ' +
      'placeholder:text-zinc-400 outline-none transition-all duration-200 ' +
      'border-white/70 bg-white/88 shadow-[inset_0_1px_2px_0_rgba(30,41,59,0.04)] ' +
      'focus:border-[#a48955]/35 focus:ring-2 focus:ring-[#a48955]/10 focus:bg-white focus:shadow-[0_0_0_3px_rgba(164,137,85,0.06)] ' +
      'caret-[#1e293b] ' +
      'dark:border-white/12 dark:bg-zinc-900/80 dark:text-white dark:shadow-none ' +
      'dark:placeholder:text-white/35 dark:focus:border-brand-gold-bright/50 ' +
      'dark:focus:ring-brand-gold-bright/15 dark:focus:bg-white/[0.08] dark:caret-brand-gold-bright',
    iconClass:
      'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/40',
    labelClass: 'mb-2 block text-[13px] font-medium text-zinc-600 dark:text-white/55',
    fieldGroupClass: 'mb-6',
  },
  button: {
    primary:
      'group inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 ' +
      'text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 ' +
      'bg-gradient-to-b from-[#2a3a52] to-[#1e293b] text-white ' +
      'shadow-[0_6px_22px_-8px_rgba(30,41,59,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1)] ' +
      'hover:from-[#32445f] hover:to-[#172033] active:scale-[0.99] ' +
      'dark:bg-brand-gold-bright dark:from-brand-gold-bright dark:to-brand-gold-bright dark:text-[#1e293b] ' +
      'dark:shadow-[0_4px_20px_-6px_rgba(232,200,74,0.55)] dark:hover:from-[#f0d050] dark:hover:to-[#f0d050]',
    oauth:
      'group inline-flex w-full items-center justify-center gap-2.5 rounded-xl border py-3.5 ' +
      'text-sm font-medium transition-all duration-200 ' +
      'border-white/60 bg-white/50 text-zinc-800 shadow-[0_2px_12px_-6px_rgba(30,41,59,0.1)] backdrop-blur-sm hover:bg-white/75 ' +
      'disabled:cursor-not-allowed disabled:opacity-70 ' +
      'dark:border-white/12 dark:bg-white/[0.04] dark:text-white/85 dark:shadow-none dark:hover:bg-white/[0.08]',
    ghost:
      'text-sm text-zinc-600 underline-offset-4 transition-colors ' +
      'hover:text-[#1e293b] hover:underline ' +
      'dark:text-white/50 dark:hover:text-brand-gold-bright',
    ghostStrong:
      'font-semibold text-[#1e293b] underline-offset-4 transition-colors hover:underline ' +
      'dark:text-brand-gold-bright',
    forgotClass:
      'shrink-0 text-xs font-medium text-zinc-500 transition-colors hover:text-[#1e293b] ' +
      'dark:text-white/50 dark:hover:text-brand-gold-bright',
    showPasswordClass:
      'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 min-h-[40px] min-w-[40px] ' +
      'flex items-center justify-center text-zinc-400 transition-colors hover:text-[#1e293b] ' +
      'dark:text-white/40 dark:hover:text-brand-gold-bright',
  },
  divider: {
    wrapperClass:
      'my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-[#7a7164] dark:text-white/38 sm:my-7',
    lineClass:
      'h-px flex-1 bg-gradient-to-r from-transparent via-[#1e293b]/12 to-transparent dark:via-white/10',
  },
  footer: {
    primaryClass: 'mt-10 text-center text-[11px] text-zinc-500 dark:text-white/38 sm:mt-12 sm:text-xs',
    secondaryClass:
      'mt-1 text-center text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-white/30 sm:text-[11px]',
  },
  motion: {
    entry: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
    segmentSpring: { type: 'spring' as const, damping: 28, stiffness: 380 },
    formTransition: { duration: 0.18 },
  },
} as const

/**
 * PROFILE_MOBILE — jedyne źródło wymiarów/animacji dla strony profilu.
 *
 * Centralizuje: wymiary cover / awatara / marginesów, klasy szklanej karty,
 * tokeny tabbara z animowanym indikatorem, pozycję Floating Action Button
 * oraz warianty Framer Motion dla sekwencyjnego wejścia hero.
 *
 * Symetria "pixel-perfect" opiera się na CSS variable `--profile-avatar-size`
 * wstrzykiwanym w root hero — breakpoint switching realizowany przez
 * `<style>` injection w ProfileHero (zero re-renderów na resize).
 */
export const PROFILE_MOBILE = {
  cover: {
    heightClass: 'h-44 sm:h-52 lg:h-64',
    radiusClass: 'rounded-t-3xl',
    gradientOverlayClass:
      'pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/45 dark:to-black/60',
  },
  avatar: {
    sizePx: { base: 104, sm: 120, lg: 144 } as const,
    ringClass: 'ring-4 ring-[var(--bg-app)] dark:ring-[#09090b]',
    radiusClass: 'rounded-full',
  },
  card: {
    glassLight:
      'border border-zinc-900/10 bg-white/75 shadow-[0_30px_80px_-40px_rgba(24,24,27,0.35)]',
    glassDark:
      'dark:border-white/10 dark:bg-[#09090b]/70 dark:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]',
    glassClass:
      'relative overflow-hidden rounded-3xl border border-zinc-900/10 bg-white/75 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_30px_80px_-40px_rgba(24,24,27,0.35)] dark:border-white/10 dark:bg-[#09090b]/70 dark:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]',
    paddingXClass: 'px-4 sm:px-6 lg:px-8',
  },
  tabs: {
    rowClass:
      'relative flex gap-1 border-b border-zinc-900/10 dark:border-white/10',
    tabBaseClass:
      'relative flex-1 px-2 py-3 text-[13px] sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700/25 dark:focus-visible:ring-white/25 rounded-t-md',
    tabActiveClass: 'text-zinc-900 dark:text-white',
    tabInactiveClass:
      'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
    indicatorClass:
      'absolute -bottom-px left-2 right-2 h-[2px] rounded-full bg-zinc-800 dark:bg-brand-gold-bright',
    indicatorLayoutId: 'profile-tab-indicator',
  },
  fab: {
    wrapperClass:
      'fixed right-4 z-40 md:hidden bottom-[calc(4.75rem+env(safe-area-inset-bottom))]',
    buttonClass:
      'flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-zinc-900 text-white shadow-[0_14px_40px_-10px_rgba(24,24,27,0.35)] backdrop-blur-xl transition-transform active:scale-95 dark:bg-brand-gold-bright dark:text-zinc-900 dark:shadow-[0_14px_40px_-10px_rgba(232,200,74,0.45)]',
    layoutId: 'profile-edit-action',
    scrollActivateAt: 280,
  },
  badgeDock: {
    wrapperDesktopClass:
      'hidden sm:flex absolute right-4 sm:right-6 z-30 gap-2',
    wrapperMobileClass: 'sm:hidden flex flex-wrap gap-1.5',
    itemClass:
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none backdrop-blur-xl transition-colors',
    itemLightClass:
      'border-white/50 bg-white/70 text-zinc-900 shadow-[0_8px_24px_-16px_rgba(24,24,27,0.45)]',
    itemDarkClass:
      'dark:border-white/15 dark:bg-white/8 dark:text-white dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)]',
  },
  actionButton: {
    inlineClass:
      'inline-flex items-center justify-center gap-2 rounded-full border border-zinc-900/12 bg-white/95 px-4 py-2 text-sm font-semibold text-fg-primary shadow-sm transition-colors hover:border-zinc-700/50 dark:border-white/20 dark:bg-[#09090b]/95 dark:text-white dark:hover:border-brand-gold-bright/45',
  },
  motion: {
    staggerContainer: {
      hidden: {},
      show: {
        transition: { staggerChildren: 0.06, delayChildren: 0.08 },
      },
    },
    fadeUp: {
      hidden: { opacity: 0, y: 12 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
      },
    },
    indicatorSpring: { type: 'spring' as const, stiffness: 420, damping: 38 },
    tabPanel: {
      initial: { opacity: 0, y: 6 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -4 },
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
  },
} as const

/**
 * OMNI_DESKTOP — tokeny dla OmniSearchHub v2 (desktop md:+).
 *
 * Glassmorphizm panelu dropdowna: jasny tryb mleczna kapsuła `bg-white/95`,
 * dark tryb głęboki gradient `bg-black/80` + złoty akcent `brand-gold-bright`.
 *
 * Wszystkie wiersze wyników korzystają z `rowBase`; podświetlenie aktywnego
 * wiersza (System 2 — klawiatura) używa `rowActive` zamiast samego hovera.
 */
export const OMNI_DESKTOP = {
  // Kapsuła wyszukiwarki: `flex items-center gap-2` w kontenerze; spacing
  // między ikoną, opcjonalnym `modeBadge`, inputem i przyciskiem `X` jest
  // egzekwowane przez `gap-2`, nie przez `mr-*` na dzieciach.
  //
  // Widoczność `hidden xl:flex` (≥ 1280 px): poniżej tego progu prawa
  // strona headera (capsule + 3 przyciski + user-menu) wchodzi w obszar
  // wyśrodkowanego logo. Zamiast capsule pokazujemy wtedy ikonę-lupę
  // w lewej sekcji — patrz `Header.tsx` (`block xl:hidden`). Klik w lupę
  // nawiguje od razu do `/search` (SearchDashboard), bez pośredniego overlaya.
  // Szerokość `w-72 2xl:w-80` (288/320 px) trzyma capsule poza środkiem
  // viewportu przy każdym aktywnym breakpoincie (xl 1280, 2xl 1536).
  //
  // Glassmorphism zachowany: `backdrop-blur-md backdrop-saturate-150` +
  // półprzezroczyste tło (`bg-white/80 dark:bg-bg-card/80`).
  // Light: niższa opacity (55%) + frosted-edge `border-white/55` + inner top highlight
  // (`inset 0 1px 0 rgba(255,255,255,0.7)`) odsłaniają backdrop-blur ponad headerem.
  // Dark: zostaje bez zmian (już dobrze widać glass dzięki `bg-bg-card/80` na ciemnym tle).
  inputCapsuleWrap:
    'relative hidden xl:flex h-10 w-72 2xl:w-80 shrink-0 items-center gap-2 rounded-2xl px-3.5 ' +
    'backdrop-blur-md backdrop-saturate-150 ' +
    'border border-white/55 bg-white/55 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_8px_-3px_rgba(15,23,42,0.1)] ' +
    'transition-colors duration-200 focus-within:border-[#1e293b]/40 ' +
    'dark:border-white/10 dark:bg-bg-card/80 dark:shadow-none dark:focus-within:border-brand-gold-bright/45',
  // Input: `flex-1` rozpycha się na dostępną przestrzeń, `min-w-0` chroni
  // przed wypchnięciem rodzeństwa (ikony / `X`) gdy zawartość rośnie.
  inputInner:
    'h-full w-full min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-500 ' +
    'caret-[#1e293b] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:caret-brand-gold-bright',
  // Ikona: `shrink-0` (`flex-shrink-0`) + `size-5` (`w-5 h-5` = 1.25 rem).
  // Brak `mr-*` — odstęp daje `gap-2` rodzica.
  inputLeadingIcon:
    'shrink-0 size-5 text-[#1e293b] dark:text-zinc-400',
  modeBadge:
    'inline-flex shrink-0 items-center gap-1 rounded-md border border-[#1e293b]/30 bg-[#1e293b]/10 px-1.5 py-0.5 ' +
    'text-[10px] font-bold uppercase tracking-wider text-[#1e293b] ' +
    'dark:border-brand-gold-bright/40 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright',
  // Light: dropdown jest nad treścią feedu (nie nad blurred-headerem), więc opacity 65 % +
  // `backdrop-blur-2xl` realnie odsłania kolory karty pod spodem. Frosted-edge robi
  // `border-white/60` i inner top highlight w `shadow-[…inset…]`.
  // Dark: zachowane oryginalne tokeny, tylko shadow rozdzielony na własną drop-shadow,
  // żeby nadpisanie z light nie wycięło efektu floatingu w trybie ciemnym.
  panel:
    'absolute right-0 top-[calc(100%+0.5rem)] z-[120] w-[min(28rem,calc(100vw-2rem))] ' +
    'origin-top-right overflow-hidden rounded-2xl ' +
    'border border-white/60 bg-white/65 ring-1 ring-zinc-900/[0.04] ' +
    'shadow-[0_24px_60px_-20px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.85)] ' +
    'backdrop-blur-2xl backdrop-saturate-150 ' +
    'dark:border-white/10 dark:bg-black/80 dark:ring-white/[0.06] ' +
    'dark:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]',
  panelInner: 'max-h-[min(70vh,560px)] overflow-y-auto overflow-x-hidden overscroll-contain',
  sectionHeader:
    'flex items-center gap-2 px-4 pt-3 pb-1.5 ' +
    'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-brand-gold-bright',
  sectionDivider: 'mx-3 border-t border-zinc-200/70 dark:border-white/10',
  sectionIcon: 'shrink-0 text-[#1e293b] dark:text-brand-gold-bright',
  sectionBody: 'px-1 pb-1',
  rowBase:
    'flex w-full items-center gap-3 mx-2 px-2 py-2 rounded-xl cursor-pointer text-left ' +
    'transition-colors duration-150',
  rowHover:
    'hover:bg-zinc-100/80 active:bg-zinc-200/70 ' +
    'dark:hover:bg-white/[0.06] dark:active:bg-white/[0.08]',
  rowActive:
    'bg-zinc-100/90 ring-1 ring-inset ring-[#1e293b]/25 ' +
    'dark:bg-brand-gold/10 dark:ring-brand-gold-bright/35',
  rowAvatar:
    'h-8 w-8 shrink-0 ring-2 ring-[#1e293b]/20 dark:ring-brand-gold/30',
  rowIconBubble:
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full ' +
    'border border-[#1e293b]/15 bg-[#1e293b]/[0.06] text-[#1e293b] ' +
    'dark:border-brand-gold/30 dark:bg-brand-gold/10 dark:text-brand-gold-bright',
  rowTitle: 'block truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100',
  rowMeta: 'block truncate text-xs text-zinc-500 dark:text-slate-400',
  rowSnippet: 'block line-clamp-2 text-sm text-zinc-700 dark:text-slate-300',
  recentRow:
    'group flex items-center gap-2 px-3 py-2 mx-2 rounded-xl ' +
    'hover:bg-zinc-100/80 dark:hover:bg-white/[0.05]',
  recentClock: 'shrink-0 text-zinc-400 dark:text-zinc-500',
  recentText:
    'flex-1 min-w-0 truncate text-left text-sm text-zinc-700 dark:text-zinc-200 [-webkit-tap-highlight-color:transparent]',
  recentRemove:
    'shrink-0 rounded-md p-1.5 text-zinc-400 opacity-0 group-hover:opacity-100 ' +
    'transition-opacity hover:text-zinc-600 hover:bg-zinc-100 ' +
    'dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/5',
  hintsHeader:
    'flex items-center gap-2 px-4 pt-3 pb-2 ' +
    'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-brand-gold-bright',
  hintsWrap: 'flex flex-wrap gap-2 px-4 pb-3',
  hintChip:
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ' +
    'text-xs font-medium transition-colors ' +
    'border-zinc-200 bg-white/70 text-zinc-700 ' +
    'hover:border-[#1e293b]/35 hover:bg-zinc-100 ' +
    'dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-200 ' +
    'dark:hover:border-brand-gold-bright/45 dark:hover:bg-brand-gold-bright/10',
  hintIcon: 'shrink-0 text-[#1e293b] dark:text-brand-gold-bright',
  emptyMessage:
    'px-4 py-5 text-center text-[13px] text-slate-500 dark:text-slate-400',
  loadingRow:
    'flex items-center justify-center gap-2.5 px-4 py-6 text-[13px] text-slate-500 dark:text-slate-400',
  footer:
    'sticky bottom-0 flex items-center justify-center border-t border-zinc-200/80 ' +
    'bg-zinc-50/90 px-4 py-3.5 backdrop-blur-md cursor-pointer transition-colors ' +
    'hover:bg-zinc-100 dark:border-white/10 dark:bg-black/90 dark:hover:bg-zinc-900',
  footerLabel:
    'text-sm font-bold text-[#1e293b] dark:text-brand-gold-bright transition-colors ' +
    'hover:text-[#1e293b]/70 dark:hover:text-brand-gold-bright/80',
  motion: {
    panel: {
      initial: { opacity: 0, y: -8, scale: 0.985 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: -6, scale: 0.985 },
      transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
    },
    staggerContainer: {
      hidden: {},
      show: { transition: { staggerChildren: 0.025, delayChildren: 0.02 } },
    },
    staggerItem: {
      hidden: { opacity: 0, y: 6 },
      show: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
      },
    },
  },
} as const

/**
 * SEARCH_DASHBOARD — tokeny dla pustego stanu `SearchPageView` (`activeQuery === ""`).
 *
 * Glass-pulpit z trzema sekcjami: Recent Searches, Quick Scopes, Department Grid.
 * Bazuje na fundamentach z `OMNI_DESKTOP.panel` (deep glass) i `PROFILE_MOBILE.card`
 * (backdrop-blur-2xl), ale w wersji desktop-first dla strony `/search`.
 *
 * Każdy panel = `panel` + opcjonalnie `panelInteractive` (hover gold + microscale).
 * Inne komponenty (np. SearchBar mobile) NIE używają tych klas — to izolowany namespace.
 */
export const SEARCH_DASHBOARD = {
  panel:
    'relative overflow-hidden rounded-2xl border backdrop-blur-xl backdrop-saturate-150 ' +
    'border-zinc-200/70 bg-white/70 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] ' +
    'dark:border-white/[0.06] dark:bg-zinc-950/40 dark:shadow-[0_25px_70px_-30px_rgba(0,0,0,0.9)]',
  panelInnerGlow:
    'before:pointer-events-none before:absolute before:inset-px before:rounded-[15px] ' +
    'before:bg-gradient-to-b before:from-white/[0.04] before:to-transparent z-20',
  panelInteractive:
    'transition-all duration-300 ease-out ' +
    'hover:scale-[1.01] hover:border-[#1e293b]/35 hover:bg-white/85 ' +
    'dark:hover:border-brand-gold-bright/30 dark:hover:bg-zinc-950/60',
  panelActive:
    'border-[#1e293b]/45 bg-[#1e293b]/[0.05] ' +
    'dark:border-brand-gold-bright/45 dark:bg-brand-gold-bright/[0.06] ' +
    'dark:shadow-[0_0_28px_-10px_rgba(232,200,74,0.35)]',
  sectionTitle:
    'text-[10px] font-bold uppercase tracking-[0.22em] text-[#1e293b] dark:text-brand-gold-bright',
  sectionSubtle:
    'text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 ' +
    'transition-colors hover:text-[#1e293b] dark:hover:text-brand-gold-bright',
  recentChip:
    'group inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 bg-white/55 px-2.5 py-1 ' +
    'text-sm text-zinc-700 backdrop-blur-md transition-all duration-200 ' +
    'hover:border-[#1e293b]/30 hover:bg-white/80 hover:text-[#1e293b] ' +
    'dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 ' +
    'dark:hover:border-brand-gold-bright/35 dark:hover:bg-brand-gold-bright/[0.07] dark:hover:text-brand-gold-bright',
  recentClock:
    'shrink-0 text-zinc-400 dark:text-zinc-500 transition-colors group-hover:text-[#1e293b] dark:group-hover:text-brand-gold-bright',
  recentRemove:
    'shrink-0 rounded-full p-1 text-zinc-400 opacity-0 transition-opacity duration-200 ' +
    'group-hover:opacity-100 focus-visible:opacity-100 hover:text-zinc-700 hover:bg-zinc-100/80 ' +
    'dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/5',
  scopeTile:
    'group relative flex flex-col justify-between gap-3 overflow-hidden rounded-2xl border p-5 text-left ' +
    'border-zinc-200/70 bg-white/60 backdrop-blur-xl backdrop-saturate-150 ' +
    'shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] ' +
    'transition-all duration-300 ease-out hover:scale-[1.01] hover:border-[#1e293b]/35 hover:bg-white/85 ' +
    'dark:border-white/10 dark:bg-zinc-900/40 ' +
    'dark:shadow-[0_22px_80px_-35px_rgba(0,0,0,0.85)] ' +
    'dark:hover:border-brand-gold-bright/40 dark:hover:bg-zinc-900/55 ' +
    'dark:hover:shadow-[0_0_36px_-12px_rgba(232,200,74,0.32)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/40 dark:focus-visible:ring-brand-gold-bright/45',
  scopeIcon:
    'inline-flex h-10 w-10 items-center justify-center rounded-xl ' +
    'bg-[#1e293b]/[0.06] text-[#1e293b] transition-colors ' +
    'group-hover:bg-[#1e293b]/10 ' +
    'dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright dark:group-hover:bg-brand-gold-bright/15',
  scopeTitle: 'text-base font-semibold text-zinc-800 dark:text-zinc-100',
  scopeDescription: 'text-xs text-zinc-500 dark:text-zinc-400',
  deptBadge:
    'group flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/55 px-3.5 py-1.5 ' +
    'text-xs font-semibold text-zinc-700 backdrop-blur-md ' +
    'transition-all duration-200 hover:scale-[1.03] hover:border-[#1e293b]/35 hover:bg-white/80 hover:text-[#1e293b] ' +
    'dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 ' +
    'dark:hover:border-brand-gold-bright/45 dark:hover:bg-brand-gold-bright/10 dark:hover:text-brand-gold-bright ' +
    'dark:hover:shadow-[0_0_18px_-8px_var(--dept-glow,rgba(232,200,74,0.4))] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/40 dark:focus-visible:ring-brand-gold-bright/45',
  deptDot: 'h-2 w-2 shrink-0 rounded-full',
  motion: {
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
    },
    section: {
      hidden: { opacity: 0, y: 12 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
      },
    },
    chipContainer: {
      hidden: {},
      show: { transition: { staggerChildren: 0.018, delayChildren: 0.02 } },
    },
    chip: {
      hidden: { opacity: 0, y: 6 },
      show: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
      },
    },
  },
} as const

/**
 * FILTER_PILL — jednolita pigułka filtra dla całej apki.
 *
 * Używany przez:
 *  - `DepartmentFilter` (skróty wydziałów)
 *  - `EventsView` (Wszystkie / Moje / Oficjalne / kategorie)
 *  - `AnnouncementPills` (mobilny rail komunikatów)
 *
 * Wzorzec: `transparent + border` z akcentem `#1e293b` (light) /
 * `#D4AF37` ≈ `brand-gold-bright` (dark). Active = pogrubienie + accent border.
 */
export const FILTER_PILL = {
  base:
    'shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full text-sm ' +
    'whitespace-nowrap transition-colors duration-150 focus:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-[#1e293b]/30 min-h-[34px] md:min-h-0 border',
  inactive:
    'font-medium bg-transparent border-zinc-200 text-zinc-600 ' +
    'hover:border-zinc-300 hover:text-zinc-700 ' +
    'dark:bg-transparent dark:border-white/10 dark:text-zinc-100 dark:hover:border-white/20',
  active:
    'font-semibold bg-transparent border-[#1e293b] text-[#1e293b] ' +
    'dark:text-[#D4AF37] dark:border-[#D4AF37]',
} as const

/**
 * EVENTS_TOOLBAR — pasek nad siatką wydarzeń.
 *
 * Search input celowo używa dokładnie tej samej kapsuły co `OMNI_DESKTOP`,
 * żeby „wydarzenia" wizualnie współgrały z headerową paletą wyszukiwania.
 */
/**
 * EVENTS_HUB — tokeny dla nowego "hub" layoutu strony /wydarzenia.
 *
 * Zastępuje wcześniejszy "długa siatka kart" jednorodnym multi-sekcyjnym
 * widokiem (Hero + sekcje datowe + side-rail). Bazuje na tym samym języku
 * wizualnym co `OMNI_DESKTOP` (deep glass, gold akcent w dark, navy w light)
 * i `SEARCH_DASHBOARD` (panele z hover scale + ring).
 *
 * Komponenty konsumujące:
 *  - `EventsView` (orkiestracja)
 *  - `EventsHero` (spotlight najbliższego)
 *  - `EventsSideRail` (live / stats / quick filters w aside)
 *  - `EventsEmptyState` (no-results / no-data fallback)
 */
export const EVENTS_HUB = {
  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    /** Cała karta hero. Wariant premium glass z gradientem + ring. */
    cardClass:
      'relative overflow-hidden rounded-3xl border ' +
      'border-zinc-200/80 bg-white/85 backdrop-blur-2xl backdrop-saturate-150 ' +
      'shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] ring-1 ring-zinc-900/5 ' +
      'dark:border-white/10 dark:bg-zinc-950/55 ' +
      'dark:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] dark:ring-white/[0.04]',
    /**
     * Grid: image + meta. Proporcje są szersze dla plakatu na szerszych ekranach,
     * żeby wykorzystać dodatkową przestrzeń na widescreen (po rozszerzeniu layoutu).
     *  - md:  3:2 (poster | meta)
     *  - xl:  7:5 (plakat dostaje znaczącą przewagę przy 1280+)
     *  - cap: `max-h-[420px]` żeby hero nie wybijał się skyscraperem
     */
    gridClass:
      'grid grid-cols-1 md:grid-cols-5 xl:grid-cols-12 gap-0 items-stretch ' +
      'min-h-[260px] md:min-h-[320px] xl:min-h-[360px] xl:max-h-[440px]',
    posterWrapClass:
      'relative md:col-span-3 xl:col-span-7 min-h-[200px] md:min-h-[320px] overflow-hidden',
    posterImgClass: 'absolute inset-0 h-full w-full object-cover',
    posterFallbackClass:
      'relative md:col-span-3 xl:col-span-7 min-h-[200px] md:min-h-[320px] flex items-center justify-center ' +
      'bg-gradient-to-br from-[#1e293b]/[0.08] via-zinc-100 to-white ' +
      'dark:from-zinc-900/70 dark:via-zinc-900/40 dark:to-transparent',
    /** Przyciemnienie u dołu plakatu — pod „Najbliższe wydarzenie" badge. */
    posterShadeClass:
      'pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent ' +
      'md:bg-gradient-to-r md:from-black/30 md:via-transparent md:to-transparent',
    /** Pływający badge "Najbliższe wydarzenie" lewy-góra plakatu. */
    eyebrowFloatClass:
      'absolute left-4 top-4 z-[2] inline-flex items-center gap-1.5 rounded-full ' +
      'border border-white/30 bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white ' +
      'backdrop-blur-md shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]',
    metaWrapClass:
      'relative md:col-span-2 xl:col-span-5 flex flex-col gap-4 p-5 sm:p-6 md:p-7 xl:p-8 ' +
      'border-t md:border-t-0 md:border-l border-zinc-200/70 dark:border-white/10',
    /** Data — duży „bilet": miesiąc na górze, dzień gigant. */
    dateBlockClass:
      'inline-flex flex-col items-start gap-1 rounded-2xl border px-3 py-2 self-start ' +
      'border-[#1e293b]/25 bg-[#1e293b]/[0.05] ' +
      'dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.08]',
    dateMonthClass:
      'text-[10px] font-bold uppercase tracking-[0.22em] text-[#1e293b] dark:text-brand-gold-bright',
    dateDayClass:
      'text-3xl font-extrabold leading-none text-[#1e293b] dark:text-brand-gold-bright',
    titleClass:
      'text-xl sm:text-2xl font-extrabold leading-tight text-zinc-900 dark:text-zinc-50 line-clamp-3',
    metaRowClass: 'flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300',
    metaIconClass: 'shrink-0 text-[#1e293b] dark:text-brand-gold-bright',
    /** Pasek akcji u dołu — CTA + zapisanych. */
    actionsRowClass: 'mt-auto flex flex-wrap items-center gap-3 pt-2',
  },

  // ── Section divider header (Dziś / Ten tydzień / itd.) ───────────────────
  section: {
    wrapClass: 'space-y-3',
    headerClass:
      'flex items-baseline justify-between gap-3 px-1',
    titleClass:
      'flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] ' +
      'text-[#1e293b] dark:text-brand-gold-bright',
    titleIconClass: 'shrink-0 text-[#1e293b] dark:text-brand-gold-bright',
    countBadgeClass:
      'inline-flex items-center justify-center rounded-full border px-2 py-0.5 ' +
      'text-[10px] font-extrabold tabular-nums ' +
      'border-[#1e293b]/25 bg-[#1e293b]/[0.05] text-[#1e293b] ' +
      'dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/[0.06] dark:text-brand-gold-bright',
    subtitleClass:
      'text-[11px] font-medium text-zinc-500 dark:text-zinc-500',
    /**
     * Gęstość siatki kart w sekcji rośnie z szerokością okna:
     *  - <sm:  1 kolumna
     *  - sm:   2 kolumny (tablet portrait)
     *  - xl:   3 kolumny (desktop ≥ 1280 px)
     *  - 2xl:  4 kolumny (wide desktop ≥ 1536 px)
     */
    gridClass: 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  },

  // ── Toolbar (filter pills + search + create) — STATYCZNY ─────────────────
  // (wcześniej `sticky top-[64px]`; produktowo zdecydowane że pasek ma scrollować
  // razem z resztą strony — eliminacja "podążającego" headera.)
  toolbar: {
    stickyWrapClass:
      'relative -mx-2 sm:mx-0 px-2 sm:px-0 pb-3 ' +
      'border-b border-zinc-200/60 dark:border-white/[0.06]',
    rowClass: 'flex flex-wrap items-center justify-between gap-3',
    pillsWrapClass:
      'flex flex-wrap gap-1.5 min-w-0 w-full sm:w-auto justify-center sm:justify-start',
    actionsWrapClass:
      'flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end',
  },

  // ── Side rail (aside) ────────────────────────────────────────────────────
  rail: {
    /**
     * Sticky `top-20` (80 px = header `h-16` 64 px + 16 px oddechu).
     * Wcześniej `top-[140px]` żeby zostawić miejsce pod sticky-toolbar —
     * po przejściu toolbara na statyczny, rail przykleja się pod headerem.
     */
    wrapClass: 'sticky top-20 flex flex-col gap-4',
    panelClass:
      'relative overflow-hidden rounded-2xl border p-4 ' +
      'border-zinc-200/70 bg-white/75 backdrop-blur-xl backdrop-saturate-150 ' +
      'shadow-[0_18px_60px_-30px_rgba(15,23,42,0.3)] ' +
      'dark:border-white/[0.06] dark:bg-zinc-950/45 ' +
      'dark:shadow-[0_25px_70px_-30px_rgba(0,0,0,0.9)]',
    panelTitleClass:
      'flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] ' +
      'text-[#1e293b] dark:text-brand-gold-bright',
    panelTitleIconClass: 'shrink-0 text-[#1e293b] dark:text-brand-gold-bright',
    statsGridClass: 'mt-3 grid grid-cols-3 gap-2',
    statCellClass:
      'flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2.5 ' +
      'border-zinc-200/60 bg-zinc-50/60 ' +
      'dark:border-white/[0.06] dark:bg-white/[0.02]',
    statValueClass:
      'text-lg font-extrabold leading-none tabular-nums text-[#1e293b] dark:text-brand-gold-bright',
    statLabelClass:
      'text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 text-center',
    liveRowClass:
      'mt-3 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300',
    filterListClass: 'mt-3 flex flex-col gap-1',
    filterButtonBase:
      'group w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ' +
      'transition-colors text-left',
    filterButtonInactive:
      'text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 ' +
      'dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-zinc-100',
    filterButtonActive:
      'bg-[#1e293b]/[0.06] text-[#1e293b] ring-1 ring-inset ring-[#1e293b]/25 font-semibold ' +
      'dark:bg-brand-gold-bright/[0.08] dark:text-brand-gold-bright dark:ring-brand-gold-bright/30',
    /**
     * Liczniki w nieaktywnym wierszu. W dark mode tło jest mocniejsze
     * (`bg-white/12`) żeby nie zlać się z hoverem rowki (`bg-white/[0.04]`),
     * tekst `text-zinc-200` zamiast `zinc-400` dla pełnej czytelności na
     * hoverze. Na light pozostaje delikatny zinc.
     */
    filterCountClass:
      'shrink-0 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 ' +
      'text-[10px] font-extrabold tabular-nums min-w-[20px] ' +
      'bg-zinc-200/80 text-zinc-700 ' +
      'group-hover:bg-zinc-300/80 group-hover:text-zinc-900 ' +
      'dark:bg-white/12 dark:text-zinc-200 ' +
      'dark:group-hover:bg-white/18 dark:group-hover:text-zinc-50',
    /**
     * Liczniki w aktywnym wierszu — w tonie filtra (navy w light, gold w dark)
     * dla spójności wizualnej z ringiem i tekstem aktywnego przycisku.
     */
    filterCountActiveClass:
      'shrink-0 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 ' +
      'text-[10px] font-extrabold tabular-nums min-w-[20px] ' +
      'bg-[#1e293b]/15 text-[#1e293b] ring-1 ring-inset ring-[#1e293b]/25 ' +
      'dark:bg-brand-gold-bright/20 dark:text-brand-gold-bright dark:ring-brand-gold-bright/35',
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  empty: {
    wrapClass:
      'relative overflow-hidden rounded-3xl border p-8 sm:p-12 text-center ' +
      'border-zinc-200/70 bg-white/70 backdrop-blur-xl backdrop-saturate-150 ' +
      'dark:border-white/[0.06] dark:bg-zinc-950/40',
    iconBubbleClass:
      'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ' +
      'border border-[#1e293b]/20 bg-[#1e293b]/[0.06] text-[#1e293b] ' +
      'dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/[0.08] dark:text-brand-gold-bright',
    titleClass: 'text-base font-bold text-zinc-900 dark:text-zinc-100',
    subtitleClass:
      'mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto',
    hintsWrapClass: 'mt-5 flex flex-wrap justify-center gap-2',
    hintChipClass:
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ' +
      'text-xs font-medium transition-colors ' +
      'border-zinc-200 bg-white/70 text-zinc-700 ' +
      'hover:border-[#1e293b]/35 hover:bg-zinc-100 ' +
      'dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-200 ' +
      'dark:hover:border-brand-gold-bright/45 dark:hover:bg-brand-gold-bright/10',
  },

  // ── Motion ───────────────────────────────────────────────────────────────
  motion: {
    page: {
      hidden: {},
      show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
    },
    fadeUp: {
      hidden: { opacity: 0, y: 12 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
      },
    },
    grid: {
      hidden: {},
      show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
    },
    item: {
      hidden: { opacity: 0, y: 8 },
      show: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring' as const, stiffness: 280, damping: 26 },
      },
    },
  },
} as const

export const EVENTS_TOOLBAR = {
  liveBadge:
    'hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 ' +
    'text-[10px] font-bold uppercase tracking-wide ' +
    'border-zinc-200 bg-white/70 text-slate-600 ' +
    'dark:border-white/10 dark:bg-black/25 dark:text-slate-400',
  searchWrap:
    'relative flex h-10 min-w-[160px] flex-1 max-w-xs sm:max-w-[240px] items-center gap-2 rounded-2xl px-3.5 ' +
    'backdrop-blur-md backdrop-saturate-150 border border-zinc-200 bg-white/80 ' +
    'transition-colors duration-200 focus-within:border-[#1e293b]/40 ' +
    'dark:border-white/10 dark:bg-bg-card/80 dark:focus-within:border-brand-gold-bright/45',
  searchLeadingIcon: 'shrink-0 size-5 text-[#1e293b] dark:text-zinc-400',
  searchInner:
    'h-full w-full min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none ' +
    'placeholder:text-zinc-500 caret-[#1e293b] ' +
    'dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:caret-brand-gold-bright',
  createBtn:
    'shrink-0 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ' +
    'border-[#1e293b]/40 text-[#1e293b] transition-colors hover:bg-[#1e293b]/5 ' +
    'dark:border-brand-gold/45 dark:text-brand-gold-bright dark:hover:bg-brand-gold/10',
} as const

export const BOTTOM_NAV_MOBILE = {
  scrollThreshold: 10,
  navBaseClass: 'md:hidden fixed bottom-0 left-0 right-0 z-50 border-t',
  navScrolledClass: 'bg-bg-app/80 backdrop-blur-lg border-zinc-200 dark:border-white/5',
  navDefaultClass: 'bg-bg-app border-border-app',
  safeAreaBottomInset: 'env(safe-area-inset-bottom)',
  /** Pełna szerokość + 5 równych kolumn — FAB w środkowej kolumnie = 50vw (oś z logo). */
  rowClass: 'grid grid-cols-5 items-end w-full px-4 py-1.5 min-h-16',
  iconButtonBaseClass:
    'flex flex-col col-span-1 items-center justify-center gap-1 min-h-[56px] py-2 px-1 transition-colors rounded-xl',
  iconButtonActiveClass: 'text-[#1e293b] dark:text-accent-interactive',
  iconButtonInactiveClass: 'text-[#1e293b]/75 dark:text-gray-400 dark:hover:text-white/90',
  iconButtonLabelClass: 'text-[10px] font-semibold leading-none tracking-tight truncate max-w-full',
  iconButtonLabelInactiveClass: 'text-[#1e293b]/70 dark:text-gray-400',
  iconButtonLabelActiveClass: 'text-[#1e293b] dark:text-accent-interactive',
  composeWrapperClass:
    'col-start-3 flex items-center justify-center shrink-0 px-0.5 min-h-[56px]',
  composeButtonClass:
    'h-14 w-14 rounded-full flex items-center justify-center border-0 outline-none shadow-lg bg-zinc-900 text-white dark:bg-gradient-to-br dark:from-brand-gold-bright dark:to-brand-gold dark:text-zinc-900 dark:shadow-lg dark:shadow-brand-gold/40 transition-transform duration-200 hover:brightness-[1.03] active:brightness-[0.97] dark:hover:brightness-105 dark:active:brightness-95',
  bellIconClass: 'h-7 w-7 shrink-0 transition-colors',
  bellActiveClass: 'text-[#1e293b] dark:text-accent-interactive',
  bellInactiveClass: 'text-[#1e293b]/75 dark:text-gray-400 dark:hover:text-white/80',
  unreadBadgeClass:
    'absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-[#1e293b] text-white text-[9px] font-bold flex items-center justify-center px-0.5 dark:bg-accent-gold dark:text-[#060e1f]',
  motion: {
    tabTap: { scale: 0.95 },
    composeHover: { scale: 1.04 },
    composeTap: { scale: 1.08 },
    composeTransition: { type: 'spring' as const, stiffness: 400, damping: 24 },
  },
} as const

/**
 * Tokeny dla lewego sidebara desktopowego (>=lg) — wariant **Unified
 * Glass**. Cały sidebar to jeden glass-kontener; sekcje wewnątrz są
 * oznaczone tylko nagłówkiem + delikatną hairline'ową kreską między
 * grupami (zamiast osobnych kart-wysp). Czytelne, jednolite, wciąż
 * minimalne. Aktywny stan: spokojny `border + tinted bg`, bez glow.
 */
export const SIDE_NAV_DESKTOP = {
  containerClass:
    'hidden lg:flex lg:flex-col lg:shrink-0 lg:w-72 lg:sticky lg:top-0 lg:self-start lg:h-dvh lg:p-3 lg:z-30',
  /**
   * Kolumna treści (flex-1): przesunięcie w lewo o połowę `lg:w-72`, żeby logo
   * i grid feedu siedziały na osi środka viewportu, a nie środka `flex-1`.
   * `pr-36` kompensuje margines — bez poziomego scrolla.
   */
  contentOffsetClass: 'lg:-ml-36 lg:pr-36',
  /** Odstęp pod fixed header na desktopie (`md:h-16`). */
  contentPadTopClass: 'lg:pt-16',
  innerClass:
    'flex flex-1 min-h-0 flex-col rounded-2xl border border-white/45 bg-white/45 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.65)] dark:border-white/8 dark:bg-zinc-900/30 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden',
  scrollAreaClass:
    'flex-1 min-h-0 overflow-y-auto px-2.5 py-3 flex flex-col gap-1.5',
  groupClass: 'flex flex-col gap-1.5',
  groupDividerClass:
    'mt-1 mx-3 border-t border-zinc-200/70 dark:border-white/8',
  sectionLabelClass:
    'px-3 pt-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#1e293b]/60 dark:text-zinc-500',
  itemBaseClass:
    'group relative flex w-full items-center gap-3 rounded-full border pl-4 pr-4 py-3 text-[15px] font-medium transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/25 dark:focus-visible:ring-brand-gold/40',
  itemInactiveClass:
    'border-transparent text-[#1e293b]/90 hover:border-white/60 hover:bg-white/65 hover:text-[#1e293b] dark:text-zinc-200 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-brand-gold-bright',
  itemActiveClass:
    'border-brand-gold/45 bg-brand-gold/10 text-[#1e293b] font-semibold dark:border-brand-gold-bright/45 dark:bg-brand-gold-bright/12 dark:text-brand-gold-bright',
  iconBaseClass: 'shrink-0 transition-colors',
  iconInactiveClass:
    'text-[#1e293b]/65 group-hover:text-[#1e293b] dark:text-zinc-400 dark:group-hover:text-brand-gold-bright',
  iconActiveClass: 'text-[#1e293b] dark:text-brand-gold-bright',
  unreadDotClass:
    'h-2 w-2 rounded-full bg-brand-gold dark:bg-brand-gold-bright',
  badgePillClass:
    'ml-auto inline-flex min-w-[22px] h-5 items-center justify-center rounded-full bg-[#1e293b] px-1.5 text-[10px] font-bold text-white dark:bg-brand-gold-bright dark:text-zinc-900',
  moreToggleClass:
    'group flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#1e293b]/60 hover:text-[#1e293b] transition-colors dark:text-zinc-500 dark:hover:text-brand-gold-bright',
  moreChevronClass: 'ml-auto shrink-0 transition-transform duration-200',
  iconSize: 22,
  iconStrokeWidth: 1.9,
  iconActiveStrokeWidth: 2.2,
} as const

/**
 * Tokeny dla mobile drawera (<lg). Slide-in z lewej, blur backdrop, full
 * height. Layout: avatar/header → search input → grupy sekcji → bottom
 * row (theme + wyloguj).
 */
export const MOBILE_DRAWER = {
  rootClass: 'fixed inset-0 z-[300] lg:hidden flex',
  backdropClass:
    'absolute inset-0 bg-black/45 backdrop-blur-[2px] dark:bg-black/65',
  panelClass:
    'relative flex h-dvh w-[86%] max-w-[340px] flex-col bg-bg-app border-r border-zinc-200 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-bg-app dark:shadow-[0_30px_80px_-24px_rgba(0,0,0,0.85)]',
  headerClass:
    'flex items-center gap-3 px-4 py-4 border-b border-zinc-200 dark:border-white/10',
  headerNameClass:
    'flex min-w-0 flex-1 flex-col text-[#1e293b] dark:text-zinc-100',
  headerNamePrimaryClass: 'truncate text-sm font-semibold',
  headerNameSecondaryClass:
    'truncate text-[11px] font-medium text-[#1e293b]/60 dark:text-zinc-500',
  closeButtonClass:
    'shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-[#1e293b]/75 hover:bg-black/5 hover:text-[#1e293b] dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-100',
  searchWrapperClass: 'px-4 pt-3 pb-2',
  searchInputClass:
    'w-full h-11 rounded-xl border border-zinc-200 bg-white/90 pl-10 pr-3 text-[14px] text-[#1e293b] placeholder:text-[#1e293b]/45 outline-none focus:border-[#1e293b]/30 focus:ring-2 focus:ring-[#1e293b]/15 dark:border-white/10 dark:bg-black/35 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-gold-bright/40 dark:focus:ring-brand-gold/20',
  searchIconClass:
    'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1e293b]/55 dark:text-zinc-400',
  scrollAreaClass: 'flex-1 min-h-0 overflow-y-auto px-2 py-3',
  sectionClass: 'flex flex-col gap-1.5',
  sectionDividerClass:
    'mt-2 mb-2 mx-3 border-t border-zinc-200/70 dark:border-white/8',
  sectionLabelClass:
    'px-3 pt-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#1e293b]/60 dark:text-zinc-500',
  itemBaseClass:
    'group relative flex w-full items-center gap-3 rounded-full border pl-4 pr-4 py-3 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/25 dark:focus-visible:ring-brand-gold/40',
  itemInactiveClass:
    'border-transparent text-[#1e293b]/85 hover:border-white/60 hover:bg-white/65 hover:text-[#1e293b] dark:text-zinc-300 dark:hover:border-white/10 dark:hover:bg-white/6 dark:hover:text-brand-gold-bright',
  itemActiveClass:
    'border-brand-gold/45 bg-brand-gold/10 text-[#1e293b] font-semibold dark:border-brand-gold-bright/45 dark:bg-brand-gold-bright/12 dark:text-brand-gold-bright',
  iconBaseClass: 'shrink-0 transition-colors',
  iconInactiveClass:
    'text-[#1e293b]/60 group-hover:text-[#1e293b] dark:text-zinc-400 dark:group-hover:text-brand-gold-bright',
  iconActiveClass: 'text-[#1e293b] dark:text-brand-gold-bright',
  unreadDotClass:
    'h-2 w-2 rounded-full bg-brand-gold dark:bg-brand-gold-bright',
  badgePillClass:
    'ml-auto inline-flex min-w-[22px] h-5 items-center justify-center rounded-full bg-[#1e293b] px-1.5 text-[10px] font-bold text-white dark:bg-brand-gold-bright dark:text-zinc-900',
  bottomRowClass:
    'shrink-0 flex flex-col gap-1 border-t border-zinc-200 px-2 py-3 dark:border-white/10',
  logoutItemClass:
    'group flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-3 text-[14px] font-semibold text-rose-500/90 hover:bg-rose-500/8 hover:text-rose-600 transition-colors dark:text-rose-400/90 dark:hover:bg-rose-500/10 dark:hover:text-rose-300',
  iconSize: 20,
  iconStrokeWidth: 1.9,
  iconActiveStrokeWidth: 2.2,
  motion: {
    panelInitial: { x: '-100%' },
    panelAnimate: { x: 0 },
    panelExit: { x: '-100%' },
    panelTransition: { type: 'spring' as const, stiffness: 320, damping: 32 },
    backdropInitial: { opacity: 0 },
    backdropAnimate: { opacity: 1 },
    backdropExit: { opacity: 0 },
    backdropTransition: { duration: 0.2 },
  },
} as const
