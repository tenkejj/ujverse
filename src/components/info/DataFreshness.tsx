import { Clock3, TriangleAlert } from 'lucide-react'
import { formatDateTime, formatFull, parseIsoDate } from '../../lib/info/time'
import '../../styles/data-freshness.css'

export type DataFreshnessKind = 'announcements' | 'registrations' | 'events'
export type DataFreshnessStatus = 'loading' | 'error' | 'ready'

type Props = {
  iso: string | null
  kind: DataFreshnessKind
  now: Date
  status: DataFreshnessStatus
  stale?: boolean
  compact?: boolean
  /** TanStack Query dataUpdatedAt: successful read into the browser cache, not source ingestion. */
  checkedAt?: number
}

const SOURCE_LABELS: Record<
  DataFreshnessKind,
  { label: string; meaning: string }
> = {
  announcements: {
    label: 'Najnowszy komunikat dodano',
    meaning:
      'Pierwsze dodanie najnowszego komunikatu do UJverse. To nie data publikacji ani ostatniego sprawdzenia strony wydziału.',
  },
  registrations: {
    label: 'Ostatnie potwierdzenie USOSweb',
    meaning:
      'Najnowszy zapis potwierdzenia rejestracji przez scraper USOSweb. Poszczególne jednostki mogą być sprawdzane w różnym czasie.',
  },
  events: {
    label: 'Ostatnio pobrano wydarzenia',
    meaning: 'Najnowszy zapis pobrania wydarzenia z oficjalnego serwisu UJ.',
  },
}

/** Visible source timing stays separate from the browser's most recent successful read. */
export default function DataFreshness({
  iso,
  kind,
  now,
  status,
  stale = false,
  compact = false,
  checkedAt,
}: Props) {
  const sourceDate = parseIsoDate(iso)
  const checkedDate =
    typeof checkedAt === 'number' && Number.isFinite(checkedAt) && checkedAt > 0
      ? new Date(checkedAt)
      : null
  const knownCheck =
    checkedDate && !Number.isNaN(checkedDate.getTime()) ? checkedDate : null
  const source = SOURCE_LABELS[kind]
  const warning = status === 'error' || stale
  const Icon = warning ? TriangleAlert : Clock3

  return (
    <div
      className={`data-freshness${compact ? ' data-freshness-compact' : ''}`}
      data-status={status}
      data-stale={stale || undefined}
    >
      <Icon
        className="data-freshness-icon"
        size={15}
        strokeWidth={1.75}
        aria-hidden
      />
      <div className="data-freshness-copy">
        {status === 'loading' ? (
          <p className="data-freshness-primary">Sprawdzam aktualność danych…</p>
        ) : (
          <>
            {status === 'error' ? (
              <p className="data-freshness-state">
                Nie udało się sprawdzić aktualności danych.
              </p>
            ) : null}
            {sourceDate ? (
              <p className="data-freshness-primary" title={source.meaning}>
                {source.label} <ExactTime date={sourceDate} now={now} />
              </p>
            ) : status === 'ready' ? (
              <p className="data-freshness-primary">
                Brak daty aktualizacji źródła.
              </p>
            ) : null}
            {knownCheck ? (
              <p
                className="data-freshness-check"
                title="Chwila udanego odczytu danych do UJverse w tej przeglądarce. Nie oznacza ponownego pobrania strony uczelni."
              >
                Dane w UJverse sprawdzono{' '}
                <ExactTime date={knownCheck} now={now} />
              </p>
            ) : null}
            {stale ? (
              <p className="data-freshness-state">
                Dane mogą być nieaktualne — potwierdź je w źródle.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function ExactTime({ date, now }: { date: Date; now: Date }) {
  return (
    <time
      dateTime={date.toISOString()}
      title={`${formatFull(date)} · Europe/Warsaw`}
    >
      {formatDateTime(date, now)}
    </time>
  )
}
