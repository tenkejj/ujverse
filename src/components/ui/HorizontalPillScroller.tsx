import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Reużywane przez konsumentów, którzy chcą zbudować identyczną strzałkę
 * (look + krok scrolla + maskujący gradient) we własnej strukturze JSX.
 * Patrz `MobileDashboard` — używa `OVERLAY_RIGHT_CLS` + `ABSOLUTE_ARROW_BTN_CLS`
 * w identycznym dwupoziomowym nestingu jak `FeedFilters` → `HorizontalPillScroller`.
 */
export const SCROLL_STEP_PX = 220

export const ARROW_BTN_VISUAL_CLS =
  'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 ' +
  'bg-white/10 text-[#1e293b] backdrop-blur-md transition-colors hover:bg-white/20 ' +
  'dark:border-white/10 dark:bg-zinc-800/40 dark:text-white dark:hover:bg-zinc-700/60'

export const OVERLAY_LEFT_CLS =
  'absolute left-0 top-0 z-10 flex h-full w-10 bg-gradient-to-r from-white to-transparent pointer-events-none dark:from-black/20 sm:w-12'

export const OVERLAY_RIGHT_CLS =
  'absolute right-0 top-0 z-10 flex h-full w-10 bg-gradient-to-l from-white to-transparent pointer-events-none dark:from-black/20 sm:w-12'

export const ABSOLUTE_ARROW_BTN_CLS =
  `pointer-events-auto absolute top-1/2 z-20 -translate-y-1/2 ${ARROW_BTN_VISUAL_CLS}`

/**
 * Spacery — realne flex items po obu stronach listy (tylko mobile).
 *
 * Workaround na znany quirk Chromium/Firefox: `padding-inline-end` na flex
 * containerze z `overflow-x: auto` bywa ignorowane jako koniec scrollable
 * area, przez co ostatni element ląduje pod absolutnie pozycjonowaną
 * strzałką nawigacji. Spacer jako flex item gwarantuje miejsce nawet po
 * całkowitym przewinięciu (szer. > strzałka 40 px + gradient 40–48 px).
 *
 * Na desktopie (md+) spacery są ukryte (`md:hidden`), bo zawartość zwykle
 * mieści się w linii — sztuczna szerokość fałszowałaby `scrollWidth`
 * i aktywowała strzałki przewijania, a także psułaby centrowanie
 * (`md:justify-center`) oraz symetrię układu.
 */
const spacerCls = 'shrink-0 w-12 sm:w-14 md:hidden'

type Props = {
  children: ReactNode
  /** Klasy zewnętrznego wrappera (`relative`). */
  className?: string
  /** Klasy poziomego tracku z pigułkami (musi zawierać overflow-x-auto). */
  scrollClassName: string
  /** Przeliczenie widoczności strzałek po zmianie zawartości. */
  watchDeps?: readonly unknown[]
  scrollLeftLabel?: string
  scrollRightLabel?: string
  /** Atrybuty na przewijanym tracku (np. role="tablist"). */
  scrollProps?: HTMLAttributes<HTMLDivElement>
  /**
   * Mobile-only flex spacer po obu stronach listy.
   * `true` (default) — chroni pierwszy/ostatni element przed zasłonięciem
   * przez chevrony nawigacji.
   * `false` — wyłącza spacer; przydatne gdy pigułki mają być flush z lewą
   * krawędzią (np. `DepartmentFilter` w sticky filter barze).
   */
  withMobileEdgeSpacer?: boolean
}

export default function HorizontalPillScroller({
  children,
  className = '',
  scrollClassName,
  watchDeps = [],
  scrollLeftLabel = 'Przewiń w lewo',
  scrollRightLabel = 'Przewiń w prawo',
  scrollProps,
  withMobileEdgeSpacer = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, ...watchDeps])

  const scrollRight = () => {
    containerRef.current?.scrollBy({ left: SCROLL_STEP_PX, behavior: 'smooth' })
  }

  const scrollLeft = () => {
    containerRef.current?.scrollBy({ left: -SCROLL_STEP_PX, behavior: 'smooth' })
  }

  return (
    <div className={`relative w-full min-w-0 ${className}`.trim()}>
      <div
        ref={containerRef}
        className={`${scrollClassName} md:px-0`.trim()}
        {...scrollProps}
      >
        {withMobileEdgeSpacer && (
          <div aria-hidden role="presentation" className={spacerCls} />
        )}
        {children}
        {withMobileEdgeSpacer && (
          <div aria-hidden role="presentation" className={spacerCls} />
        )}
      </div>
      {canScrollLeft && (
        <div className={OVERLAY_LEFT_CLS}>
          <button
            type="button"
            onClick={scrollLeft}
            aria-label={scrollLeftLabel}
            className={`${ABSOLUTE_ARROW_BTN_CLS} left-1`}
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      )}
      {canScrollRight && (
        <div className={OVERLAY_RIGHT_CLS}>
          <button
            type="button"
            onClick={scrollRight}
            aria-label={scrollRightLabel}
            className={`${ABSOLUTE_ARROW_BTN_CLS} right-1`}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
