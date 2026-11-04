import { useState } from 'react'
import { MapPin, Trash2 } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import AnnouncementTldr from '../announcements/AnnouncementTldr'
import { DataService } from '../../services/DataService'
import { removeSavedInfoItem } from '../../hooks/useInfoPreferences'
import {
  canShowCountdown,
  isRegistrationVerified,
  registrationTiming,
} from '../../lib/info/relevance'
import {
  dayKeyToDate,
  formatDate,
  formatDateTime,
  formatDayLabel,
  formatDayOfMonth,
  formatDurationShort,
  formatFull,
  formatMonthShort,
  formatRelativePast,
  parseIsoDate,
  warsawDayKey,
} from '../../lib/info/time'
import type { InfoAnnouncement, InfoEvent, InfoRegistration } from '../../lib/info/types'
import type { SavedItem } from '../../lib/info/saved'
import { REGISTRATION_KIND_META } from '../../types/usosRegistrations'
import {
  AnnouncementStatusPill,
  ExternalSourceLink,
  FOCUS_RING,
  INFO_FEED_ROW_CLS,
  INFO_META_CLS,
  INFO_TEXT_CLS,
  INFO_TITLE_CLS,
  SaveToggle,
  TimeStamp,
} from './infoUi'

const ADDED_MEANING =
  'Dodano do UJverse (moment pobrania ze strony wydziału, może różnić się od daty publikacji)'

function sameText(a: string, b: string): boolean {
  return a.replace(/\W+/g, '').toLowerCase() === b.replace(/\W+/g, '').toLowerCase()
}

function hostLabel(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/* ─────────────────────────── Komunikat ─────────────────────────── */

export function AnnouncementItem({
  item,
  now,
  variant = 'compact',
  headingLevel = 'h3',
}: {
  item: InfoAnnouncement
  now: Date
  /** `feed` = wiersz na Start (bez karty i bez excerptu). */
  variant?: 'compact' | 'full' | 'feed'
  headingLevel?: 'h2' | 'h3'
}) {
  const Heading = headingLevel
  const [expanded, setExpanded] = useState(false)
  const [fullBody, setFullBody] = useState<string | null>(null)
  const [loadingBody, setLoadingBody] = useState(false)
  const [bodyError, setBodyError] = useState(false)

  const showExcerpt = variant === 'compact' && item.excerpt.length > 0 && !sameText(item.excerpt, item.title)
  const body = fullBody ?? item.body
  const canExpand = variant === 'full' && (item.body.length > item.excerpt.length || item.mayHaveFullBody)

  const toggleExpanded = () => {
    const next = !expanded
    setExpanded(next)
    if (!next || fullBody || loadingBody || !item.mayHaveFullBody) return
    setLoadingBody(true)
    setBodyError(false)
    DataService.fetchPublicAnnouncementFullBody(item.id)
      .then((text) => {
        if (text && text.length > item.body.length) setFullBody(text)
      })
      .catch(() => setBodyError(true))
      .finally(() => setLoadingBody(false))
  }

  const meta = [item.facultyShort ?? null, item.sourceLabel].filter(Boolean).join(' · ')
  const sourceLabel = item.sourceIsListing ? 'Lista komunikatów wydziału' : 'Sprawdź w źródle'
  const sourceTitle = item.sourceIsListing
    ? 'Ten komunikat nie ma osobnego adresu — otwieramy listę komunikatów wydziału'
    : undefined

  if (variant === 'feed') {
    return (
      <article className={INFO_FEED_ROW_CLS}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <AnnouncementStatusPill status={item.status} />
              {meta ? <span className={INFO_META_CLS}>{meta}</span> : null}
              <span className={INFO_META_CLS}>
                <TimeStamp iso={item.addedAt} prefix="dodano" meaning={ADDED_MEANING} now={now} />
              </span>
            </div>
            <Heading className={`${INFO_TITLE_CLS} line-clamp-2 break-words`}>{item.title}</Heading>
            <div className="mt-1.5">
              <ExternalSourceLink href={item.sourceUrl} title={sourceTitle}>
                {sourceLabel}
              </ExternalSourceLink>
            </div>
          </div>
          <SaveToggle item={item} />
        </div>
      </article>
    )
  }

  return (
    <BaseCard as="article" variant="inner" className="m-0 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <AnnouncementStatusPill status={item.status} />
            {meta ? <span className={INFO_META_CLS}>{meta}</span> : null}
          </div>
          <Heading className={`${INFO_TITLE_CLS} break-words`}>{item.title}</Heading>

          {variant === 'full' && item.summary ? (
            <div className="mt-2">
              <AnnouncementTldr summary={{ text: item.summary, source: 'ai' }} variant="card" />
            </div>
          ) : null}

          {showExcerpt ? (
            <p className={`${INFO_TEXT_CLS} mt-1 line-clamp-2 break-words`}>{item.excerpt}</p>
          ) : null}

          {variant === 'full' && body ? (
            <p
              className={`${INFO_TEXT_CLS} mt-1.5 whitespace-pre-line break-words ${expanded ? '' : 'line-clamp-4'}`}
            >
              {body}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={INFO_META_CLS}>
              <TimeStamp iso={item.addedAt} prefix="dodano" meaning={ADDED_MEANING} now={now} />
            </span>
            <ExternalSourceLink href={item.sourceUrl} title={sourceTitle}>
              {sourceLabel}
            </ExternalSourceLink>
            {canExpand ? (
              <button
                type="button"
                onClick={toggleExpanded}
                aria-expanded={expanded}
                className={`rounded text-xs font-medium text-zinc-500 hover:text-brand-ink dark:text-zinc-400 dark:hover:text-brand-gold-bright ${FOCUS_RING}`}
              >
                {expanded ? 'Zwiń' : 'Pokaż całość'}
              </button>
            ) : null}
            {loadingBody ? <span className={INFO_META_CLS} role="status">Wczytuję pełną treść…</span> : null}
            {bodyError ? (
              <span className={INFO_META_CLS} role="status">
                Nie udało się pobrać pełnej treści — zajrzyj do źródła.
              </span>
            ) : null}
          </div>
        </div>
        <SaveToggle item={item} />
      </div>
    </BaseCard>
  )
}

/* ─────────────────────────── Rejestracja ─────────────────────────── */

export function RegistrationItem({
  item,
  now,
  latestVerifiedAt,
  variant = 'compact',
  headingLevel = 'h3',
  showUnit = true,
}: {
  item: InfoRegistration
  now: Date
  latestVerifiedAt: string | null
  variant?: 'compact' | 'full' | 'feed'
  headingLevel?: 'h2' | 'h3' | 'h4'
  showUnit?: boolean
}) {
  const Heading = headingLevel
  const timing = registrationTiming(item, now)
  const countdown = canShowCountdown(item, timing, now, latestVerifiedAt)
  const verified = isRegistrationVerified(item, now, latestVerifiedAt)
  const opens = new Date(item.opensAt)
  const closes = item.closesAt ? new Date(item.closesAt) : null

  let phaseLabel: string
  let phaseCls: string
  if (timing.phase === 'open') {
    phaseLabel = 'Trwa'
    phaseCls = 'border-emerald-600/40 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300'
  } else {
    phaseLabel = 'Nadchodząca'
    phaseCls = 'border-sky-600/40 text-sky-800 dark:border-sky-400/40 dark:text-sky-300'
  }

  let deadline: string
  let deadlineTone = 'text-zinc-700 dark:text-zinc-300'
  if (timing.phase === 'open') {
    if (!closes) {
      deadline = 'Bez podanego terminu zamknięcia'
    } else if (countdown && timing.msUntilClose !== null) {
      deadline = variant === 'feed'
        ? `Zamyka się za ${formatDurationShort(timing.msUntilClose)}`
        : `Zamyka się za ${formatDurationShort(timing.msUntilClose)} · ${formatDateTime(closes, now)}`
      if (timing.urgency === 'closing-critical') deadlineTone = 'text-rose-700 dark:text-rose-300 font-semibold'
      else if (timing.urgency === 'closing-soon') deadlineTone = 'text-amber-800 dark:text-amber-300 font-semibold'
    } else {
      deadline = `Otwarta do ${formatDateTime(closes, now)}`
    }
  } else if (countdown) {
    deadline = variant === 'feed'
      ? `Otwiera się za ${formatDurationShort(timing.msUntilOpen)}`
      : `Otwiera się za ${formatDurationShort(timing.msUntilOpen)} · ${formatDateTime(opens, now)}`
    if (timing.urgency === 'opening-soon') deadlineTone = 'text-sky-800 dark:text-sky-300 font-semibold'
  } else {
    deadline = `Otwarcie ${formatDateTime(opens, now)}${closes ? ` · do ${formatDate(closes, now)}` : ''}`
  }

  const kindLabel = item.registrationKind !== 'inne' ? REGISTRATION_KIND_META[item.registrationKind].label : null
  const unitLine = [showUnit ? item.unitName : null, item.facultyShort].filter(Boolean).join(' · ')
  const verifiedDate = parseIsoDate(item.verifiedAt)
  const phasePill = (
    <span
      className={`inline-flex items-center rounded-full border bg-transparent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${phaseCls}`}
    >
      {phaseLabel}
    </span>
  )

  if (variant === 'feed') {
    return (
      <article className={INFO_FEED_ROW_CLS}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {phasePill}
              {kindLabel ? <span className={INFO_META_CLS}>{kindLabel}</span> : null}
            </div>
            <Heading className={`${INFO_TITLE_CLS} line-clamp-2 break-words`}>{item.title}</Heading>
            <p className={`mt-1 text-xs ${deadlineTone}`}>
              <time dateTime={(timing.phase === 'open' ? closes ?? opens : opens).toISOString()}>{deadline}</time>
              {unitLine ? <span className={` ${INFO_META_CLS}`}> · {unitLine}</span> : null}
            </p>
            <div className="mt-1.5">
              <ExternalSourceLink href={item.url}>Otwórz w USOSweb</ExternalSourceLink>
            </div>
          </div>
          <SaveToggle item={item} />
        </div>
      </article>
    )
  }

  return (
    <BaseCard as="article" variant="inner" className="m-0 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {phasePill}
            {kindLabel ? <span className={INFO_META_CLS}>{kindLabel}</span> : null}
            {unitLine ? <span className={`${INFO_META_CLS} min-w-0 break-words`}>{unitLine}</span> : null}
          </div>
          <Heading className={`${INFO_TITLE_CLS} break-words`}>{item.title}</Heading>
          <p className={`mt-1 text-xs ${deadlineTone}`}>
            <time dateTime={(timing.phase === 'open' ? closes ?? opens : opens).toISOString()}>{deadline}</time>
          </p>
          {variant === 'full' ? (
            <p className={`${INFO_META_CLS} mt-1`}>
              {item.code ? <>Kod: {item.code} · </> : null}
              {verified && verifiedDate ? (
                <time dateTime={verifiedDate.toISOString()} title={`Ostatnio potwierdzone w USOSweb: ${formatFull(verifiedDate)}`}>
                  potwierdzone w USOSweb {formatRelativePast(verifiedDate, now)}
                </time>
              ) : (
                <span className="text-amber-800 dark:text-amber-300">
                  Nie potwierdzone w ostatniej aktualizacji — sprawdź w USOSweb
                </span>
              )}
            </p>
          ) : null}
          <div className="mt-2">
            <ExternalSourceLink href={item.url}>Otwórz w USOSweb</ExternalSourceLink>
          </div>
        </div>
        <SaveToggle item={item} />
      </div>
    </BaseCard>
  )
}

/* ─────────────────────────── Wydarzenie ─────────────────────────── */

export function EventItem({
  item,
  now,
  variant = 'compact',
  headingLevel = 'h3',
}: {
  item: InfoEvent
  now: Date
  variant?: 'compact' | 'full' | 'feed'
  headingLevel?: 'h2' | 'h3'
}) {
  const Heading = headingLevel
  const day = dayKeyToDate(item.dayKey)
  const dayLabel = formatDayLabel(item.dayKey, now)
  const host = hostLabel(item.url)
  const isPast = item.dayKey < warsawDayKey(now)
  const dateBlock = (
    <div
      className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-brand-ink/20 bg-brand-ink/[0.04] py-1 dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/[0.07]"
      aria-hidden
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand-ink dark:text-brand-gold-bright">
        {formatMonthShort(day)}
      </span>
      <span className="text-base font-extrabold leading-none text-brand-ink dark:text-brand-gold-bright">
        {formatDayOfMonth(day)}
      </span>
    </div>
  )

  if (variant === 'feed') {
    return (
      <article className={INFO_FEED_ROW_CLS}>
        <div className="flex items-start gap-3">
          {dateBlock}
          <div className="min-w-0 flex-1">
            <p className={INFO_META_CLS}>
              <time dateTime={item.dayKey}>{isPast ? `Minione · ${dayLabel}` : dayLabel}</time>
            </p>
            <Heading className={`${INFO_TITLE_CLS} mt-0.5 line-clamp-2 break-words`}>{item.title}</Heading>
            <div className="mt-1.5">
              <ExternalSourceLink href={item.url}>Szczegóły{host ? ` na ${host}` : ''}</ExternalSourceLink>
            </div>
          </div>
          <SaveToggle item={item} />
        </div>
      </article>
    )
  }

  return (
    <BaseCard as="article" variant="inner" className="m-0 p-3">
      <div className="flex items-start gap-3">
        {dateBlock}
        <div className="min-w-0 flex-1">
          <p className={INFO_META_CLS}>
            <time dateTime={item.dayKey}>{isPast ? `Minione · ${dayLabel}` : dayLabel}</time>
            {item.location ? (
              <span className="inline-flex items-center gap-1">
                {' · '}
                <MapPin size={11} aria-hidden className="inline shrink-0" />
                {item.location}
              </span>
            ) : null}
          </p>
          <Heading className={`${INFO_TITLE_CLS} mt-0.5 break-words`}>{item.title}</Heading>
          {variant === 'full' && item.description ? (
            <p className={`${INFO_TEXT_CLS} mt-1 line-clamp-3 break-words`}>{item.description}</p>
          ) : null}
          <div className="mt-2">
            <ExternalSourceLink href={item.url}>Szczegóły{host ? ` na ${host}` : ' w źródle'}</ExternalSourceLink>
          </div>
        </div>
        <SaveToggle item={item} />
      </div>
    </BaseCard>
  )
}

/* ─────────────────────────── Zapisane ─────────────────────────── */

const SAVED_KIND_LABEL: Record<SavedItem['kind'], string> = {
  announcement: 'Komunikat',
  registration: 'Rejestracja',
  event: 'Wydarzenie',
}

export function SavedItemRow({
  item,
  now,
  variant = 'compact',
}: {
  item: SavedItem
  now: Date
  variant?: 'compact' | 'feed'
}) {
  let due: string | null = null
  if (item.dueAt) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.dueAt)) {
      due = formatDayLabel(item.dueAt, now)
    } else {
      const date = parseIsoDate(item.dueAt)
      if (date) due = date.getTime() < now.getTime() ? `termin minął ${formatDate(date, now)}` : `do ${formatDateTime(date, now)}`
    }
  }
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className={INFO_META_CLS}>
          {[SAVED_KIND_LABEL[item.kind], item.context, due].filter(Boolean).join(' · ')}
        </p>
        <h3 className={`${INFO_TITLE_CLS} mt-0.5 line-clamp-2 break-words`}>{item.title}</h3>
        <div className="mt-1.5">
          <ExternalSourceLink href={item.url}>Otwórz źródło</ExternalSourceLink>
        </div>
      </div>
      <button
        type="button"
        onClick={() => removeSavedInfoItem(item.kind, item.id)}
        aria-label={`Usuń z zapisanych: ${item.title}`}
        title="Usuń z zapisanych"
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-black/[0.04] hover:text-rose-600 dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-rose-400 ${FOCUS_RING}`}
      >
        <Trash2 size={15} aria-hidden />
      </button>
    </>
  )
  if (variant === 'feed') {
    return <article className={`${INFO_FEED_ROW_CLS} flex items-start gap-2`}>{body}</article>
  }
  return (
    <BaseCard as="article" variant="inner" className="m-0 flex items-start gap-2 p-3">
      {body}
    </BaseCard>
  )
}
