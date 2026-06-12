/**
 * UJverse — MiejscaNaukiView: katalog miejsc do nauki w Krakowie.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Design language wyrównany z `UsosRegistrationsView` / `ZniskiView` /
 * `EventsView`. Sekcje:
 *   1. Static toolbar — pills filtru (Live presence, Tylko darmowe) + search + sort + "Dodaj".
 *   2. Sekcja "Kto teraz się uczy" (HorizontalPillScroller) — top 10 spotów po active_checkins.
 *   3. Sekcja "Typ miejsca" — HorizontalPillScroller pigułek kind.
 *   4. Grid kart wszystkich miejsc.
 *   5. Empty state.
 */
import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  Plus,
  Radio,
  Search,
  Tag,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import HorizontalPillScroller from '../ui/HorizontalPillScroller'
import { EVENTS_HUB, EVENTS_TOOLBAR, FILTER_PILL } from '../../styles/mobile-theme'
import StudySpotCard from './StudySpotCard'
import StudySpotDetailModal from './StudySpotDetailModal'
import StudySpotFormModal from './StudySpotFormModal'
import { useStudySpots } from '../../hooks/useStudySpots'
import {
  STUDY_SPOT_KINDS,
  STUDY_SPOT_KIND_META,
  type StudySpotFilter,
  type StudySpotKind,
  type StudySpotWithUserState,
} from '../../types/studySpots'

type Props = {
  session: Session | null
}

const SORT_LABELS: Record<StudySpotFilter['sort'], string> = {
  people: 'Live presence',
  rating: 'Najlepiej oceniane',
  name: 'Alfabetycznie',
}

const SCROLLER_TRACK_CLS =
  'flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide ' +
  'overscroll-x-contain [-webkit-overflow-scrolling:touch] min-w-0'

export default function MiejscaNaukiView({ session }: Props) {
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
  } = useStudySpots({ session })

  const [detailSpot, setDetailSpot] = useState<StudySpotWithUserState | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const topActive = useMemo(
    () =>
      allSpots
        .filter((s) => s.active_checkins_count > 0)
        .sort((a, b) => b.active_checkins_count - a.active_checkins_count)
        .slice(0, 10),
    [allSpots],
  )

  const handleOpenDetail = useCallback(
    (spot: StudySpotWithUserState) => setDetailSpot(spot),
    [],
  )

  // Keep detail modal in sync z najnowszymi danymi (po refetch)
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
    <motion.div
      variants={EVENTS_HUB.motion.page}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-6"
    >
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className={EVENTS_HUB.toolbar.stickyWrapClass}>
        <div className={EVENTS_HUB.toolbar.rowClass}>
          <div className={EVENTS_HUB.toolbar.pillsWrapClass}>
            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, withPeopleOnly: !f.withPeopleOnly }))}
              className={`${FILTER_PILL.base} ${filter.withPeopleOnly ? FILTER_PILL.active : FILTER_PILL.inactive}`}
              title="Pokaż tylko miejsca w których ktoś teraz jest"
            >
              <Radio size={13} strokeWidth={2.2} aria-hidden />
              Live teraz
            </button>
            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, freeOnly: !f.freeOnly }))}
              className={`${FILTER_PILL.base} ${filter.freeOnly ? FILTER_PILL.active : FILTER_PILL.inactive}`}
              title="Pokaż tylko darmowe miejsca"
            >
              <Wallet size={13} strokeWidth={2.2} aria-hidden />
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

      {/* ── Aktywny check-in: pasek skrótowy ─────────────────────────── */}
      {myActiveSpot && (
        <motion.section
          variants={EVENTS_HUB.motion.fadeUp}
          className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 backdrop-blur-md dark:border-emerald-500/30 dark:bg-emerald-500/10"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Jesteś teraz tutaj
              </p>
              <button
                type="button"
                onClick={() => handleOpenDetail(myActiveSpot)}
                className="mt-0.5 text-left text-[14px] font-bold text-emerald-900 hover:underline dark:text-emerald-100"
              >
                {myActiveSpot.name}
              </button>
              <p className="text-[11.5px] text-emerald-800/80 dark:text-emerald-200/80">
                {myActiveSpot.address}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleCheckIn(myActiveSpot.id, 'focus')}
              className="rounded-full bg-white/80 px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-emerald-700 hover:bg-white dark:bg-white/[0.1] dark:text-emerald-200 dark:hover:bg-white/[0.15]"
            >
              Wymelduj
            </button>
          </div>
        </motion.section>
      )}

      {/* ── Top live (HorizontalPillScroller) ────────────────────────── */}
      {topActive.length > 0 && (
        <motion.section
          variants={EVENTS_HUB.motion.fadeUp}
          className={EVENTS_HUB.section.wrapClass}
          aria-label="Kto teraz się uczy"
        >
          <div className={EVENTS_HUB.section.headerClass}>
            <div className={EVENTS_HUB.section.titleClass}>
              <Users size={14} className={EVENTS_HUB.section.titleIconClass} strokeWidth={2.2} />
              Kto teraz się uczy
            </div>
            <span className={EVENTS_HUB.section.countBadgeClass}>{topActive.length}</span>
          </div>

          <HorizontalPillScroller
            scrollClassName={SCROLLER_TRACK_CLS + ' pb-1'}
            watchDeps={[topActive.length, topActive[0]?.id]}
            scrollLeftLabel="Przewiń w lewo"
            scrollRightLabel="Przewiń w prawo"
            withMobileEdgeSpacer={false}
          >
            {topActive.map((spot) => {
              const meta = STUDY_SPOT_KIND_META[spot.kind]
              const KindIcon = meta.icon
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => handleOpenDetail(spot)}
                  className="group flex w-64 shrink-0 flex-col items-start gap-1 rounded-2xl border border-zinc-200/70 bg-white/80 px-3.5 py-2.5 text-left backdrop-blur-xl backdrop-saturate-150 transition-colors hover:border-emerald-400/40 hover:bg-white dark:border-white/10 dark:bg-zinc-950/45 dark:hover:border-emerald-400/30 dark:hover:bg-zinc-900/60"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${meta.tintClass}`}>
                      <KindIcon size={10} strokeWidth={2.3} />
                      {meta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <Users size={10} strokeWidth={2.6} />
                      {spot.active_checkins_count}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                    {spot.name}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {spot.address}
                  </p>
                </button>
              )
            })}
          </HorizontalPillScroller>
        </motion.section>
      )}

      {/* ── Typ miejsca (filter pills) ─────────────────────────────────── */}
      <motion.section
        variants={EVENTS_HUB.motion.fadeUp}
        className={EVENTS_HUB.section.wrapClass}
        aria-label="Typ miejsca"
      >
        <div className={EVENTS_HUB.section.headerClass}>
          <div className={EVENTS_HUB.section.titleClass}>
            <Tag size={13} className={EVENTS_HUB.section.titleIconClass} strokeWidth={2.2} />
            Typ miejsca
          </div>
          {filter.kind !== 'all' && (
            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, kind: 'all' }))}
              className={EVENTS_HUB.section.subtitleClass + ' hover:underline'}
            >
              Wyczyść
            </button>
          )}
        </div>

        <HorizontalPillScroller
          scrollClassName={SCROLLER_TRACK_CLS}
          watchDeps={[filter.kind]}
          scrollLeftLabel="Przewiń typy w lewo"
          scrollRightLabel="Przewiń typy w prawo"
          withMobileEdgeSpacer={false}
          scrollProps={{ role: 'tablist', 'aria-label': 'Typ miejsca' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter.kind === 'all'}
            onClick={() => setFilter((f) => ({ ...f, kind: 'all' }))}
            className={`${FILTER_PILL.base} ${filter.kind === 'all' ? FILTER_PILL.active : FILTER_PILL.inactive}`}
          >
            Wszystko
          </button>
          {STUDY_SPOT_KINDS.map((k) => {
            const meta = STUDY_SPOT_KIND_META[k]
            const Icon = meta.icon
            const active = filter.kind === k
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter((f) => ({ ...f, kind: k as StudySpotKind }))}
                className={`${FILTER_PILL.base} ${active ? FILTER_PILL.active : FILTER_PILL.inactive}`}
              >
                <Icon size={13} strokeWidth={2} aria-hidden />
                {meta.label}
              </button>
            )
          })}
        </HorizontalPillScroller>
      </motion.section>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-[12.5px] text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </p>
      )}

      {/* ── Grid / empty ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading && spots.length === 0 ? (
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
                className="h-48 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]"
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
                  Wyczyść filtry
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
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={EVENTS_HUB.section.gridClass}
          >
            {spots.map((spot) => (
              <StudySpotCard
                key={spot.id}
                spot={spot}
                onOpen={handleOpenDetail}
                onCheckIn={toggleCheckIn}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <StudySpotDetailModal
        spot={liveDetail}
        onClose={() => setDetailSpot(null)}
        onCheckIn={toggleCheckIn}
        onSubmitRating={(spotId, overall, extra) => submitRating(spotId, overall, extra)}
      />

      <StudySpotFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreate={createSpot}
      />
    </motion.div>
  )
}
