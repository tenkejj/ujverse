import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  GraduationCap,
  House,
  LifeBuoy,
  RefreshCcw,
} from 'lucide-react'
import {
  findStudentGuide,
  GUIDE_PROGRESS_KEY,
  needsGuideReview,
  parseGuideProgress,
  STUDENT_GUIDES,
  STUDENT_SUPPORT_RESOURCES,
  type StudentGuide,
} from '../../lib/info/guides'
import {
  recordUsefulSourceOpen,
  type PilotTask,
} from '../../lib/info/productMetrics'
import '../../styles/student-guides.css'

const GUIDE_ICONS = {
  'stypendium-rektora': GraduationCap,
  akademik: House,
  'rejestracje-usos': ClipboardList,
}

function SourceLink({
  href,
  children,
  task,
}: {
  href: string
  children: ReactNode
  task?: PilotTask
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => recordUsefulSourceOpen('guide', { task })}
    >
      {children}
      <ArrowUpRight size={14} aria-hidden />
    </a>
  )
}

function SupportResources() {
  return (
    <section
      className="student-guide-support"
      aria-labelledby="guide-support-heading"
    >
      <h2 id="guide-support-heading">
        <LifeBuoy size={20} aria-hidden /> Gdzie jeszcze szukać pomocy?
      </h2>
      <div className="student-guide-support-links">
        {STUDENT_SUPPORT_RESOURCES.map((resource) => (
          <div key={resource.id}>
            <SourceLink href={resource.url}>{resource.title}</SourceLink>
            <p>{resource.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function GuideDetail({ guide }: { guide: StudentGuide }) {
  const pilotTask =
    guide.slug === 'stypendium-rektora' ? 'scholarship' : undefined
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      return (
        parseGuideProgress(localStorage.getItem(GUIDE_PROGRESS_KEY))[
          guide.slug
        ] ?? []
      )
    } catch {
      return []
    }
  })
  const [storageAvailable, setStorageAvailable] = useState(true)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === GUIDE_PROGRESS_KEY || event.key === null)
        setCompleted(parseGuideProgress(event.newValue)[guide.slug] ?? [])
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [guide.slug])
  const save = (next: string[]) => {
    setCompleted(next)
    try {
      const all = parseGuideProgress(localStorage.getItem(GUIDE_PROGRESS_KEY))
      all[guide.slug] = next
      localStorage.setItem(GUIDE_PROGRESS_KEY, JSON.stringify(all))
      setStorageAvailable(true)
    } catch {
      setStorageAvailable(false)
    }
  }
  const checkedDate = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${guide.checkedAt}T12:00:00Z`))
  return (
    <article className="student-guide-detail">
      <Link to="/poradniki" className="student-guide-back">
        <ArrowLeft size={17} aria-hidden /> Wszystkie poradniki
      </Link>
      <header className="student-guide-header">
        <p className="student-guide-scope">{guide.scope}</p>
        <h1>{guide.title}</h1>
        <p>{guide.description}</p>
        <div className="student-guide-meta">
          <span>
            <CalendarDays size={15} aria-hidden /> Rok akademicki{' '}
            {guide.academicYear}
          </span>
          <span>
            Źródła sprawdzono redakcyjnie:{' '}
            <time dateTime={guide.checkedAt}>{checkedDate}</time>
          </span>
        </div>
      </header>
      {needsGuideReview(guide) ? (
        <p className="student-guide-notice" role="status">
          Ten poradnik wymaga ponownego przeglądu. Przed wykonaniem czynności
          sprawdź bieżące zasady w podanych źródłach UJ.
        </p>
      ) : null}
      <section className="student-guide-context" aria-label="Zakres i terminy">
        <div>
          <h2>Kogo dotyczy?</h2>
          <p>{guide.audience}</p>
        </div>
        <div>
          <h2>Jaki termin?</h2>
          <p>{guide.deadline}</p>
        </div>
      </section>
      {guide.exception ? (
        <aside className="student-guide-notice">
          <p>{guide.exception.text}</p>
          <SourceLink href={guide.exception.url} task={pilotTask}>
            {guide.exception.label}
          </SourceLink>
        </aside>
      ) : null}
      <div className="student-guide-layout">
        <section
          className="student-guide-steps"
          aria-labelledby="guide-steps-heading"
        >
          <div className="student-guide-section-heading">
            <h2 id="guide-steps-heading">Krok po kroku</h2>
            <button
              type="button"
              onClick={() => save([])}
              disabled={completed.length === 0}
            >
              <RefreshCcw size={14} aria-hidden /> Wyczyść oznaczenia
            </button>
          </div>
          <div className="student-guide-progress">
            <p id="guide-progress-label">
              Twoja lista na tym urządzeniu: {completed.length} z{' '}
              {guide.steps.length} punktów
            </p>
            <progress
              value={completed.length}
              max={guide.steps.length}
              aria-labelledby="guide-progress-label"
            />
          </div>
          <p className="student-guide-local-note">
            Zaznaczenia pomagają zapamiętać postęp. Nie wysyłają wniosku ani nie
            wykonują czynności w USOSweb.
          </p>
          {!storageAvailable ? (
            <p className="student-guide-notice" role="status">
              Przeglądarka nie pozwala zapisać listy. Oznaczenia pozostaną tylko
              do zamknięcia tego widoku.
            </p>
          ) : null}
          <ol>
            {guide.steps.map((step, index) => (
              <li key={step.id}>
                <label className="student-guide-check">
                  <input
                    type="checkbox"
                    checked={completed.includes(step.id)}
                    onChange={(event) =>
                      save(
                        event.target.checked
                          ? [...completed, step.id]
                          : completed.filter((id) => id !== step.id),
                      )
                    }
                  />
                  <span aria-hidden>
                    {completed.includes(step.id) ? (
                      <Check size={19} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="sr-only">
                    Oznacz jako wykonane: {step.title}
                  </span>
                </label>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <div className="student-guide-step-sources">
                    {step.sourceIds.map((id) => {
                      const source = guide.sources.find(
                        (entry) => entry.id === id,
                      )
                      return source ? (
                        <SourceLink key={id} href={source.url} task={pilotTask}>
                          {source.title}
                        </SourceLink>
                      ) : null
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <aside className="student-guide-aside">
          <section>
            <h2>Przygotuj</h2>
            <ul>
              {guide.prepare.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Gdzie sprawdzić status?</h2>
            <p>{guide.status}</p>
          </section>
          <section>
            <h2>Kto pomoże?</h2>
            <p>{guide.contact.text}</p>
            <SourceLink href={guide.contact.url} task={pilotTask}>
              Kontakt w oficjalnym serwisie
            </SourceLink>
          </section>
        </aside>
      </div>
      <section
        className="student-guide-sources"
        aria-labelledby="guide-sources-heading"
      >
        <h2 id="guide-sources-heading">Oficjalne źródła</h2>
        <ul>
          {guide.sources.map((source) => (
            <li key={source.id}>
              <SourceLink href={source.url} task={pilotTask}>
                {source.title}
              </SourceLink>
            </li>
          ))}
        </ul>
        <p>
          Opracowanie UJverse na podstawie źródeł UJ. Sprawdzenie redakcyjne nie
          oznacza ponownego odczytu Twojego konta ani zatwierdzenia poradnika
          przez uczelnię.
        </p>
      </section>
    </article>
  )
}

/** Public route: /poradniki and /poradniki/:slug; parent router supplies slug. */
export default function StudentGuides({ slug }: { slug?: string | null }) {
  const guide = findStudentGuide(slug)
  if (slug && !guide)
    return (
      <div className="student-guides">
        <h1>Nie znaleziono poradnika</h1>
        <p>Wybierz jeden z dostępnych tematów.</p>
        <Link to="/poradniki" className="student-guide-back">
          Przejdź do poradników
        </Link>
      </div>
    )
  return (
    <div className="student-guides">
      {guide ? (
        <GuideDetail key={guide.slug} guide={guide} />
      ) : (
        <>
          <header className="student-guide-header">
            <p className="student-guide-scope">
              <BookOpen size={17} aria-hidden /> Poradniki UJverse
            </p>
            <h1>Jak załatwić sprawę?</h1>
            <p>
              Wybierz temat. Zobacz, co przygotować, gdzie przejść i jak
              sprawdzić, czy sprawa jest zakończona.
            </p>
          </header>
          <ul className="student-guide-catalogue">
            {STUDENT_GUIDES.map((entry) => {
              const Icon = GUIDE_ICONS[entry.slug]
              return (
                <li key={entry.slug}>
                  <Icon size={25} strokeWidth={1.75} aria-hidden />
                  <div>
                    <h2>
                      <Link to={`/poradniki/${entry.slug}`}>
                        {entry.shortTitle}
                        <ArrowUpRight size={18} aria-hidden />
                      </Link>
                    </h2>
                    <p>{entry.description}</p>
                    <span>
                      Rok {entry.academicYear} · {entry.steps.length} kroków
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="student-guide-local-note">
            Źródła sprawdzono 11 listopada 2026 r. Każdy poradnik podaje zakres,
            terminy i odnośniki do oficjalnych zasad. Listę przygotowań możesz
            zaznaczać lokalnie bez konta.
          </p>
        </>
      )}
      <SupportResources />
    </div>
  )
}
