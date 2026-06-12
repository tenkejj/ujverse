/**
 * UJverse — UsosRegistrationsView: katalog rejestracji USOS + alarmy.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Design language wyrównany z `ZniskiView` / `EventsView` (EVENTS_HUB.* +
 * FILTER_PILL + EVENTS_TOOLBAR + HorizontalPillScroller). Sekcje:
 *
 *   1. Static toolbar — pills filtru ("Mój rocznik" + "Tylko subskrybowane")
 *      + actions (search, sort, "Dodaj rejestrację").
 *   2. Sekcja "Następne rejestracje" (HorizontalPillScroller) — moje
 *      subskrybowane upcoming, sortowane po dacie startu. Każda jest
 *      kompaktową kartą z countdown.
 *   3. Sekcja "Typ rejestracji" — HorizontalPillScroller pigułek kind.
 *   4. Grid kart wszystkich rejestracji.
 *   5. Empty state.
 */
import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  BookOpen,
  Clock,
  Dumbbell,
  GraduationCap,
  Languages,
  Plus,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import HorizontalPillScroller from '../ui/HorizontalPillScroller'
import { EVENTS_HUB, EVENTS_TOOLBAR, FILTER_PILL } from '../../styles/mobile-theme'
import UsosRegistrationCard from './UsosRegistrationCard'
import UsosRegistrationDetailModal from './UsosRegistrationDetailModal'
import UsosRegistrationFormModal from './UsosRegistrationFormModal'
import { useUsosRegistrations } from '../../hooks/useUsosRegistrations'
import {
  REGISTRATION_KINDS,
  REGISTRATION_KIND_META,
  computeCountdown,
  type RegistrationFilter,
  type RegistrationKind,
  type UsosRegistration,
} from '../../types/usosRegistrations'

type Props = {
  userId: string | null
  studyProgram?: string | null
  yearStarted?: number | null
}

const ICON_MAP = {
  BookOpen,
  Languages,
  Dumbbell,
  GraduationCap,
  Sparkles,
  Tag,
} as const

const SORT_LABELS: Record<RegistrationFilter['sort'], string> = {
  opens: 'Najbliższe',
  subscribers: 'Najpopularniejsze',
  created: 'Najnowsze',
}

const SCROLLER_TRACK_CLS =
  'flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide ' +
  'overscroll-x-contain [-webkit-overflow-scrolling:touch] min-w-0'

const UPCOMING_TRACK_CLS = SCROLLER_TRACK_CLS + ' pb-1'

function fmtDateTimeShort(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function UsosRegistrationsView({ userId, studyProgram, yearStarted }: Props) {
  const {
    filter,
    setFilter,
    registrations,
    mySubscribedIds,
    upcoming,
    loading,
    upcomingLoading,
    error,
    refresh,
    refreshUpcoming,
    toggleSubscribe,
    derivedYear,
  } = useUsosRegistrations({ userId, studyProgram, yearStarted })

  const [detailReg, setDetailReg] = useState<UsosRegistration | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const handleOpenDetail = useCallback(
    (id: string) => {
      const found = registrations.find((r) => r.id === id)
      if (found) setDetailReg(found)
    },
    [registrations],
  )

  const handleCreated = useCallback(() => {
    setFormOpen(false)
    void refresh()
    void refreshUpcoming()
  }, [refresh, refreshUpcoming])

  const isEmpty = !loading && registrations.length === 0
  const isFilteredOrSearching =
    filter.kind !== 'all' ||
    filter.search.trim().length > 0 ||
    filter.myProgramOnly ||
    filter.subscribedOnly

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
              onClick={() => setFilter((f) => ({ ...f, subscribedOnly: !f.subscribedOnly }))}
              className={`${FILTER_PILL.base} ${filter.subscribedOnly ? FILTER_PILL.active : FILTER_PILL.inactive}`}
              title="Pokaż tylko te z włączonym alarmem"
            >
              <Bell size={13} strokeWidth={2.2} aria-hidden />
              Moje alarmy
            </button>
            {studyProgram && (
              <button
                type="button"
                onClick={() => setFilter((f) => ({ ...f, myProgramOnly: !f.myProgramOnly }))}
                className={`${FILTER_PILL.base} ${filter.myProgramOnly ? FILTER_PILL.active : FILTER_PILL.inactive}`}
                title={`Pokaż tylko rejestracje dla ${studyProgram}${derivedYear ? ` (${derivedYear} rok)` : ''}`}
              >
                <GraduationCap size={13} strokeWidth={2.2} aria-hidden />
                {derivedYear ? `${studyProgram} · ${derivedYear} rok` : studyProgram}
              </button>
            )}
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
                placeholder="Szukaj: obieralne, lektorat..."
                className={EVENTS_TOOLBAR.searchInner}
                aria-label="Szukaj rejestracji"
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
                setFilter((f) => ({ ...f, sort: e.target.value as RegistrationFilter['sort'] }))
              }
              className="h-10 rounded-2xl border border-zinc-200 bg-white/80 px-3 text-[12.5px] font-medium text-zinc-700 backdrop-blur-md transition-colors focus:border-[#1e293b]/40 focus:outline-none dark:border-white/10 dark:bg-black/25 dark:text-zinc-200"
              aria-label="Sortuj"
            >
              {(Object.entries(SORT_LABELS) as Array<[RegistrationFilter['sort'], string]>).map(([slug, label]) => (
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
              Dodaj rejestrację
            </button>
          </div>
        </div>
      </div>

      {/* ── Moje nadchodzące alarmy ────────────────────────────────────── */}
      {(upcoming.length > 0 || upcomingLoading) && (
        <motion.section
          variants={EVENTS_HUB.motion.fadeUp}
          className={EVENTS_HUB.section.wrapClass}
          aria-label="Moje nadchodzące alarmy"
        >
          <div className={EVENTS_HUB.section.headerClass}>
            <div className={EVENTS_HUB.section.titleClass}>
              <Bell size={14} className={EVENTS_HUB.section.titleIconClass} strokeWidth={2.2} />
              Twoje nadchodzące alarmy
            </div>
            {!upcomingLoading && upcoming.length > 0 && (
              <span className={EVENTS_HUB.section.countBadgeClass}>{upcoming.length}</span>
            )}
          </div>

          {upcomingLoading ? (
            <div className="flex gap-2 overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 w-72 shrink-0 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]"
                />
              ))}
            </div>
          ) : (
            <HorizontalPillScroller
              scrollClassName={UPCOMING_TRACK_CLS}
              watchDeps={[upcoming.length]}
              scrollLeftLabel="Przewiń alarmy w lewo"
              scrollRightLabel="Przewiń alarmy w prawo"
              withMobileEdgeSpacer={false}
            >
              {upcoming.map((u) => {
                const cd = computeCountdown(u.opens_at, u.closes_at)
                const kindMeta = REGISTRATION_KIND_META[u.kind]
                const KindIcon = ICON_MAP[kindMeta.icon]
                return (
                  <button
                    key={u.registration_id}
                    type="button"
                    onClick={() => handleOpenDetail(u.registration_id)}
                    className="group flex w-72 shrink-0 flex-col items-start gap-1 rounded-2xl border border-zinc-200/70 bg-white/80 px-3.5 py-2.5 text-left backdrop-blur-xl backdrop-saturate-150 transition-colors hover:border-[#1e293b]/25 hover:bg-white dark:border-white/10 dark:bg-zinc-950/45 dark:hover:border-brand-gold-bright/30 dark:hover:bg-zinc-900/60"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${kindMeta.tint}`}>
                        <KindIcon size={10} strokeWidth={2.3} />
                        {kindMeta.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
                        cd.phase === 'critical' || cd.phase === 'urgent'
                          ? 'text-red-700 dark:text-red-300'
                          : cd.phase === 'live'
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-[#1e293b] dark:text-brand-gold-bright'
                      }`}>
                        <Clock size={10} strokeWidth={2.3} />
                        {cd.compact}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                      {u.title}
                    </p>
                    <p className="line-clamp-1 text-[11.5px] font-semibold text-[#1e293b] dark:text-brand-gold-bright">
                      {u.audience_label ?? [u.study_program, u.year ? `${u.year} rok` : null].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {fmtDateTimeShort(u.opens_at)}
                    </p>
                  </button>
                )
              })}
            </HorizontalPillScroller>
          )}
        </motion.section>
      )}

      {/* ── Typ rejestracji (filter pills) ─────────────────────────────── */}
      <motion.section
        variants={EVENTS_HUB.motion.fadeUp}
        className={EVENTS_HUB.section.wrapClass}
        aria-label="Typ rejestracji"
      >
        <div className={EVENTS_HUB.section.headerClass}>
          <div className={EVENTS_HUB.section.titleClass}>
            <Tag size={13} className={EVENTS_HUB.section.titleIconClass} strokeWidth={2.2} />
            Typ rejestracji
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
          scrollProps={{ role: 'tablist', 'aria-label': 'Typ rejestracji' }}
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
          {REGISTRATION_KINDS.map((k) => {
            const meta = REGISTRATION_KIND_META[k]
            const Icon = ICON_MAP[meta.icon]
            const active = filter.kind === k
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter((f) => ({ ...f, kind: k as RegistrationKind }))}
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
        {loading && registrations.length === 0 ? (
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
              <Bell size={24} strokeWidth={1.8} />
            </div>
            <p className={EVENTS_HUB.empty.titleClass}>
              {isFilteredOrSearching ? 'Brak wyników' : 'Brak rejestracji'}
            </p>
            <p className={EVENTS_HUB.empty.subtitleClass}>
              {isFilteredOrSearching
                ? 'Spróbuj zmienić filtry albo wyszukać czegoś innego.'
                : 'Bądź pierwszy — dodaj rejestrację o której wiesz i pomóż reszcie rocznika nie przegapić.'}
            </p>
            <div className={EVENTS_HUB.empty.hintsWrapClass}>
              {isFilteredOrSearching ? (
                <button
                  type="button"
                  onClick={() => setFilter({
                    kind: 'all',
                    search: '',
                    sort: 'opens',
                    myProgramOnly: false,
                    subscribedOnly: false,
                  })}
                  className={EVENTS_HUB.empty.hintChipClass}
                >
                  Pokaż wszystkie
                </button>
              ) : userId ? (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className={EVENTS_HUB.empty.hintChipClass}
                >
                  <Plus size={12} strokeWidth={2.4} />
                  Dodaj pierwszą rejestrację
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
            {registrations.map((r) => (
              <motion.div key={r.id} variants={EVENTS_HUB.motion.item} className="min-w-0">
                <UsosRegistrationCard
                  registration={r}
                  subscribed={mySubscribedIds.has(r.id)}
                  onOpenDetail={handleOpenDetail}
                  onToggleSubscribe={toggleSubscribe}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {detailReg && (
        <UsosRegistrationDetailModal
          registration={detailReg}
          subscribed={mySubscribedIds.has(detailReg.id)}
          onClose={() => setDetailReg(null)}
          onToggleSubscribe={(id) => {
            void toggleSubscribe(id)
          }}
        />
      )}

      {formOpen && userId && (
        <UsosRegistrationFormModal
          userId={userId}
          defaultStudyProgram={studyProgram}
          defaultYear={derivedYear}
          onClose={() => setFormOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </motion.div>
  )
}
