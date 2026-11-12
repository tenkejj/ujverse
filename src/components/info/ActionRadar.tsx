import { useId, useState } from 'react'
import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  Check,
  Clock3,
  Monitor,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  buildRadarActions,
  type RadarAction,
  type RadarInput,
} from '../../lib/info/actionRadar'
import { formatDateTime, formatFull, parseIsoDate } from '../../lib/info/time'
import { setRadarChecked, useRadarChecks } from '../../hooks/useRadarChecks'
import '../../styles/semantic-items.css'
import '../../styles/action-radar.css'

export type ActionRadarProps = Omit<RadarInput, 'limit'> & {
  announcementsLoading?: boolean
  registrationsLoading?: boolean
  announcementsError?: boolean
  registrationsError?: boolean
  onActionOpen?: (action: RadarAction) => void
  onComplete?: (action: RadarAction, checked: boolean) => void
}

function ActionDate({ action, now }: { action: RadarAction; now: Date }) {
  const date = parseIsoDate(action.date)
  if (date)
    return (
      <p className="action-radar-date">
        <CalendarClock size={15} aria-hidden /> {action.dateLabel}{' '}
        <time dateTime={date.toISOString()} title={formatFull(date)}>
          {formatDateTime(date, now)}
        </time>
      </p>
    )
  if (action.kind === 'registration')
    return <p className="action-radar-date">Źródło nie podaje końca zapisów</p>
  return null
}

export default function ActionRadar(props: ActionRadarProps) {
  const headingId = useId()
  const [expanded, setExpanded] = useState(false)
  const { checks, persistent } = useRadarChecks()
  const allActions = buildRadarActions(props)
  const actions = expanded ? allActions : allActions.slice(0, 3)
  const checkedCount = allActions.filter((action) => checks[action.key]).length
  const loading = props.announcementsLoading || props.registrationsLoading
  const failed = props.announcementsError || props.registrationsError
  return (
    <section
      className="action-radar"
      aria-labelledby={headingId}
      aria-busy={loading || undefined}
    >
      <header className="action-radar-heading">
        <div>
          <h2 id={headingId}>
            <BellRing size={21} aria-hidden /> Nie przegap
          </h2>
          <p>
            {props.faculty
              ? 'Terminy i zmiany z Twojego wydziału. Sprawdź, które dotyczą Ciebie.'
              : 'Sprawy z różnych wydziałów. Wybierz wydział u góry, aby zawęzić wyniki.'}
          </p>
        </div>
        <Link to="/rejestracje">
          Wszystkie rejestracje <ArrowUpRight size={15} aria-hidden />
        </Link>
      </header>
      {failed ? (
        <p className="action-radar-notice" role="status">
          <TriangleAlert size={17} aria-hidden /> Nie udało się pobrać{' '}
          {props.announcementsError && props.registrationsError
            ? 'komunikatów ani rejestracji'
            : props.announcementsError
              ? 'komunikatów'
              : 'rejestracji'}
          . Lista może być niepełna.
        </p>
      ) : null}
      {actions.length ? (
        <ul className="action-radar-items" id={`${headingId}-items`}>
          {actions.map((action) => {
            const checked = Boolean(checks[action.key])
            const evidence = parseIsoDate(action.evidenceAt)
            const Icon =
              action.kind === 'registration'
                ? CalendarClock
                : action.tone === 'remote'
                  ? Monitor
                  : TriangleAlert
            return (
              <li key={action.key}>
                <article
                  className="action-radar-item"
                  data-tone={action.tone}
                  data-checked={checked}
                >
                  <div className="action-radar-item-heading">
                    <Icon size={19} aria-hidden />
                    <h3>{action.action}</h3>
                    {checked ? (
                      <span className="action-radar-checked">
                        <Check size={14} aria-hidden /> Sprawdzone
                      </span>
                    ) : null}
                  </div>
                  <p className="action-radar-title">{action.title}</p>
                  {action.faculty && !props.faculty ? (
                    <p className="action-radar-faculty">{action.faculty}</p>
                  ) : null}
                  <ActionDate action={action} now={props.now} />
                  <p className="action-radar-instruction">
                    {action.instruction}
                  </p>
                  {action.caution ? (
                    <p className="action-radar-caution">{action.caution}</p>
                  ) : null}
                  <p className="action-radar-evidence">
                    <Clock3 size={13} aria-hidden />
                    {action.evidenceLabel}:{' '}
                    {evidence ? (
                      <time
                        dateTime={evidence.toISOString()}
                        title={formatFull(evidence)}
                      >
                        {formatDateTime(evidence, props.now)}
                      </time>
                    ) : (
                      'brak daty potwierdzenia'
                    )}
                  </p>
                  <div className="action-radar-actions">
                    <a
                      href={action.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => props.onActionOpen?.(action)}
                    >
                      {action.sourceLabel}
                      <ArrowUpRight size={15} aria-hidden />
                      <span className="sr-only">
                        (otwiera się w nowej karcie)
                      </span>
                    </a>
                    <button
                      type="button"
                      aria-pressed={checked}
                      aria-label={`${checked ? 'Cofnij oznaczenie sprawdzonej informacji' : 'Oznacz informację jako sprawdzoną'}: ${action.title}`}
                      onClick={() => {
                        setRadarChecked(action.key, !checked)
                        props.onComplete?.(action, !checked)
                      }}
                    >
                      <Check size={16} aria-hidden />
                      {checked ? 'Cofnij oznaczenie' : 'Sprawdzone'}
                    </button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      ) : loading ? (
        <p className="action-radar-empty" role="status">
          Szukam terminów i zmian w dostępnych źródłach…
        </p>
      ) : !failed ? (
        <p className="action-radar-empty">
          W pobranych danych nie ma teraz spraw do pokazania. Możesz sprawdzić{' '}
          <Link to="/komunikaty">wszystkie komunikaty</Link> lub{' '}
          <Link to="/rejestracje">rejestracje</Link>.
        </p>
      ) : null}
      {allActions.length > 3 ? (
        <button
          type="button"
          className="action-radar-expand"
          aria-expanded={expanded}
          aria-controls={`${headingId}-items`}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? 'Pokaż mniej spraw'
            : `Pokaż pozostałe sprawy (${allActions.length - 3})`}
        </button>
      ) : null}
      {actions.length ? (
        <p className="action-radar-local">
          {checkedCount > 0
            ? `Sprawdzone: ${checkedCount} z ${allActions.length}. `
            : ''}
          Oznaczenia{' '}
          {persistent
            ? 'zapisują się na tym urządzeniu'
            : 'są dostępne tylko do zamknięcia tej karty'}
          . Nie potwierdzają zapisania na zajęcia ani załatwienia sprawy w USOS.
        </p>
      ) : null}
    </section>
  )
}
