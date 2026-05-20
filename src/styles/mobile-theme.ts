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
  containerClass: 'h-16 gap-2 px-4',
  sideSectionClass: 'w-[100px] min-w-[100px] md:w-24 md:min-w-24',
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
    ringClass:
      'ring-4 ring-[var(--bg-app)] dark:ring-[#01020a] shadow-[0_0_60px_-8px_rgba(24,24,27,0.35)] dark:shadow-[0_0_60px_-8px_rgba(232,200,74,0.28)]',
    radiusClass: 'rounded-full',
  },
  card: {
    glassLight:
      'border border-zinc-900/10 bg-white/75 shadow-[0_30px_80px_-40px_rgba(24,24,27,0.35)]',
    glassDark:
      'dark:border-white/10 dark:bg-[#01020a]/70 dark:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]',
    glassClass:
      'relative overflow-hidden rounded-3xl border border-zinc-900/10 bg-white/75 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_30px_80px_-40px_rgba(24,24,27,0.35)] dark:border-white/10 dark:bg-[#01020a]/70 dark:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]',
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
      'inline-flex items-center justify-center gap-2 rounded-full border border-zinc-900/12 bg-white/95 px-4 py-2 text-sm font-semibold text-fg-primary shadow-sm transition-colors hover:border-zinc-700/50 dark:border-white/20 dark:bg-[#01020a]/95 dark:text-white dark:hover:border-brand-gold-bright/45',
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
  inputCapsuleWrap:
    'relative hidden md:flex h-9 lg:h-10 w-64 lg:w-80 xl:w-96 shrink-0 items-center rounded-2xl px-3.5 ' +
    'backdrop-blur-md backdrop-saturate-150 border border-zinc-200 bg-white/80 ' +
    'transition-colors duration-200 focus-within:border-[#1e293b]/40 ' +
    'dark:border-white/10 dark:bg-bg-card/80 dark:focus-within:border-brand-gold-bright/45',
  inputInner:
    'h-full w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-500 ' +
    'caret-[#1e293b] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:caret-brand-gold-bright',
  inputLeadingIcon:
    'mr-2.5 shrink-0 text-[#1e293b] dark:text-zinc-400',
  modeBadge:
    'mr-2 inline-flex items-center gap-1 rounded-md border border-[#1e293b]/30 bg-[#1e293b]/10 px-1.5 py-0.5 ' +
    'text-[10px] font-bold uppercase tracking-wider text-[#1e293b] ' +
    'dark:border-brand-gold-bright/40 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright',
  panel:
    'absolute right-0 top-[calc(100%+0.5rem)] z-[120] w-[min(28rem,calc(100vw-2rem))] ' +
    'origin-top-right overflow-hidden rounded-2xl ' +
    'border border-zinc-200/80 bg-white/95 shadow-2xl shadow-black/15 ring-1 ring-black/[0.04] ' +
    'backdrop-blur-2xl backdrop-saturate-150 ' +
    'dark:border-white/10 dark:bg-black/80 dark:shadow-black/60 dark:ring-white/[0.06]',
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

export const BOTTOM_NAV_MOBILE = {
  scrollThreshold: 10,
  navBaseClass: 'md:hidden fixed bottom-0 left-0 right-0 z-50 border-t',
  navScrolledClass: 'bg-bg-app/80 backdrop-blur-lg border-zinc-200 dark:border-white/5',
  navDefaultClass: 'bg-bg-app border-border-app',
  safeAreaBottomInset: 'env(safe-area-inset-bottom)',
  rowClass: 'flex items-center justify-center gap-1 px-2 py-1.5 max-w-lg mx-auto min-h-16',
  iconButtonBaseClass: 'flex flex-1 items-center justify-center min-h-[52px] py-3 px-2 transition-colors rounded-xl',
  iconButtonActiveClass: 'text-[#1e293b] dark:text-accent-interactive',
  iconButtonInactiveClass: 'text-[#1e293b] dark:text-gray-300 dark:hover:text-white/90',
  composeWrapperClass: 'flex items-center justify-center shrink-0 px-0.5 min-h-[52px]',
  composeButtonClass:
    'h-14 w-14 rounded-full flex items-center justify-center border-0 outline-none shadow-lg bg-zinc-900 text-white dark:bg-gradient-to-br dark:from-brand-gold-bright dark:to-brand-gold dark:text-zinc-900 dark:shadow-lg dark:shadow-brand-gold/40 transition-transform duration-200 hover:brightness-[1.03] active:brightness-[0.97] dark:hover:brightness-105 dark:active:brightness-95',
  bellIconClass: 'h-7 w-7 shrink-0 transition-colors',
  bellActiveClass: 'text-[#1e293b] dark:text-accent-interactive',
  bellInactiveClass: 'text-[#1e293b] dark:text-white dark:hover:text-white/80',
  unreadBadgeClass:
    'absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-[#1e293b] text-white text-[9px] font-bold flex items-center justify-center px-0.5 dark:bg-accent-gold dark:text-[#060e1f]',
  motion: {
    tabTap: { scale: 0.95 },
    composeHover: { scale: 1.04 },
    composeTap: { scale: 1.08 },
    composeTransition: { type: 'spring' as const, stiffness: 400, damping: 24 },
  },
} as const
