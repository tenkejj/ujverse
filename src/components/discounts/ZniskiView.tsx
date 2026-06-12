/**
 * UJverse — ZniskiView: "Couponek UJ" — katalog zniżek studenckich.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Design language wyrównany z `EventsView` (`EVENTS_HUB.*` + `FILTER_PILL`
 * + `EVENTS_TOOLBAR.*` + `HorizontalPillScroller`). Strona ma ten sam rytm
 * sekcji co `/events`:
 *
 *   1. (opcjonalny) Hero — pominięty świadomie; "Trending w 7 dni" pełni
 *      rolę spotlightu i lepiej skaluje się przy małej liczbie wpisów.
 *   2. Static toolbar — pills filtru rodzaju ("Wszystko/Trending/Wokół mnie"
 *      + "potwierdzone") + actions (search, sort, "Dodaj zniżkę").
 *   3. Sekcja "Trending w 7 dni" — `HorizontalPillScroller` z kartami trendingu.
 *   4. Sekcja "Kategorie" — `HorizontalPillScroller` pigułek kategorii
 *      (zastępuje natywny `overflow-x-auto` na przeglądarkach z paskiem).
 *   5. Grid kart (`EVENTS_HUB.section.gridClass`) z `motion.stagger`.
 *   6. Empty state w stylu `EVENTS_HUB.empty.*`.
 *
 * Routing: layout (max-w + padding) dostarcza `<main>` w `App.tsx` —
 * tutaj NIE robimy własnego `mx-auto max-w-*`. Tylko top-level
 * `space-y-6` jak `EventsView`.
 */
import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  Bus,
  Clapperboard,
  Coffee,
  Compass,
  Dumbbell,
  Loader2,
  MapPin,
  Music2,
  Pizza,
  Plus,
  Scissors,
  Search,
  Shirt,
  Sparkles,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react'
import HorizontalPillScroller from '../ui/HorizontalPillScroller'
import { EVENTS_HUB, EVENTS_TOOLBAR, FILTER_PILL } from '../../styles/mobile-theme'
import DiscountCard from './DiscountCard'
import DiscountDetailModal from './DiscountDetailModal'
import DiscountFormModal from './DiscountFormModal'
import { useDiscounts } from '../../hooks/useDiscounts'
import { useGamificationContext } from '../../lib/gamificationContext'
import {
  DISCOUNT_CATEGORIES,
  DISCOUNT_CATEGORY_META,
  type DiscountCategory,
  type DiscountFilter,
  type StudentDiscount,
} from '../../types/discounts'

type Props = {
  userId: string | null
}

const ICON_MAP = {
  Pizza,
  Coffee,
  Music2,
  Clapperboard,
  Dumbbell,
  BookOpen,
  Scissors,
  Bus,
  Shirt,
  Tag,
} as const

const SORT_LABELS: Record<DiscountFilter['sort'], string> = {
  use: 'Najpopularniejsze',
  created: 'Najnowsze',
  rating: 'Najlepiej oceniane',
}

// Klasy track'a dla `HorizontalPillScroller`. Identyczna geometria jak w
// `DepartmentFilter` — `min-w-0` + spacing + hide native scrollbar.
const SCROLLER_TRACK_CLS =
  'flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide ' +
  'overscroll-x-contain [-webkit-overflow-scrolling:touch] min-w-0'

const TRENDING_TRACK_CLS = SCROLLER_TRACK_CLS + ' pb-1'

export default function ZniskiView({ userId }: Props) {
  const {
    filter,
    setFilter,
    discounts,
    trending,
    myUsedIds,
    loading,
    trendingLoading,
    error,
    refresh,
    refreshTrending,
    markUse,
    geo,
    geoStatus,
    requestGeo,
  } = useDiscounts({ userId })

  const [detailDiscount, setDetailDiscount] = useState<StudentDiscount | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const handleOpenDetail = useCallback(
    (id: string) => {
      const found = discounts.find((d) => d.id === id)
      if (found) setDetailDiscount(found)
    },
    [discounts],
  )

  const gam = useGamificationContext()

  const handleCreated = useCallback(
    (discountId?: string) => {
      setFormOpen(false)
      void refresh()
      void refreshTrending()
      // Gamifikacja: 15 XP per zniżka + unlock badge. ref_id = discountId
      // (gdy mamy), inaczej brak ref → unique constraint zablokuje drugi
      // strzał z pustym ref dla tego samego usera (i tak nie chcemy spamu).
      if (gam) {
        void gam.awardXp('discount_added', 15, discountId)
        void gam.unlockAchievement('discount_finder')
      }
    },
    [refresh, refreshTrending, gam],
  )

  const hasGeo = geoStatus === 'ok' && geo != null

  const sortedDiscounts = useMemo(() => {
    if (!hasGeo) return discounts
    return [...discounts].sort((a, b) => {
      if (a.distanceMeters == null && b.distanceMeters == null) return 0
      if (a.distanceMeters == null) return 1
      if (b.distanceMeters == null) return -1
      return a.distanceMeters - b.distanceMeters
    })
  }, [discounts, hasGeo])

  const isEmpty = !loading && sortedDiscounts.length === 0
  const isFilteredOrSearching =
    filter.category !== 'all' || filter.search.trim().length > 0 || filter.verifiedOnly

  return (
    <motion.div
      variants={EVENTS_HUB.motion.page}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-6"
    >
      {/* ── Toolbar (filter actions + search + CTA) ────────────────────── */}
      <div className={EVENTS_HUB.toolbar.stickyWrapClass}>
        <div className={EVENTS_HUB.toolbar.rowClass}>
          {/* Lewa strona — pigułki "typu" filtra (potwierdzone, wokół mnie) */}
          <div className={EVENTS_HUB.toolbar.pillsWrapClass}>
            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))}
              className={`${FILTER_PILL.base} ${filter.verifiedOnly ? FILTER_PILL.active : FILTER_PILL.inactive}`}
              title="Pokaż tylko zniżki zweryfikowane przez admina"
            >
              Potwierdzone
            </button>
            <button
              type="button"
              onClick={requestGeo}
              disabled={geoStatus === 'pending'}
              className={`${FILTER_PILL.base} ${hasGeo ? FILTER_PILL.active : FILTER_PILL.inactive}`}
              title="Sortuj wg odległości od Ciebie (≤500m podświetlone)"
            >
              {geoStatus === 'pending' ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Compass size={13} strokeWidth={2} className="opacity-90" aria-hidden />
              )}
              {hasGeo ? 'Wokół mnie' : 'Pokaż wokół'}
            </button>
          </div>

          {/* Prawa strona — search + sort + Dodaj zniżkę */}
          <div className={EVENTS_HUB.toolbar.actionsWrapClass}>
            <div className={EVENTS_TOOLBAR.searchWrap}>
              <Search
                strokeWidth={2}
                className={EVENTS_TOOLBAR.searchLeadingIcon}
                aria-hidden
              />
              <input
                type="search"
                value={filter.search}
                onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                placeholder="Szukaj: pizza, kawa..."
                className={EVENTS_TOOLBAR.searchInner}
                aria-label="Szukaj zniżek"
              />
              {filter.search && (
                <button
                  type="button"
                  onClick={() => setFilter((f) => ({ ...f, search: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  aria-label="Wyczyść"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <select
              value={filter.sort}
              onChange={(e) =>
                setFilter((f) => ({ ...f, sort: e.target.value as DiscountFilter['sort'] }))
              }
              className="h-10 rounded-2xl border border-zinc-200 bg-white/80 px-3 text-[12.5px] font-medium text-zinc-700 backdrop-blur-md transition-colors focus:border-[#1e293b]/40 focus:outline-none dark:border-white/10 dark:bg-black/25 dark:text-zinc-200"
              aria-label="Sortuj"
            >
              {(Object.entries(SORT_LABELS) as Array<[DiscountFilter['sort'], string]>).map(([slug, label]) => (
                <option key={slug} value={slug}>{label}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setFormOpen(true)}
              disabled={!userId}
              className={EVENTS_TOOLBAR.createBtn}
            >
              <Plus size={18} strokeWidth={2} aria-hidden />
              Dodaj zniżkę
            </button>
          </div>
        </div>
      </div>

      {/* ── Trending w 7 dni ──────────────────────────────────────────── */}
      {(trending.length > 0 || trendingLoading) && (
        <motion.section
          variants={EVENTS_HUB.motion.fadeUp}
          className={EVENTS_HUB.section.wrapClass}
          aria-label="Trending w 7 dni"
        >
          <div className={EVENTS_HUB.section.headerClass}>
            <div className={EVENTS_HUB.section.titleClass}>
              <TrendingUp size={14} className={EVENTS_HUB.section.titleIconClass} strokeWidth={2.2} />
              Trending w 7 dni
            </div>
            {!trendingLoading && trending.length > 0 && (
              <span className={EVENTS_HUB.section.countBadgeClass}>{trending.length}</span>
            )}
          </div>

          {trendingLoading ? (
            <div className="flex gap-2 overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 w-64 shrink-0 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]"
                />
              ))}
            </div>
          ) : (
            <HorizontalPillScroller
              scrollClassName={TRENDING_TRACK_CLS}
              watchDeps={[trending.length]}
              scrollLeftLabel="Przewiń trendy w lewo"
              scrollRightLabel="Przewiń trendy w prawo"
              withMobileEdgeSpacer={false}
            >
              {trending.map((t, idx) => {
                const meta = DISCOUNT_CATEGORY_META[t.category]
                const Icon = ICON_MAP[meta.icon]
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleOpenDetail(t.id)}
                    className="group flex w-64 shrink-0 flex-col items-start gap-1 rounded-2xl border border-zinc-200/70 bg-white/80 px-3.5 py-2.5 text-left backdrop-blur-xl backdrop-saturate-150 transition-colors hover:border-[#1e293b]/25 hover:bg-white dark:border-white/10 dark:bg-zinc-950/45 dark:hover:border-brand-gold-bright/30 dark:hover:bg-zinc-900/60"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${meta.tint}`}>
                        <Icon size={10} strokeWidth={2.3} />
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-extrabold tabular-nums text-[#1e293b] dark:text-brand-gold-bright">
                        #{idx + 1}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                      {t.business_name}
                    </p>
                    <p className="line-clamp-1 text-[11.5px] font-semibold text-[#1e293b] dark:text-brand-gold-bright">
                      {t.discount_headline}
                    </p>
                    <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400">
                      <span className="tabular-nums">{t.recentUses}</span> wzięli w 7 dni
                    </p>
                  </button>
                )
              })}
            </HorizontalPillScroller>
          )}
        </motion.section>
      )}

      {/* ── Kategorie (custom scroller) ────────────────────────────────── */}
      <motion.section
        variants={EVENTS_HUB.motion.fadeUp}
        className={EVENTS_HUB.section.wrapClass}
        aria-label="Kategorie zniżek"
      >
        <div className={EVENTS_HUB.section.headerClass}>
          <div className={EVENTS_HUB.section.titleClass}>
            <Tag size={13} className={EVENTS_HUB.section.titleIconClass} strokeWidth={2.2} />
            Kategorie
          </div>
          {filter.category !== 'all' && (
            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, category: 'all' }))}
              className={EVENTS_HUB.section.subtitleClass + ' hover:underline'}
            >
              Wyczyść
            </button>
          )}
        </div>

        <HorizontalPillScroller
          scrollClassName={SCROLLER_TRACK_CLS}
          watchDeps={[filter.category]}
          scrollLeftLabel="Przewiń kategorie w lewo"
          scrollRightLabel="Przewiń kategorie w prawo"
          withMobileEdgeSpacer={false}
          scrollProps={{ role: 'tablist', 'aria-label': 'Kategorie zniżek' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter.category === 'all'}
            onClick={() => setFilter((f) => ({ ...f, category: 'all' }))}
            className={`${FILTER_PILL.base} ${filter.category === 'all' ? FILTER_PILL.active : FILTER_PILL.inactive}`}
          >
            Wszystko
          </button>
          {DISCOUNT_CATEGORIES.map((cat) => {
            const meta = DISCOUNT_CATEGORY_META[cat]
            const Icon = ICON_MAP[meta.icon]
            const active = filter.category === cat
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter((f) => ({ ...f, category: cat as DiscountCategory }))}
                className={`${FILTER_PILL.base} ${active ? FILTER_PILL.active : FILTER_PILL.inactive}`}
              >
                <Icon size={13} strokeWidth={2} aria-hidden />
                {meta.label}
              </button>
            )
          })}
        </HorizontalPillScroller>
      </motion.section>

      {/* Geo hint */}
      {hasGeo && (
        <p className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          <MapPin size={11} className="text-emerald-600 dark:text-emerald-400" />
          Posortowane wg odległości od Ciebie · ≤ 500m podświetlone na zielono
        </p>
      )}

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-[12.5px] text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </p>
      )}

      {/* ── Grid / empty ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading && sortedDiscounts.length === 0 ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={EVENTS_HUB.section.gridClass}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]"
              />
            ))}
          </motion.div>
        ) : isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={EVENTS_HUB.empty.wrapClass}
          >
            <div className={EVENTS_HUB.empty.iconBubbleClass}>
              <Sparkles size={24} strokeWidth={1.8} />
            </div>
            <p className={EVENTS_HUB.empty.titleClass}>
              {isFilteredOrSearching ? 'Brak wyników' : 'Brak zniżek'}
            </p>
            <p className={EVENTS_HUB.empty.subtitleClass}>
              {isFilteredOrSearching
                ? 'Spróbuj zmienić filtry albo wyszukać czegoś innego.'
                : 'Bądź pierwszy — dodaj zniżkę, którą znasz i pomóż reszcie rocznika.'}
            </p>
            <div className={EVENTS_HUB.empty.hintsWrapClass}>
              {isFilteredOrSearching ? (
                <>
                  <button
                    type="button"
                    onClick={() => setFilter({ category: 'all', search: '', sort: 'use', verifiedOnly: false })}
                    className={EVENTS_HUB.empty.hintChipClass}
                  >
                    Pokaż wszystkie
                  </button>
                  {filter.search.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilter((f) => ({ ...f, search: '' }))}
                      className={EVENTS_HUB.empty.hintChipClass}
                    >
                      Wyczyść wyszukiwanie
                    </button>
                  )}
                </>
              ) : userId ? (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className={EVENTS_HUB.empty.hintChipClass}
                >
                  <Plus size={12} strokeWidth={2.4} />
                  Dodaj pierwszą zniżkę
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            variants={EVENTS_HUB.motion.grid}
            initial="hidden"
            animate="show"
            className={EVENTS_HUB.section.gridClass}
          >
            {sortedDiscounts.map((d) => (
              <motion.div key={d.id} variants={EVENTS_HUB.motion.item} className="min-w-0">
                <DiscountCard
                  discount={d}
                  taken={myUsedIds.has(d.id)}
                  onOpenDetail={handleOpenDetail}
                  onMarkUse={markUse}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modale */}
      {detailDiscount && (
        <DiscountDetailModal
          discount={detailDiscount}
          myUserId={userId}
          isTaken={myUsedIds.has(detailDiscount.id)}
          onClose={() => setDetailDiscount(null)}
          onMarkUse={(id) => {
            void markUse(id)
            setDetailDiscount((prev) =>
              prev && prev.id === id
                ? { ...prev, use_count: prev.use_count + (myUsedIds.has(id) ? 0 : 1) }
                : prev,
            )
          }}
        />
      )}

      {formOpen && userId && (
        <DiscountFormModal
          userId={userId}
          onClose={() => setFormOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </motion.div>
  )
}
