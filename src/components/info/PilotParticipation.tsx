import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { ChevronDown, Download, FlaskConical, Play, Trash2 } from 'lucide-react'
import {
  exportPilotMetrics,
  getPilotMetricsSnapshot,
  parsePilotMetrics,
  PILOT_TASKS,
  recordPilotVisit,
  setPilotParticipation,
  startPilotTask,
  subscribePilotMetrics,
  summarizePilotMetrics,
  type PilotTask,
} from '../../lib/info/productMetrics'
import '../../styles/pilot-participation.css'

const serverSnapshot = () => null

/** Optional research control; it never sends participant information automatically. */
export default function PilotParticipation() {
  const id = useId()
  const raw = useSyncExternalStore(
    subscribePilotMetrics,
    getPilotMetricsSnapshot,
    serverSnapshot,
  )
  const metrics = parsePilotMetrics(raw)
  const summary = metrics ? summarizePilotMetrics(metrics) : null
  const [task, setTask] = useState<PilotTask>('registration')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    recordPilotVisit()
  }, [])
  const download = () => {
    const report = exportPilotMetrics()
    if (!report) return
    const url = URL.createObjectURL(
      new Blob([report], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'ujverse-moj-pilotaz.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(
      'Raport pobrano na urządzenie. Sam zdecydujesz, czy przekazać go osobie prowadzącej pilotaż.',
    )
  }
  return (
    <details className="pilot-participation">
      <summary>
        <FlaskConical size={16} aria-hidden /> Pomóż sprawdzić UJverse{' '}
        <ChevronDown size={14} aria-hidden />
      </summary>
      <div className="pilot-participation-content">
        <p>
          Możesz dobrowolnie włączyć lokalny pomiar pilotażu. Zapisze dni
          odwiedzin, liczbę otwartych źródeł i czas dojścia do źródła w zadaniu.
          Bez treści pytań, linków ani danych konta.
        </p>
        <p>
          Ten pomiar niczego nie wysyła automatycznie. Dane zostają w tej
          przeglądarce do 28 dni; możesz pobrać raport lub usunąć go wcześniej.
          Inne urządzenie lub wyczyszczenie pamięci rozpocznie oddzielną
          obserwację.
        </p>
        <label className="pilot-participation-consent">
          <input
            type="checkbox"
            checked={Boolean(metrics)}
            onChange={(event) => {
              setPilotParticipation(event.target.checked)
              setNotice(
                event.target.checked
                  ? 'Pomiar lokalny włączony.'
                  : 'Pomiar wyłączony, lokalne dane usunięte.',
              )
            }}
          />
          Zgadzam się na ten lokalny pomiar pilotażu
        </label>
        {metrics && summary ? (
          <>
            <dl className="pilot-participation-summary">
              <div>
                <dt>Dni odwiedzin</dt>
                <dd>{summary.activeDays}</dd>
              </div>
              <div>
                <dt>Kliknięcia źródeł</dt>
                <dd>{summary.sourceOpens}</dd>
              </div>
              <div>
                <dt>Źródło w minutę</dt>
                <dd>{summary.tasksWithSourceWithinMinute}</dd>
              </div>
            </dl>
            <div className="pilot-participation-task">
              <label htmlFor={`${id}-task`}>
                Krótkie zadanie do sprawdzenia
              </label>
              <select
                id={`${id}-task`}
                value={task}
                onChange={(event) => setTask(event.target.value as PilotTask)}
              >
                {Object.entries(PILOT_TASKS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setNotice(
                    startPilotTask(task)
                      ? 'Zadanie rozpoczęte. Znajdź potrzebną informację i otwórz jej oficjalne źródło. Możesz korzystać ze strony jak zwykle.'
                      : 'Nie można rozpocząć zadania. Pomiar obejmuje maksymalnie 50 prób; możesz pobrać raport.',
                  )
                }}
              >
                <Play size={16} aria-hidden /> Zacznij zadanie
              </button>
            </div>
            <p>
              Otworzenie źródła pokazuje, że udało się do niego dotrzeć. Nie
              potwierdza wykonania formalności ani poprawności odpowiedzi.
              Powrót po tygodniu oceniamy dopiero po upływie odpowiedniego
              czasu.
            </p>
            <div className="pilot-participation-actions">
              <button type="button" onClick={download}>
                <Download size={16} aria-hidden /> Pobierz mój raport
              </button>
              <button
                type="button"
                onClick={() => {
                  setPilotParticipation(false)
                  setNotice('Pomiar wyłączony, lokalne dane usunięte.')
                }}
              >
                <Trash2 size={16} aria-hidden /> Usuń pomiar
              </button>
            </div>
          </>
        ) : null}
        <p role="status" className="pilot-participation-status">
          {notice}
        </p>
      </div>
    </details>
  )
}
