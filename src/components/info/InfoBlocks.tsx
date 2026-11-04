import { useId, useRef, useState, type ComponentType, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Library,
  Lock,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
  Zap,
} from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { sideMutedCls, widgetGoldCls } from '../../lib/sidePanelStyles'
import { ANNOUNCEMENT_SOURCE_COUNT } from '../../lib/info/faculty'
import type { PriorityItem } from '../../lib/info/relevance'
import {
  DASHBOARD_SECTIONS,
  type DashboardSectionId,
} from '../../lib/info/preferences'
import type { InfoResource, InfoResourceIcon } from '../../lib/info/resources'
import type { SavedItem } from '../../lib/info/saved'
import {
  formatDateTime,
  formatDurationShort,
  formatFull,
  formatRelativePast,
  parseIsoDate,
} from '../../lib/info/time'
import { setDashboardSectionHidden } from '../../hooks/useInfoPreferences'
import { SavedItemRow } from './InfoItems'
import {
  ExternalSourceLink,
  FOCUS_RING,
  INFO_ACTION_LINK_CLS,
  INFO_META_CLS,
  INFO_TITLE_CLS,
  InfoSection,
  TimeStamp,
} from './infoUi'
import { useDialogA11y } from './useDialogA11y'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>

/* ─────────────────────────── Ważne teraz ─────────────────────────── */

function priorityLabel(entry: PriorityItem, now: Date): { text: string; tone: string } {
  switch (entry.reason) {
    case 'registration-closing': {
      const left = Date.parse(entry.item.closesAt ?? entry.item.opensAt) - now.getTime()
      return {
        text: `Rejestracja zamyka się za ${formatDurationShort(left)}`,
        tone: entry.score >= 100 ? 'text-rose-700 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300',
      }
    }
    case 'registration-opening': {
      const until = Date.parse(entry.item.opensAt) - now.getTime()
      return { text: `Rejestracja otwiera się za ${formatDurationShort(until)}`, tone: 'text-sky-800 dark:text-sky-300' }
    }
    case 'cancelled':
      return { text: 'Odwołane zajęcia', tone: 'text-red-800 dark:text-red-400' }
    case 'remote':
      return { text: 'Zajęcia zdalne', tone: 'text-blue-800 dark:text-blue-300' }
  }
}

function priorityLink(entry: PriorityItem): string | null {
  return entry.kind === 'registration' ? entry.item.url : entry.item.sourceUrl
}

function PriorityDetails({ entry, now }: { entry: PriorityItem; now: Date }) {
  if (entry.kind === 'announcement') {
    return (
      <p className={`${INFO_META_CLS} mt-1`}>
        <TimeStamp
          iso={entry.item.addedAt}
          prefix="dodano"
          meaning="Dodano do UJverse (moment pobrania ze strony wydziału)"
          now={now}
        />
      </p>
    )
  }
  const reg = entry.item
  return (
    <p className={`${INFO_META_CLS} mt-1`}>
      {reg.unitName ?? 'USOSweb'}
      {' · '}
      {entry.reason === 'registration-closing' && reg.closesAt
        ? `do ${formatDateTime(new Date(reg.closesAt), now)}`
        : `od ${formatDateTime(new Date(reg.opensAt), now)}`}
    </p>
  )
}

export function PrioritySection({
  items,
  facultyLabel,
  now,
}: {
  items: PriorityItem[]
  facultyLabel: string
  now: Date
}) {
  if (items.length === 0) return null
  return (
    <InfoSection variant="feed" icon={Zap} title="Ważne teraz" subtitle={facultyLabel}>
      <ul className="divide-y divide-zinc-200/80 dark:divide-white/10" role="list">
        {items.map((entry) => {
          const label = priorityLabel(entry, now)
          const isRegistration = entry.kind === 'registration'
          return (
            <li key={entry.key} className="min-w-0">
              <article className="py-3.5 first:pt-2">
                <p className={`text-[11px] font-bold uppercase tracking-wide ${label.tone}`}>{label.text}</p>
                <h3 className={`${INFO_TITLE_CLS} mt-1 line-clamp-2 break-words`}>{entry.item.title}</h3>
                <PriorityDetails entry={entry} now={now} />
                <div className="mt-1.5">
                  <ExternalSourceLink href={priorityLink(entry)}>
                    {isRegistration ? 'Otwórz w USOSweb' : 'Sprawdź w źródle'}
                  </ExternalSourceLink>
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </InfoSection>
  )
}

/* ─────────────────────────── Niezbędnik ─────────────────────────── */

const RESOURCE_ICONS: Record<InfoResourceIcon, Icon> = {
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

const TILE_CLS = `group m-0 flex h-full min-h-16 items-start gap-3 p-3 text-left ${FOCUS_RING}`

export function ResourceTile({ resource, isAuthenticated }: { resource: InfoResource; isAuthenticated: boolean }) {
  const Glyph = RESOURCE_ICONS[resource.icon]
  const locked = resource.requiresAccount && !isAuthenticated
  const inner = (
    <>
      <Glyph size={18} strokeWidth={2} className={`mt-0.5 shrink-0 ${widgetGoldCls}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-bold leading-snug text-brand-ink dark:text-white">
          <span className="truncate">{resource.label}</span>
          {resource.external ? <ArrowUpRight size={12} className="shrink-0 opacity-60" aria-hidden /> : null}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{resource.description}</span>
        {locked ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <Lock size={10} aria-hidden /> wymaga konta
          </span>
        ) : null}
      </span>
    </>
  )
  if (resource.external) {
    return (
      <BaseCard as="a" variant="inner" interactive href={resource.href} target="_blank" rel="noopener noreferrer" className={TILE_CLS}>
        {inner}
        <span className="sr-only">(otwiera się w nowej karcie)</span>
      </BaseCard>
    )
  }
  return (
    <BaseCard as={Link} variant="inner" interactive to={resource.href} className={TILE_CLS}>
      {inner}
    </BaseCard>
  )
}

export function ResourceGrid({
  resources,
  isAuthenticated,
  columns = 'sm:grid-cols-2 xl:grid-cols-4',
}: {
  resources: readonly InfoResource[]
  isAuthenticated: boolean
  columns?: string
}) {
  return (
    <ul className={`grid gap-2.5 ${columns}`} role="list">
      {resources.map((resource) => (
        <li key={resource.id} className="min-w-0">
          <ResourceTile resource={resource} isAuthenticated={isAuthenticated} />
        </li>
      ))}
    </ul>
  )
}

/** Kompaktowy pasek linków na Start — bez kafelek z opisami. */
export function ResourceStrip({
  resources,
  isAuthenticated,
}: {
  resources: readonly InfoResource[]
  isAuthenticated: boolean
}) {
  return (
    <ul className="flex flex-wrap gap-x-1 gap-y-1" role="list">
      {resources.map((resource) => {
        const locked = resource.requiresAccount && !isAuthenticated
        const cls = `inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-black/[0.04] dark:text-brand-gold-bright dark:hover:bg-white/[0.05] ${FOCUS_RING}`
        const label = (
          <>
            {resource.label}
            {resource.external ? <ArrowUpRight size={12} className="opacity-60" aria-hidden /> : null}
            {locked ? <Lock size={11} className="opacity-60" aria-hidden /> : null}
          </>
        )
        return (
          <li key={resource.id}>
            {resource.external ? (
              <a href={resource.href} target="_blank" rel="noopener noreferrer" className={cls}>
                {label}
                <span className="sr-only">(otwiera się w nowej karcie)</span>
              </a>
            ) : (
              <Link to={resource.href} className={cls}>
                {label}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ─────────────────────────── Zapisane ─────────────────────────── */

export function SavedSection({ items, now }: { items: SavedItem[]; now: Date }) {
  const [showAll, setShowAll] = useState(false)
  if (items.length === 0) return null
  const visible = showAll ? items : items.slice(0, 4)
  return (
    <InfoSection variant="feed" icon={Bookmark} title="Zapisane">
      <ul className="divide-y divide-zinc-200/80 dark:divide-white/10" role="list">
        {visible.map((item) => (
          <li key={`${item.kind}:${item.id}`} className="min-w-0">
            <SavedItemRow item={item} now={now} variant="feed" />
          </li>
        ))}
      </ul>
      {items.length > 4 ? (
        <button type="button" onClick={() => setShowAll((v) => !v)} className={`${INFO_ACTION_LINK_CLS} mt-2`}>
          {showAll ? 'Pokaż mniej' : `Pokaż wszystkie (${items.length})`}
        </button>
      ) : null}
    </InfoSection>
  )
}

/* ─────────────────────────── Źródła i aktualność ─────────────────────────── */

function FreshnessValue({ iso, meaning, now }: { iso: string | null; meaning: string; now: Date }) {
  const date = parseIsoDate(iso)
  if (!date) return <span>brak danych</span>
  return (
    <time dateTime={date.toISOString()} title={`${meaning}: ${formatFull(date)}`}>
      {formatRelativePast(date, now)}
    </time>
  )
}

export function SourcesNote({
  announcementsLatest,
  registrationsLatest,
  registrationsStale,
  eventsLatest,
  now,
}: {
  announcementsLatest: string | null
  registrationsLatest: string | null
  registrationsStale: boolean
  eventsLatest: string | null
  now: Date
}) {
  return (
    <footer className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
      <p className="flex items-start gap-2">
        <ShieldCheck size={14} className={`mt-0.5 shrink-0 ${widgetGoldCls}`} aria-hidden />
        <span>
          Dane z {ANNOUNCEMENT_SOURCE_COUNT} stron wydziałów, USOSweb i uj.edu.pl — nie na żywo; w ważnych sprawach
          sprawdź źródło. Nieoficjalny projekt studencki.
        </span>
      </p>
      <p className={`mt-2 ${sideMutedCls}`}>
        Aktualność: komunikaty{' '}
        <FreshnessValue iso={announcementsLatest} meaning="Najnowszy komunikat dodany do UJverse" now={now} />
        {' · '}rejestracje{' '}
        <span className={registrationsStale && registrationsLatest ? 'text-amber-800 dark:text-amber-300' : undefined}>
          <FreshnessValue iso={registrationsLatest} meaning="Ostatnia aktualizacja z USOSweb" now={now} />
          {registrationsStale && registrationsLatest ? ' (mogą być nieaktualne)' : null}
        </span>
        {' · '}wydarzenia{' '}
        <FreshnessValue iso={eventsLatest} meaning="Ostatnie pobranie kalendarza uj.edu.pl" now={now} />
      </p>
    </footer>
  )
}

/* ─────────────────────────── Dostosuj ─────────────────────────── */

const SECTION_LABELS: Record<DashboardSectionId, string> = {
  announcements: 'Komunikaty',
  registrations: 'Nadchodzące rejestracje',
  events: 'Wydarzenia na UJ',
  tools: 'Niezbędnik studenta',
}

export function CustomizeButton({ hidden }: { hidden: readonly DashboardSectionId[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${INFO_ACTION_LINK_CLS} border border-zinc-200 dark:border-white/10`}
      >
        <SlidersHorizontal size={14} aria-hidden />
        Dostosuj
        {hidden.length > 0 ? <span className="sr-only">(ukryte sekcje: {hidden.length})</span> : null}
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(<CustomizeDialog hidden={hidden} onClose={() => setOpen(false)} />, document.body)
        : null}
    </>
  )
}

function CustomizeDialog({ hidden, onClose }: { hidden: readonly DashboardSectionId[]; onClose: () => void }) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  useDialogA11y(true, panelRef, onClose)
  const hiddenSet = new Set(hidden)
  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center sm:items-start sm:pt-[12vh]">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px] dark:bg-black/65"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full rounded-t-3xl border border-zinc-200 bg-bg-app p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)] outline-none animate-slide-up motion-reduce:animate-none sm:w-[min(26rem,calc(100vw-2rem))] sm:rounded-3xl dark:border-white/10"
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Co pokazywać na stronie startowej
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Ustawienie zapisuje się na tym urządzeniu. „Ważne teraz" pokazujemy zawsze, gdy coś pilnego dotyczy Twojego wydziału.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 ${FOCUS_RING}`}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <fieldset className="space-y-1">
          <legend className="sr-only">Widoczne sekcje</legend>
          {DASHBOARD_SECTIONS.map((section) => {
            const visible = !hiddenSet.has(section)
            return (
              <label
                key={section}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm font-medium text-zinc-800 hover:bg-black/[0.03] dark:text-zinc-100 dark:hover:bg-white/[0.04]"
              >
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setDashboardSectionHidden(section, !e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand-ink)] dark:accent-[var(--brand-gold-bright)]"
                />
                {SECTION_LABELS[section]}
              </label>
            )
          })}
        </fieldset>
      </div>
    </div>
  )
}
