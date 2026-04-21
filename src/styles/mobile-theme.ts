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
    'md:hidden min-w-[40px] min-h-[40px] w-9 h-9 flex items-center justify-center rounded-full text-slate-500 dark:text-gray-400 hover:text-[#1e293b] dark:hover:text-brand-gold-bright hover:bg-black/5 dark:hover:bg-white/10 transition-colors',
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
    'ujverse-search-input relative z-[1] h-12 w-full rounded-2xl border border-[#0f172a]/10 bg-black/[0.06] pl-11 pr-3 text-[16px] text-logo-navy shadow-none outline-none ring-0 transition-[border-color] duration-300 placeholder:text-fg-secondary focus:border-[#0f172a]/20 focus:ring-0 dark:border-white/10 dark:bg-black/40 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-white/25 caret-[#1e293b] dark:caret-brand-gold-bright',
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

export const BOTTOM_NAV_MOBILE = {
  scrollThreshold: 10,
  navBaseClass: 'md:hidden fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 border-t',
  navScrolledClass: 'bg-bg-app/80 backdrop-blur-lg border-slate-200 dark:border-white/5',
  navDefaultClass: 'bg-bg-app border-border-app',
  safeAreaBottomInset: 'env(safe-area-inset-bottom)',
  rowClass: 'flex items-center justify-center gap-1 px-2 py-1.5 max-w-lg mx-auto min-h-16',
  iconButtonBaseClass: 'flex flex-1 items-center justify-center min-h-[52px] py-3 px-2 transition-colors rounded-xl',
  iconButtonActiveClass: 'text-[#1e293b] dark:text-accent-interactive',
  iconButtonInactiveClass: 'text-[#1e293b] dark:text-gray-300 dark:hover:text-white/90',
  composeWrapperClass: 'flex items-center justify-center shrink-0 px-0.5 min-h-[52px]',
  composeButtonClass:
    'h-14 w-14 rounded-full flex items-center justify-center border-0 outline-none shadow-lg bg-logo-navy text-white dark:bg-gradient-to-br dark:from-brand-gold-bright dark:to-brand-gold dark:text-slate-900 dark:shadow-lg dark:shadow-brand-gold/40 transition-transform duration-200 hover:brightness-[1.03] active:brightness-[0.97] dark:hover:brightness-105 dark:active:brightness-95',
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
