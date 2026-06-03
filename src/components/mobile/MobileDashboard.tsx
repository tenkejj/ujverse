import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NIEZBEDNIK_LINKS } from '../Niezbednik'
import {
  OFFICIAL_TAG_META,
  ZoneIcon,
  getZones,
  type OfficialTagSlug,
} from '../../services/TagService'
import { groupPathForSlug } from '../../lib/groupPaths'
import type { AnnouncementMeta, UnifiedContent } from '../../types/content'
import AnnouncementPills from '../AnnouncementPills'
import {
  ABSOLUTE_ARROW_BTN_CLS,
  OVERLAY_LEFT_CLS,
  OVERLAY_RIGHT_CLS,
  SCROLL_STEP_PX,
} from '../ui/HorizontalPillScroller'

/**
 * MobileDashboard — pojedynczy poziomy "rail" szybkiego dostępu (mobile).
 *
 * Konsoliduje trzy poprzednie sekcje (Niezbednik · Strefy · AnnouncementPills)
 * w jednej zwartej "wyspie" nawigacyjnej pod headerem:
 *   USOS · PEGAZ · POCZTA │ Ankiety · Ogłoszenia · Pomoc │ [pigułki komunikatów]
 *
 * Struktura JSX 1:1 z `FeedFilters` → `HorizontalPillScroller`:
 *   - `BLEED_WRAPPER_CLS` (`-mx-4 px-4 py-2`) — bleed do krawędzi viewportu
 *      + 16px wewnętrzny inset (analog `STICKY_MOBILE_CLS` w `FeedFilters`).
 *   - `relative w-full min-w-0` — kontekst pozycjonowania dla overlay/arrow
 *      (analog outer wrappera w `HorizontalPillScroller`).
 *   - `<nav>` z `TRAY_CLS` — scrollowalny track ikon (`overflow-x-auto`),
 *      `pr-12` zostawia 48px clearance pod absolutną strzałkę.
 *   - `OVERLAY_RIGHT_CLS` + `ABSOLUTE_ARROW_BTN_CLS` (importowane z
 *      `HorizontalPillScroller`) — gradient maskujący + strzałka identyczna
 *      jak w `DepartmentFilter`. `right-1` w obu miejscach → arrow ląduje
 *      ~20px od prawej krawędzi viewportu, jak w `FeedFilters`.
 *
 * AnnouncementPills jest renderowany w trybie `inline` (fragment: pigułki +
 * portalowy drawer), aby uniknąć zagnieżdżonego scroll-trackera.
 */

const BLEED_WRAPPER_CLS = '-mx-4 px-4 py-2'

const TRAY_CLS =
  'flex flex-row items-center gap-4 overflow-x-auto scrollbar-hide ' +
  'pr-12 overscroll-x-contain [-webkit-overflow-scrolling:touch]'

const ITEM_CLS =
  'shrink-0 flex h-12 w-12 md:w-16 md:h-auto flex-col items-center justify-center gap-1 ' +
  'rounded-xl px-1 py-1.5 text-center ' +
  'text-zinc-600 transition-colors hover:text-[#1e293b] active:text-[#1e293b] ' +
  'dark:text-zinc-300 dark:hover:text-brand-gold-bright dark:active:text-brand-gold-bright ' +
  '[-webkit-tap-highlight-color:transparent] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[#1e293b]/30 dark:focus-visible:ring-brand-gold/35'

const LABEL_CLS =
  'hidden md:block w-full truncate text-[10px] font-medium leading-none tracking-wide'

const SEPARATOR_CLS = 'shrink-0 w-px h-6 bg-zinc-300 dark:bg-white/15'

type Props = {
  className?: string
  /** Ile stref pokazać. Default: 3 (Ankiety / Ogłoszenia / Pomoc). */
  zoneLimit?: number
  /** Komunikaty już przefiltrowane po wydziale (z `useAnnouncements`). */
  announcements: UnifiedContent<AnnouncementMeta>[]
  announcementsLoading: boolean
}

export default function MobileDashboard({
  className = '',
  zoneLimit = 3,
  announcements,
  announcementsLoading,
}: Props) {
  const navigate = useNavigate()
  const zones = getZones(zoneLimit)

  const pickZone = (slug: OfficialTagSlug) => {
    navigate(groupPathForSlug(slug))
  }

  // Trzecia grupa (pills) ma sens wizualnie tylko jeśli mamy co pokazać
  // albo trwa load — inaczej trailing separator wisiałby bez kontentu.
  const showPillsGroup = announcementsLoading || announcements.length > 0

  // Scroll state — wzorzec 1:1 z `HorizontalPillScroller` (oba kierunki).
  // Trzymamy własną instancję ref + listenerów (nie wrappera), bo rail
  // używa semantycznego `<nav>` i ma własną strukturę dzieci (ikony +
  // separatory + inline `AnnouncementPills`).
  const trayRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = trayRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = trayRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, announcements.length, announcementsLoading])

  const scrollLeft = () => {
    trayRef.current?.scrollBy({ left: -SCROLL_STEP_PX, behavior: 'smooth' })
  }

  const scrollRight = () => {
    trayRef.current?.scrollBy({ left: SCROLL_STEP_PX, behavior: 'smooth' })
  }

  return (
    <div className={`${BLEED_WRAPPER_CLS} ${className}`.trim()}>
      <div className="relative w-full min-w-0">
        <nav ref={trayRef} aria-label="Szybki dostęp" className={TRAY_CLS}>
          {NIEZBEDNIK_LINKS.map(({ label, shortLabel, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className={ITEM_CLS}
            >
              <Icon size={22} strokeWidth={1.85} className="shrink-0" aria-hidden />
              <span className={LABEL_CLS}>{shortLabel}</span>
            </a>
          ))}

          <div className={SEPARATOR_CLS} aria-hidden />

          {zones.map((slug) => {
            const meta = OFFICIAL_TAG_META[slug]
            return (
              <button
                key={slug}
                type="button"
                onClick={() => pickZone(slug)}
                aria-label={meta.name}
                title={meta.name}
                className={ITEM_CLS}
              >
                <ZoneIcon slug={slug} className="size-[22px] shrink-0" />
                <span className={LABEL_CLS}>{meta.name}</span>
              </button>
            )
          })}

          {showPillsGroup && (
            <>
              <div className={SEPARATOR_CLS} aria-hidden />
              <AnnouncementPills
                inline
                announcements={announcements}
                loading={announcementsLoading}
              />
            </>
          )}
        </nav>

        {canScrollLeft && (
          <div className={OVERLAY_LEFT_CLS}>
            <button
              type="button"
              onClick={scrollLeft}
              aria-label="Przewiń w lewo"
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
              aria-label="Przewiń w prawo"
              className={`${ABSOLUTE_ARROW_BTN_CLS} right-1`}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
