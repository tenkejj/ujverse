import { ArrowUpRight, Lock, MapPin } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import BaseCard from '../ui/BaseCard'
import { theme } from '../../styles/theme'
import {
  canShowCountdown,
  registrationTiming,
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
import type { InfoResource } from '../../lib/info/resources'
import { REGISTRATION_KIND_META } from '../../types/usosRegistrations'
import {
  AnnouncementStatusPill,
  ExternalSourceLink,
  FOCUS_RING,
  SaveToggle,
} from './infoUi'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>

const goldMuted = theme.text.goldMuted

export function AnnouncementHubCard({
  item,
  now,
}: {
  item: InfoAnnouncement
  now: Date
}) {
  const added = parseIsoDate(item.addedAt)
  const meta = [item.facultyShort, item.sourceLabel].filter(Boolean).join(' · ')
  return (
    <BaseCard as="article" variant="default" className="relative flex h-full flex-col overflow-hidden p-0">
      <div className="absolute right-2 top-2 z-[2]">
        <SaveToggle item={item} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <AnnouncementStatusPill status={item.status} />
          {meta ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</span> : null}
        </div>
        <h3 className="line-clamp-3 text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          {item.title}
        </h3>
        {item.excerpt && item.excerpt !== item.title ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{item.excerpt}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
          {added ? (
            <time
              dateTime={added.toISOString()}
              title={`Dodano do UJverse: ${added.toISOString()}`}
              className="text-xs text-zinc-500 dark:text-zinc-400"
            >
              dodano {formatRelativePast(added, now)}
            </time>
          ) : null}
          <ExternalSourceLink
            href={item.sourceUrl}
            title={
              item.sourceIsListing
                ? 'Ten komunikat nie ma osobnego adresu — otwieramy listę komunikatów wydziału'
                : undefined
            }
          >
            {item.sourceIsListing ? 'Lista komunikatów wydziału' : 'Sprawdź w źródle'}
          </ExternalSourceLink>
        </div>
      </div>
    </BaseCard>
  )
}

export function RegistrationHubCard({
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
      if (timing.urgency === 'closing-critical') tone = 'font-semibold text-rose-700 dark:text-rose-300'
      else if (timing.urgency === 'closing-soon') tone = 'font-semibold text-amber-800 dark:text-amber-300'
    } else deadline = `Do ${formatDateTime(closes, now)}`
  } else if (countdown) {
    deadline = `Otwiera się za ${formatDurationShort(timing.msUntilOpen)}`
    if (timing.urgency === 'opening-soon') tone = 'font-semibold text-sky-800 dark:text-sky-300'
  } else {
    deadline = `Od ${formatDateTime(opens, now)}`
  }

  return (
    <BaseCard as="article" variant="default" className="relative flex h-full flex-col overflow-hidden p-0">
      <div className="absolute right-2 top-2 z-[2]">
        <SaveToggle item={item} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 pr-12">
        <div className="flex items-start gap-3">
          <div className="min-w-[44px] shrink-0 text-center">
            <span className={`block text-[10px] font-bold uppercase tracking-wide ${goldMuted}`}>
              {timing.phase === 'open' ? 'Trwa' : 'Wkrótce'}
            </span>
            <span className="mt-0.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {kindLabel ?? 'USOS'}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="line-clamp-3 text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
              {item.title}
            </h3>
            {(item.unitName || item.facultyShort) && (
              <p className="flex items-start gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden />
                <span className="line-clamp-2">{[item.unitName, item.facultyShort].filter(Boolean).join(' · ')}</span>
              </p>
            )}
            <p className={`text-sm ${tone}`}>
              <time dateTime={(timing.phase === 'open' ? closes ?? opens : opens).toISOString()}>{deadline}</time>
            </p>
          </div>
        </div>
        <div className="mt-auto pt-1">
          <ExternalSourceLink href={item.url}>Otwórz w USOSweb</ExternalSourceLink>
        </div>
      </div>
    </BaseCard>
  )
}

export function EventHubCard({ item, now }: { item: InfoEvent; now: Date }) {
  const day = dayKeyToDate(item.dayKey)
  return (
    <BaseCard as="article" variant="default" className="relative flex h-full flex-col overflow-hidden p-0">
      <div className="absolute right-2 top-2 z-[2]">
        <SaveToggle item={item} />
      </div>
      <div className="flex flex-1 gap-3 p-4 pr-12">
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
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <time dateTime={item.dayKey}>{formatDayLabel(item.dayKey, now)}</time>
          </p>
          <h3 className="line-clamp-3 text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
            {item.title}
          </h3>
          {item.location ? (
            <p className="flex items-start gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden />
              <span className="line-clamp-2">{item.location}</span>
            </p>
          ) : null}
          <div className="pt-1">
            <ExternalSourceLink href={item.url}>Szczegóły</ExternalSourceLink>
          </div>
        </div>
      </div>
    </BaseCard>
  )
}

export function ResourceHubCard({
  resource,
  isAuthenticated,
  icon: Glyph,
}: {
  resource: InfoResource
  isAuthenticated: boolean
  icon: Icon
}) {
  const locked = resource.requiresAccount && !isAuthenticated
  const inner = (
    <>
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-ink/[0.06] text-brand-ink dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright"
        aria-hidden
      >
        <Glyph size={18} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <span className="truncate">{resource.label}</span>
          {resource.external ? <ArrowUpRight size={13} className="shrink-0 opacity-50" aria-hidden /> : null}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {resource.description}
        </span>
        {locked ? (
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            <Lock size={11} aria-hidden /> wymaga konta
          </span>
        ) : null}
      </span>
    </>
  )
  const cls = `flex h-full items-start gap-3 p-4 text-left ${FOCUS_RING}`
  if (resource.external) {
    return (
      <BaseCard as="a" variant="default" interactive href={resource.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
        <span className="sr-only">(otwiera się w nowej karcie)</span>
      </BaseCard>
    )
  }
  return (
    <BaseCard as={Link} variant="default" interactive to={resource.href} className={cls}>
      {inner}
    </BaseCard>
  )
}
