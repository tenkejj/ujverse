/**
 * UJverse — MiejscaNaukiView: katalog miejsc do nauki w Krakowie.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Design 1:1 z `EventsView` — 2-kolumnowy grid na lg+ (main content + side rail),
 * sticky toolbar, hero spotlight, grupy per typ miejsca, responsive cards grid
 * (`EVENTS_HUB.section.gridClass` rośnie do 4 kolumn na 2xl).
 *
 * Layout:
 *   ┌───────────────────────────────┬────────────┐
 *   │ Toolbar (sticky)              │ Side rail  │
 *   │ Aktywny check-in banner       │ - status   │
 *   │ Hero (top spot)               │ - stats    │
 *   │ Sekcja "Biblioteki UJ"        │ - filtruj  │
 *   │ Sekcja "Kawiarnie"            │            │
 *   │ Sekcja "Coworking"            │            │
 *   │ Sekcja "Plener"               │            │
 *   │ Sekcja "Inne"                 │            │
 *   └───────────────────────────────┴────────────┘
 */
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  Building2,
  Coffee,
  Laptop,
  Library,
  List,
  Map as MapIcon,
  Plus,
  Radio,
  Search,
  Trees,
  Wallet,
  X,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { EVENTS_HUB, EVENTS_TOOLBAR, FILTER_PILL } from '../../styles/mobile-theme'
import StudySpotCard from './StudySpotCard'
import StudySpotDetailModal from './StudySpotDetailModal'
import StudySpotFormModal from './StudySpotFormModal'
import MiejscaHero from './MiejscaHero'
import MiejscaSideRail, { type SideRailKindFilter } from './MiejscaSideRail'
import { useStudySpots } from '../../hooks/useStudySpots'
import {
  STUDY_SPOT_KIND_META,
  type StudySpotFilter,
  type StudySpotKind,
  type StudySpotWithUserState,
} from '../../types/studySpots'

const MiejscaMap = lazy(() => import('./MiejscaMap'))

type Props = {
  session: Session | null
  onNavigateToProfile?: (username: string) => void
}

type ViewMode = 'list' | 'map'

const SORT_LABELS: Record<StudySpotFilter['sort'], string> = {
  people: 'Live presence',
  rating: 'Najlepiej oceniane',
  name: 'Alfabetycznie',
}

/** Grupy widokowe — zbierają STUDY_SPOT_KINDS w sensowne sekcje. */
const GROUP_DEFS = [
  {
    key: 'libraries',
    label: 'Biblioteki UJ i czytelnie',
    subtitle: 'BJ + czytelnie wydziałowe (legitymacja, eduroam)',
    icon: Library,
    kinds: ['library_uj', 'library_other'] as StudySpotKind[],
  },
  {
    key: 'cafes',
    label: 'Kawiarnie przyjazne laptopom',
    subtitle: 'Kawa + wifi + długie stoły',
    icon: Coffee,
    kinds: ['cafe'] as StudySpotKind[],
  },
  {
    key: 'coworking',
    label: 'Coworking',
    subtitle: 'Płatne biurka z szybkim wifi i pakietami dziennymi',
    icon: Laptop,
    kinds: ['coworking'] as StudySpotKind[],
  },
  {
    key: 'outdoor',
    label: 'Dziedzińce i plenery',
    subtitle: 'Świeże powietrze do lekkich powtórek',
    icon: Trees,
    kinds: ['courtyard'] as StudySpotKind[],
  },
  {
    key: 'other',
    label: 'Inne miejsca',
    subtitle: 'Akademiki, sale samodzielnej nauki',
    icon: Building2,
    kinds: ['akademik', 'other'] as StudySpotKind[],
  },
] as const

/** Side-rail filter list — same kindy + "Wszystko". */
const SIDE_RAIL_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Wszystko' },
  { key: 'library_uj', label: STUDY_SPOT_KIND_META.library_uj.label },
  { key: 'cafe', label: STUDY_SPOT_KIND_META.cafe.label },
  { key: 'coworking', label: STUDY_SPOT_KIND_META.coworking.label },
  { key: 'courtyard', label: STUDY_SPOT_KIND_META.courtyard.label },
  { key: 'library_other', label: STUDY_SPOT_KIND_META.library_other.label },
  { key: 'akademik', label: STUDY_SPOT_KIND_META.akademik.label },
  { key: 'other', label: STUDY_SPOT_KIND_META.other.label },
]

export default function MiejscaNaukiView({ session, onNavigateToProfile }: Props) {
  const userId = session?.user?.id ?? null
  const {
    spots,
    allSpots,
    myActiveSpot,
    loading,
    error,
    filter,
    setFilter,
    toggleCheckIn,
    submitRating,
    createSpot,
    uploadPhoto,
    removePhoto,
  } = useStudySpots({ session })

  const [detailSpot, setDetailSpot] = useState<StudySpotWithUserState | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Hero: aktywny check-in usera > top live > top rated > pierwszy
  const heroSpot = useMemo<StudySpotWithUserState | null>(() => {
    if (allSpots.length === 0) return null
    const withLive = allSpots
      .filter((s) => s.active_checkins_count > 0)
      .sort((a, b) => {
        if (b.active_checkins_count !== a.active_checkins_count) {
          return b.active_checkins_count - a.active_checkins_count
        }
        return (b.rating_avg ?? 0) - (a.rating_avg ?? 0)
      })
    if (withLive.length > 0) return withLive[0]
    const rated = allSpots
      .filter((s) => s.rating_avg != null)
      .sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0))
    return rated[0] ?? allSpots[0]
  }, [allSpots])

  // Side rail liczniki — z całej listy nie z filtered
  const sideFilters = useMemo<SideRailKindFilter[]>(
    () =>
      SIDE_RAIL_FILTERS.map((f) => ({
        key: f.key,
        label: f.label,
        count:
          f.key === 'all'
            ? allSpots.length
            : allSpots.filter((s) => s.kind === f.key).length,
      })),
    [allSpots],
  )

  // Statystyki — w side rail
  const stats = useMemo(() => {
    const liveCount = allSpots.reduce((acc, s) => acc + s.active_checkins_count, 0)
    const rated = allSpots.filter((s) => s.rating_avg != null && s.rating_count > 0)
    const avgRating =
      rated.length > 0
        ? rated.reduce((acc, s) => acc + (s.rating_avg ?? 0), 0) / rated.length
        : null
    return { total: allSpots.length, liveCount, avgRating }
  }, [allSpots])

  // Grupy widokowe z aktualnie filtrowanych spotów
  const groups = useMemo(() => {
    return GROUP_DEFS.map((g) => ({
      ...g,
      spots: spots.filter((s) => g.kinds.includes(s.kind)),
    })).filter((g) => g.spots.length > 0)
  }, [spots])

  const handleOpenDetail = useCallback(
    (spot: StudySpotWithUserState) => setDetailSpot(spot),
    [],
  )

  const liveDetail = useMemo(
    () => (detailSpot ? allSpots.find((s) => s.id === detailSpot.id) ?? null : null),
    [detailSpot, allSpots],
  )

  const isEmpty = !loading && spots.length === 0
  const isFilteredOrSearching =
    filter.kind !== 'all' ||
    filter.search.trim().length > 0 ||
    filter.freeOnly ||
    filter.withPeopleOnly

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <motion.div
        variants={EVENTS_HUB.motion.page}
        initial="hidden"
        animate="show"
        className="min-w-0 space-y-6"
      >
        {/* ── Toolbar ────────────────────────────────────────────────── */}
        <div className={EVENTS_HUB.toolbar.stickyWrapClass}>
          <div className={EVENTS_HUB.toolbar.rowClass}>
            <div className={EVENTS_HUB.toolbar.pillsWrapClass}>
              {/* Segmented control: Lista / Mapa */}
              <div
                className="relative inline-flex items-stretch rounded-full border border-zinc-200/80 bg-white/85 p-0.5 backdrop-blur-md dark:border-white/10 dark:bg-bg-card/80"
                role="tablist"
                aria-label="Widok miejsc"
              >
                {[
                  { key: 'list' as ViewMode, label: 'Lista', Icon: List },
                  { key: 'map' as ViewMode, label: 'Mapa', Icon: MapIcon },
                ].map(({ key, label, Icon }) => {
                  const active = viewMode === key
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setViewMode(key)}
                      className="relative inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide transition-colors"
                    >
                      {active && (
                        <motion.span
                          layoutId="miejsca-view-bg"
                          className="absolute inset-0 rounded-full bg-[#1e293b] dark:bg-[#D4AF37]"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon
                        size={13}
                        strokeWidth={2.4}
                        className={`relative z-[1] shrink-0 transition-colors ${active ? 'text-white dark:text-[#1e293b]' : 'text-zinc-600 dark:text-zinc-400'}`}
                        aria-hidden
                      />
                      <span
                        className={`relative z-[1] transition-colors ${active ? 'text-white dark:text-[#1e293b]' : 'text-zinc-600 dark:text-zinc-400'}`}
                      >
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => setFilter((f) => ({ ...f, withPeopleOnly: !f.withPeopleOnly }))}
                className={`${FILTER_PILL.base} ${filter.withPeopleOnly ? FILTER_PILL.active : FILTER_PILL.inactive}`}
                title="Pokaż tylko miejsca z aktywnymi check-inami"
              >
                <Radio size={14} strokeWidth={2.2} aria-hidden />
                Live teraz
              </button>
              <button
                type="button"
                onClick={() => setFilter((f) => ({ ...f, freeOnly: !f.freeOnly }))}
                className={`${FILTER_PILL.base} ${filter.freeOnly ? FILTER_PILL.active : FILTER_PILL.inactive}`}
                title="Pokaż tylko darmowe miejsca"
              >
                <Wallet size={14} strokeWidth={2.2} aria-hidden />
                Darmowe
              </button>
            </div>
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
                  placeholder="Szukaj: biblioteka, kawa, kazimierz..."
                  className={EVENTS_TOOLBAR.searchInner}
                  aria-label="Szukaj miejsc"
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
                  setFilter((f) => ({ ...f, sort: e.target.value as StudySpotFilter['sort'] }))
                }
                className="h-10 rounded-2xl border border-zinc-200 bg-white/80 px-3 text-[12.5px] font-medium text-zinc-700 backdrop-blur-md transition-colors focus:border-[#1e293b]/40 focus:outline-none dark:border-white/10 dark:bg-black/25 dark:text-zinc-200"
                aria-label="Sortuj"
              >
                {(Object.entries(SORT_LABELS) as Array<[StudySpotFilter['sort'], string]>).map(([slug, label]) => (
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
                Dodaj miejsce
              </button>
            </div>
          </div>
        </div>

        {/* ── Aktywny check-in: skrót-pasek ─────────────────────────── */}
        {myActiveSpot && (
          <motion.section
            variants={EVENTS_HUB.motion.fadeUp}
            className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 backdrop-blur-md dark:border-emerald-500/30 dark:bg-emerald-500/10"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                Jesteś teraz tutaj
              </p>
              <button
                type="button"
                onClick={() => handleOpenDetail(myActiveSpot)}
                className="mt-0.5 truncate text-left text-sm font-bold text-emerald-900 hover:underline dark:text-emerald-100"
              >
                {myActiveSpot.name}
              </button>
              <p className="truncate text-[11.5px] text-emerald-800/80 dark:text-emerald-200/80">
                {myActiveSpot.address}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleCheckIn(myActiveSpot.id, 'focus')}
              className="shrink-0 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 hover:bg-white dark:bg-white/[0.12] dark:text-emerald-200 dark:hover:bg-white/[0.18]"
            >
              Wymelduj
            </button>
          </motion.section>
        )}

        {/* ── Error ────────────────────────────────────────────────── */}
        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-[12.5px] text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
            {error}
          </p>
        )}

        {/* ── Body: loading / empty / hero+groups / mapa ──────────── */}
        <AnimatePresence mode="wait">
          {viewMode === 'map' && !loading && spots.length > 0 ? (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Suspense
                fallback={
                  <div className="h-[68vh] min-h-[420px] animate-pulse rounded-3xl bg-black/[0.05] dark:bg-white/[0.04]" />
                }
              >
                <MiejscaMap spots={spots} onPickSpot={handleOpenDetail} />
              </Suspense>
            </motion.div>
          ) : loading && allSpots.length === 0 ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="h-72 animate-pulse rounded-3xl bg-black/[0.05] dark:bg-white/[0.04]" />
              <div className={EVENTS_HUB.section.gridClass}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-72 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]"
                  />
                ))}
              </div>
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
                <BookOpen size={24} strokeWidth={1.8} />
              </div>
              <p className={EVENTS_HUB.empty.titleClass}>
                {isFilteredOrSearching ? 'Brak wyników' : 'Brak miejsc'}
              </p>
              <p className={EVENTS_HUB.empty.subtitleClass}>
                {isFilteredOrSearching
                  ? 'Spróbuj zmienić filtry albo wyszukać czegoś innego.'
                  : 'Dodaj pierwsze miejsce do nauki — pomoc dla całej społeczności UJ.'}
              </p>
              <div className={EVENTS_HUB.empty.hintsWrapClass}>
                {isFilteredOrSearching ? (
                  <button
                    type="button"
                    onClick={() =>
                      setFilter({
                        kind: 'all',
                        search: '',
                        sort: 'people',
                        freeOnly: false,
                        withPeopleOnly: false,
                      })
                    }
                    className={EVENTS_HUB.empty.hintChipClass}
                  >
                    Pokaż wszystkie
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    disabled={!userId}
                    className={EVENTS_HUB.empty.hintChipClass}
                  >
                    <Plus size={12} strokeWidth={2.4} />
                    Dodaj pierwsze miejsce
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              variants={EVENTS_HUB.motion.page}
              initial="hidden"
              animate="show"
              className="space-y-8"
            >
              {/* Hero spotlight: tylko gdy NIE filtrujemy (żeby nie ginęło) */}
              {heroSpot && !isFilteredOrSearching && (
                <MiejscaHero spot={heroSpot} onOpen={handleOpenDetail} />
              )}

              {groups.map((group) => {
                const Icon = group.icon
                return (
                  <motion.section
                    key={group.key}
                    variants={EVENTS_HUB.motion.fadeUp}
                    className={EVENTS_HUB.section.wrapClass}
                    aria-label={group.label}
                  >
                    <header className={EVENTS_HUB.section.headerClass}>
                      <h2 className={EVENTS_HUB.section.titleClass}>
                        <Icon size={12} strokeWidth={2.25} className={EVENTS_HUB.section.titleIconClass} aria-hidden />
                        {group.label}
                        <span className={EVENTS_HUB.section.countBadgeClass}>
                          {group.spots.length}
                        </span>
                      </h2>
                      <span className={EVENTS_HUB.section.subtitleClass}>{group.subtitle}</span>
                    </header>

                    <motion.div
                      variants={EVENTS_HUB.motion.grid}
                      className={EVENTS_HUB.section.gridClass}
                    >
                      {group.spots.map((spot) => (
                        <motion.div key={spot.id} variants={EVENTS_HUB.motion.item}>
                          <StudySpotCard
                            spot={spot}
                            onOpen={handleOpenDetail}
                            onCheckIn={toggleCheckIn}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.section>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Side rail (desktop only) ────────────────────────────── */}
      <div className="hidden lg:block">
        <MiejscaSideRail
          stats={stats}
          filters={sideFilters}
          activeFilterKey={filter.kind}
          onFilterChange={(key) =>
            setFilter((f) => ({ ...f, kind: key === 'all' ? 'all' : (key as StudySpotKind) }))
          }
        />
      </div>

      <StudySpotDetailModal
        spot={liveDetail}
        currentUserId={userId}
        onClose={() => setDetailSpot(null)}
        onCheckIn={toggleCheckIn}
        onSubmitRating={(spotId, overall, extra) => submitRating(spotId, overall, extra)}
        onUploadPhoto={uploadPhoto}
        onRemovePhoto={removePhoto}
        onNavigateToProfile={onNavigateToProfile}
      />

      <StudySpotFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreate={createSpot}
      />
    </div>
  )
}
