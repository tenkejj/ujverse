/**
 * Kompozycja Start — desktop „board”, nie lista.
 * Spotlight (pilne) + bento: wyróżniony komunikat, siatka skrótów, szyna terminów.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  AlarmClock,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Library,
  Lock,
  Mail,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import type { InfoResource, InfoResourceIcon } from '../../lib/info/resources'
import {
  canShowCountdown,
  registrationTiming,
  type PriorityItem,
} from '../../lib/info/relevance'
import {
  dayKeyToDate,
  formatDateTime,
  formatDayLabel,
  formatDayOfMonth,
  formatDurationShort,
  formatMonthShort,
  formatRelativePast,
  parseIsoDate,
} from '../../lib/info/time'
import type { InfoAnnouncement, InfoEvent, InfoRegistration } from '../../lib/info/types'
import { REGISTRATION_KIND_META } from '../../types/usosRegistrations'
import { toggleSavedInfoItem, useInfoStore } from '../../hooks/useInfoPreferences'
import { isSaved } from '../../lib/info/saved'
import {
  AnnouncementStatusPill,
  DomainEmpty,
  DomainError,
  FOCUS_RING,
  INFO_ACTION_LINK_CLS,
  RowSkeletons,
} from './infoUi'

const ADDED_MEANING =
  'Dodano do UJverse (moment pobrania ze strony wydziału, może różnić się od daty publikacji)'

/** Wspólna powierzchnia boardu — bez lift/glow (mniej „AI look”). */
export const boardSurface =
  'rounded-2xl border border-zinc-200/90 bg-white/70 ' +
  'dark:border-white/[0.08] dark:bg-white/[0.03]'

const surfaceInteractive =
  `${boardSurface} transition-colors duration-150 ` +
  'hover:border-zinc-300 hover:bg-white ' +
  'dark:hover:border-white/15 dark:hover:bg-white/[0.05]'

function SaveChip({ item }: { item: InfoAnnouncement | InfoRegistration | InfoEvent }) {
  const { saved } = useInfoStore()
  const active = isSaved(saved, item.kind, item.id)
  const Glyph = active ? BookmarkCheck : Bookmark
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleSavedInfoItem(item)
      }}
      aria-pressed={active}
      aria-label={active ? `Usuń z zapisanych: ${item.title}` : `Zapisz na później: ${item.title}`}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${FOCUS_RING} ${
        active
          ? 'bg-brand-ink/10 text-brand-ink dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright'
          : 'text-zinc-400 hover:bg-black/[0.04] hover:text-brand-ink dark:hover:bg-white/[0.06] dark:hover:text-brand-gold-bright'
      }`}
    >
      <Glyph size={16} aria-hidden />
    </button>
  )
}

function SectionHead({
  id,
  title,
  to,
  label,
  hint,
}: {
  id: string
  title: string
  to?: string
  label?: string
  hint?: string
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {hint ? <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
      </div>
      {to && label ? (
        <Link to={to} className={INFO_ACTION_LINK_CLS} aria-label={label}>
          Wszystkie →
        </Link>
      ) : null}
    </div>
  )
}

function useBoardMotion(): { container?: Variants; item?: Variants } {
  const reduce = useReducedMotion()
  if (reduce) return {}
  return {
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
    },
    item: {
      hidden: { opacity: 0, y: 10 },
      show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
    },
  }
}

/* ─── Spotlight: Ważne teraz ─── */

function priorityTone(entry: PriorityItem): string {
  if (entry.reason === 'registration-closing' && entry.score >= 100) return 'border-l-rose-500'
  if (entry.reason === 'registration-closing') return 'border-l-amber-500'
  if (entry.reason === 'registration-opening') return 'border-l-sky-500'
  if (entry.reason === 'cancelled') return 'border-l-rose-500'
  return 'border-l-blue-500'
}

function priorityEyebrow(entry: PriorityItem, now: Date): string {
  switch (entry.reason) {
    case 'registration-closing': {
      const left = Date.parse(entry.item.closesAt ?? entry.item.opensAt) - now.getTime()
      return `Rejestracja zamyka się za ${formatDurationShort(left)}`
    }
    case 'registration-opening': {
      const until = Date.parse(entry.item.opensAt) - now.getTime()
      return `Rejestracja otwiera się za ${formatDurationShort(until)}`
    }
    case 'cancelled':
      return 'Odwołane zajęcia'
    case 'remote':
      return 'Zajęcia zdalne'
  }
}

export function BoardSpotlight({
  items,
  facultyLabel,
  now,
}: {
  items: PriorityItem[]
  facultyLabel: string
  now: Date
}) {
  const motionCfg = useBoardMotion()
  if (items.length === 0) return null
  const shown = items.slice(0, 2)
  return (
    <section aria-labelledby="board-priority-heading" className="min-w-0">
      <SectionHead id="board-priority-heading" title="Ważne teraz" hint={facultyLabel} />
      <motion.ul
        className="grid gap-3 lg:grid-cols-2"
        role="list"
        variants={motionCfg.container}
        initial="hidden"
        animate="show"
      >
        {shown.map((entry) => {
          const href = entry.kind === 'registration' ? entry.item.url : entry.item.sourceUrl
          const eyebrow = priorityEyebrow(entry, now)
          return (
            <motion.li key={entry.key} variants={motionCfg.item} className="min-w-0">
              <article
                className={`${surfaceInteractive} flex h-full flex-col border-l-[3px] p-5 ${priorityTone(entry)}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  {eyebrow}
                </p>
                <h3 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
                  {entry.item.title}
                </h3>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-4 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-ink dark:text-brand-gold-bright ${FOCUS_RING}`}
                  >
                    {entry.kind === 'registration' ? 'Otwórz w USOSweb' : 'Sprawdź w źródle'}
                    <ArrowUpRight size={14} aria-hidden />
                    <span className="sr-only">(otwiera się w nowej karcie)</span>
                  </a>
                ) : null}
              </article>
            </motion.li>
          )
        })}
      </motion.ul>
    </section>
  )
}

/* ─── Komunikaty: featured + grid ─── */

function AnnouncementTile({
  item,
  now,
  lead = false,
}: {
  item: InfoAnnouncement
  now: Date
  lead?: boolean
}) {
  const meta = [item.facultyShort, item.sourceLabel].filter(Boolean).join(' · ')
  const sourceLabel = item.sourceIsListing ? 'Lista komunikatów wydziału' : 'Sprawdź w źródle'
  const added = parseIsoDate(item.addedAt)

  return (
    <article className={`${surfaceInteractive} relative flex h-full min-h-[11.5rem] flex-col p-5`}>
      <div className="absolute right-3 top-3">
        <SaveChip item={item} />
      </div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2 pr-10">
        {lead ? (
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Najnowszy</span>
        ) : null}
        <AnnouncementStatusPill status={item.status} />
        {meta ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</span> : null}
      </div>
      <h3 className="line-clamp-3 pr-8 text-[15px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
        {item.title}
      </h3>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-5">
        {added ? (
          <time
            dateTime={added.toISOString()}
            title={`${ADDED_MEANING}: ${added.toISOString()}`}
            className="text-xs text-zinc-500 dark:text-zinc-400"
          >
            dodano {formatRelativePast(added, now)}
          </time>
        ) : null}
        {item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={
              item.sourceIsListing
                ? 'Ten komunikat nie ma osobnego adresu — otwieramy listę komunikatów wydziału'
                : undefined
            }
            className={`inline-flex items-center gap-1 text-xs font-semibold text-brand-ink dark:text-brand-gold-bright ${FOCUS_RING}`}
          >
            {sourceLabel}
            <ArrowUpRight size={12} aria-hidden />
            <span className="sr-only">(otwiera się w nowej karcie)</span>
          </a>
        ) : null}
      </div>
    </article>
  )
}

export function BoardAnnouncements({
  title,
  items,
  now,
  pending,
  error,
  onRetry,
  empty,
  dimmed,
  hint,
}: {
  title: string
  items: InfoAnnouncement[]
  now: Date
  pending: boolean
  error: boolean
  onRetry: () => void
  empty: ReactNode
  dimmed?: boolean
  hint?: string
}) {
  const motionCfg = useBoardMotion()

  return (
    <section aria-labelledby="board-announcements-heading" className="min-w-0">
      <SectionHead
        id="board-announcements-heading"
        title={title}
        to="/komunikaty"
        label="Wszystkie komunikaty"
        hint={hint}
      />
      {pending ? (
        <RowSkeletons count={3} variant="feed" />
      ) : error && items.length === 0 ? (
        <DomainError what="komunikaty" onRetry={onRetry} />
      ) : items.length === 0 ? (
        empty
      ) : (
        <motion.ul
          className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${dimmed ? 'opacity-60' : ''}`}
          role="list"
          variants={motionCfg.container}
          initial="hidden"
          animate="show"
        >
          {items.slice(0, 3).map((item, index) => (
            <motion.li key={item.id} variants={motionCfg.item} className="min-w-0">
              <AnnouncementTile item={item} now={now} lead={index === 0} />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  )
}

/* ─── Rejestracje / wydarzenia — szyna ─── */

function RegistrationTile({
  item,
  now,
  latestVerifiedAt,
}: {
  item: InfoRegistration
  now: Date
  latestVerifiedAt: string | null
}) {
  const timing = registrationTiming(item, now)
  const countdown = canShowCountdown(item, timing, now, latestVerifiedAt)
  const opens = new Date(item.opensAt)
  const closes = item.closesAt ? new Date(item.closesAt) : null
  const kindLabel = item.registrationKind !== 'inne' ? REGISTRATION_KIND_META[item.registrationKind].label : null

  let deadline: string
  let tone = 'text-zinc-700 dark:text-zinc-300'
  if (timing.phase === 'open') {
    if (!closes) deadline = 'Bez terminu zamknięcia'
    else if (countdown && timing.msUntilClose !== null) {
      deadline = `Zamyka się za ${formatDurationShort(timing.msUntilClose)}`
      if (timing.urgency === 'closing-critical') tone = 'text-rose-700 dark:text-rose-300'
      else if (timing.urgency === 'closing-soon') tone = 'text-amber-800 dark:text-amber-300'
    } else deadline = `Do ${formatDateTime(closes, now)}`
  } else if (countdown) {
    deadline = `Otwiera się za ${formatDurationShort(timing.msUntilOpen)}`
    if (timing.urgency === 'opening-soon') tone = 'text-sky-800 dark:text-sky-300'
  } else {
    deadline = `Od ${formatDateTime(opens, now)}`
  }

  return (
    <article className={`${surfaceInteractive} p-4`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {timing.phase === 'open' ? 'Trwa' : 'Nadchodzi'}
            {kindLabel ? ` · ${kindLabel}` : ''}
          </p>
          <h3 className="mt-1 text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50">{item.title}</h3>
          <p className={`mt-2 text-sm font-medium ${tone}`}>
            <time dateTime={(timing.phase === 'open' ? closes ?? opens : opens).toISOString()}>{deadline}</time>
          </p>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-ink dark:text-brand-gold-bright ${FOCUS_RING}`}
            >
              Otwórz w USOSweb
              <ArrowUpRight size={12} aria-hidden />
            </a>
          ) : null}
        </div>
        <SaveChip item={item} />
      </div>
    </article>
  )
}

function EventTile({ item, now }: { item: InfoEvent; now: Date }) {
  const day = dayKeyToDate(item.dayKey)
  return (
    <article className={`${surfaceInteractive} flex gap-3 p-4`}>
      <div
        className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-ink/[0.06] dark:bg-brand-gold-bright/10"
        aria-hidden
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-brand-ink dark:text-brand-gold-bright">
          {formatMonthShort(day)}
        </span>
        <span className="text-lg font-extrabold leading-none text-brand-ink dark:text-brand-gold-bright">
          {formatDayOfMonth(day)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          <time dateTime={item.dayKey}>{formatDayLabel(item.dayKey, now)}</time>
        </p>
        <h3 className="mt-0.5 text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50">{item.title}</h3>
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-ink dark:text-brand-gold-bright ${FOCUS_RING}`}
          >
            Szczegóły
            <ArrowUpRight size={12} aria-hidden />
          </a>
        ) : null}
      </div>
      <SaveChip item={item} />
    </article>
  )
}

export function BoardRail({
  registrations,
  events,
  now,
  latestRegistrationRun,
  registrationsPending,
  registrationsError,
  registrationsUnavailable,
  registrationsEmpty,
  registrationsStale,
  onRetryRegistrations,
  eventsPending,
  eventsError,
  eventsUnavailable,
  eventsEmpty,
  onRetryEvents,
  hideRegistrations,
  hideEvents,
}: {
  registrations: InfoRegistration[]
  events: InfoEvent[]
  now: Date
  latestRegistrationRun: string | null
  registrationsPending: boolean
  registrationsError: boolean
  registrationsUnavailable: boolean
  registrationsEmpty: ReactNode
  registrationsStale: boolean
  onRetryRegistrations: () => void
  eventsPending: boolean
  eventsError: boolean
  eventsUnavailable: boolean
  eventsEmpty: ReactNode
  onRetryEvents: () => void
  hideRegistrations: boolean
  hideEvents: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      {!hideRegistrations ? (
        <section aria-labelledby="board-registrations-heading" className="min-w-0">
          <SectionHead
            id="board-registrations-heading"
            title="Nadchodzące rejestracje"
            to="/rejestracje"
            label="Wszystkie rejestracje"
          />
          {registrationsPending ? (
            <RowSkeletons count={2} variant="feed" />
          ) : registrationsError ? (
            <DomainError what="rejestracje z USOSweb" onRetry={onRetryRegistrations} />
          ) : registrationsUnavailable ? (
            <DomainEmpty tone="quiet">Dane o rejestracjach z USOSweb są chwilowo niedostępne.</DomainEmpty>
          ) : registrations.length === 0 ? (
            registrationsEmpty
          ) : (
            <ul className="grid gap-3" role="list">
              {registrationsStale ? (
                <li>
                  <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    Dane z USOSweb mogą być nieaktualne — sprawdź terminy w źródle.
                  </p>
                </li>
              ) : null}
              {registrations.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <RegistrationTile item={item} now={now} latestVerifiedAt={latestRegistrationRun} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {!hideEvents ? (
        <section aria-labelledby="board-events-heading" className="min-w-0">
          <SectionHead id="board-events-heading" title="Wydarzenia na UJ" to="/wydarzenia" label="Wszystkie wydarzenia" />
          {eventsPending ? (
            <RowSkeletons count={2} variant="feed" />
          ) : eventsError ? (
            <DomainError what="wydarzenia" onRetry={onRetryEvents} />
          ) : eventsUnavailable ? (
            <DomainEmpty tone="quiet">Dane o wydarzeniach z uj.edu.pl są chwilowo niedostępne.</DomainEmpty>
          ) : events.length === 0 ? (
            eventsEmpty
          ) : (
            <ul className="grid gap-3" role="list">
              {events.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <EventTile item={item} now={now} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}

/* ─── Niezbędnik: kafelki narzędzi ─── */

const TOOL_ICONS: Record<InfoResourceIcon, LucideIcon> = {
  usos: GraduationCap,
  pegaz: BookOpen,
  mail: Mail,
  registrations: AlarmClock,
  calendar: CalendarDays,
  rooms: DoorOpen,
  plan: ClipboardList,
  spots: Library,
  discounts: Tag,
  assistant: Sparkles,
}

function ToolTile({ resource, isAuthenticated }: { resource: InfoResource; isAuthenticated: boolean }) {
  const Glyph = TOOL_ICONS[resource.icon]
  const locked = resource.requiresAccount && !isAuthenticated
  const body = (
    <>
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200"
        aria-hidden
      >
        <Glyph size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <span className="truncate">{resource.label}</span>
          {resource.external ? <ArrowUpRight size={12} className="shrink-0 text-zinc-400" aria-hidden /> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{resource.description}</span>
        {locked ? (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Lock size={10} aria-hidden /> wymaga konta
          </span>
        ) : null}
      </span>
    </>
  )
  const cls = `${surfaceInteractive} flex h-full items-start gap-3 p-4 text-left ${FOCUS_RING}`
  if (resource.external) {
    return (
      <a href={resource.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
        <span className="sr-only">(otwiera się w nowej karcie)</span>
      </a>
    )
  }
  return (
    <Link to={resource.href} className={cls}>
      {body}
    </Link>
  )
}

export function BoardTools({
  resources,
  isAuthenticated,
}: {
  resources: readonly InfoResource[]
  isAuthenticated: boolean
}) {
  return (
    <section aria-labelledby="board-tools-heading" className="min-w-0">
      <SectionHead
        id="board-tools-heading"
        title="Niezbędnik studenta"
        to="/niezbednik"
        label="Wszystkie narzędzia"
        hint="Szybki dostęp do USOS, PEGAZ i narzędzi UJverse"
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
        {resources.map((resource) => (
          <li key={resource.id} className="min-w-0">
            <ToolTile resource={resource} isAuthenticated={isAuthenticated} />
          </li>
        ))}
      </ul>
    </section>
  )
}
