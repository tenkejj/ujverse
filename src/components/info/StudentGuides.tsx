import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check,
  ChevronDown, CircleCheck, ClipboardList, FileCheck2, HeartHandshake,
  House, Info, LifeBuoy, RefreshCcw, Search, ShieldCheck, Users, Wallet, X,
} from 'lucide-react'
import {
  findStudentGuide, GUIDE_PROGRESS_KEY, needsGuideReview,
  parseGuideProgress, STUDENT_GUIDES, STUDENT_SUPPORT_RESOURCES,
  type StudentGuide,
} from '../../lib/info/guides'
import { recordUsefulSourceOpen, type PilotTask } from '../../lib/info/productMetrics'
import GuideIllustration, { type GuideCategory } from './GuideIllustration'
import '../../styles/student-guides.css'

const GUIDE_CATEGORIES = {
  finanse: { label: 'Finanse', Icon: Wallet },
  studia: { label: 'Studia', Icon: BookOpen },
  codziennosc: { label: 'Na co dzień', Icon: House },
  wsparcie: { label: 'Wsparcie', Icon: HeartHandshake },
} as const

function guideCategory(guide: StudentGuide): GuideCategory {
  return guide.category ?? (guide.slug === 'akademik' ? 'codziennosc' : guide.slug === 'stypendium-rektora' ? 'finanse' : 'studia')
}

function SourceLink({ href, children, task, className }: {
  href: string; children: ReactNode; task?: PilotTask; className?: string
}) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer" onClick={() => recordUsefulSourceOpen('guide', { task })}>
      {children}<ArrowUpRight size={16} aria-hidden />
    </a>
  )
}

function SupportResources() {
  return (
    <section className="student-guide-support" aria-labelledby="guide-support-heading">
      <div className="student-guide-section-heading">
        <h2 id="guide-support-heading"><LifeBuoy size={21} aria-hidden /> Nie znajdujesz swojej sprawy?</h2>
        <Link to="/chat" className="student-guide-assistant-link">Zapytaj Versusia <ArrowRight size={16} aria-hidden /></Link>
      </div>
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
  const pilotTask = guide.slug === 'stypendium-rektora' ? 'scholarship' : undefined
  const category = guideCategory(guide)
  const { label: categoryLabel, Icon: CategoryIcon } = GUIDE_CATEGORIES[category]
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      return parseGuideProgress(localStorage.getItem(GUIDE_PROGRESS_KEY))[guide.slug] ?? []
    } catch {
      return []
    }
  })
  const [expandedStep, setExpandedStep] = useState<string | null>(() => guide.steps.find((step) => !completed.includes(step.id))?.id ?? null)
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
  const goToStep = (stepId: string) => {
    setExpandedStep(stepId)
    requestAnimationFrame(() => {
      const target = document.getElementById(`guide-step-${stepId}`)
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'nearest' })
    })
  }
  const checkedDate = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${guide.checkedAt}T12:00:00Z`))
  const facts = guide.quickFacts ?? [`${guide.steps.length} kroków do sprawdzenia`, 'Oficjalne źródła UJ', 'Postęp bez zakładania konta']
  const primaryAction = guide.primaryAction ?? { label: 'Otwórz oficjalne zasady', url: guide.sources[0].url }
  return (
    <article className={`student-guide-detail guide-topic-${category}`}>
      <Link to="/poradniki" className="student-guide-back"><ArrowLeft size={17} aria-hidden /> Wszystkie poradniki</Link>
      <header className="student-guide-header student-guide-detail-hero">
        <div className="student-guide-hero-copy">
          <span className="student-guide-category"><CategoryIcon size={16} aria-hidden /> {categoryLabel}</span>
          <h1>{guide.title}</h1>
          <p>{guide.description}</p>
          <SourceLink href={primaryAction.url} task={pilotTask} className="student-guide-primary-action">{primaryAction.label}</SourceLink>
        </div>
        <div className="student-guide-hero-art"><GuideIllustration category={category} guideSlug={guide.slug} /></div>
      </header>
      <ul className="student-guide-facts" aria-label="W skrócie">
        {facts.map((fact) => <li key={fact}><Info size={18} aria-hidden /><span>{fact}</span></li>)}
      </ul>
      <div className="student-guide-meta">
        <span><CalendarDays size={15} aria-hidden /> Rok {guide.academicYear}</span>
        <span><ShieldCheck size={15} aria-hidden /> Źródła sprawdzone: <time dateTime={guide.checkedAt}>{checkedDate}</time></span>
      </div>
      {needsGuideReview(guide) ? <p className="student-guide-notice" role="status">Ten poradnik wymaga ponownego przeglądu. Przed wykonaniem czynności sprawdź bieżące zasady w podanych źródłach UJ.</p> : null}
      <div className="student-guide-context">
        <details>
          <summary><Users size={18} aria-hidden /><span>Kogo dotyczy?</span><ChevronDown size={17} aria-hidden /></summary>
          <div><p className="student-guide-scope">{guide.scope}</p><p>{guide.audience}</p></div>
        </details>
        <details>
          <summary><CalendarDays size={18} aria-hidden /><span>Terminy i ważne zasady</span><ChevronDown size={17} aria-hidden /></summary>
          <div><p>{guide.deadline}</p></div>
        </details>
      </div>
      {guide.exception ? <aside className="student-guide-notice"><p>{guide.exception.text}</p><SourceLink href={guide.exception.url} task={pilotTask}>{guide.exception.label}</SourceLink></aside> : null}
      <details className="student-guide-preparation">
        <summary><ClipboardList size={20} aria-hidden /><span><strong>Zanim zaczniesz</strong><small>Co przygotować · {guide.prepare.length} rzeczy</small></span><ChevronDown size={18} aria-hidden /></summary>
        <ul>{guide.prepare.map((item) => <li key={item}><FileCheck2 size={18} aria-hidden /><span>{item}</span></li>)}</ul>
      </details>
      <div className="student-guide-layout">
        <section className="student-guide-steps" aria-labelledby="guide-steps-heading">
          <div className="student-guide-section-heading">
            <h2 id="guide-steps-heading">Twoja ścieżka krok po kroku</h2>
            <button type="button" className="student-guide-reset" onClick={() => { save([]); setExpandedStep(guide.steps[0]?.id ?? null) }} disabled={completed.length === 0}><RefreshCcw size={14} aria-hidden /> Wyczyść</button>
          </div>
          <div className="student-guide-progress">
            <p id="guide-progress-label"><span>Oznaczone na tym urządzeniu</span><strong>{completed.length} z {guide.steps.length}</strong></p>
            <progress value={completed.length} max={guide.steps.length} aria-labelledby="guide-progress-label" />
          </div>
          <p className="student-guide-local-note">Zaznaczenia pomagają zapamiętać postęp. Nie wykonują formalności za Ciebie.</p>
          {!storageAvailable ? <p className="student-guide-notice" role="status">Przeglądarka nie pozwala zapisać listy. Oznaczenia pozostaną tylko do zamknięcia tego widoku.</p> : null}
          <ol>
            {guide.steps.map((step, index) => {
              const checked = completed.includes(step.id)
              const nextStep = guide.steps[index + 1]
              return (
                <li key={step.id} className={`${expandedStep === step.id ? 'is-expanded' : ''}${checked ? ' is-checked' : ''}`}>
                  <label className="student-guide-check">
                    <input type="checkbox" checked={checked} onChange={(event) => save(event.target.checked ? [...completed, step.id] : completed.filter((id) => id !== step.id))} />
                    <span aria-hidden>{checked ? <Check size={19} /> : index + 1}</span>
                    <span className="sr-only">Oznacz jako wykonane: {step.title}</span>
                  </label>
                  <details open={expandedStep === step.id} onToggle={(event) => {
                    const isOpen = event.currentTarget.open
                    setExpandedStep((current) => isOpen ? step.id : current === step.id ? null : current)
                  }}>
                    <summary id={`guide-step-${step.id}`}><h3>{step.title}</h3><ChevronDown size={18} aria-hidden /></summary>
                    <div className="student-guide-step-body">
                      <p>{step.description}</p>
                      <div className="student-guide-step-sources">
                        {step.sourceIds.map((id) => {
                          const source = guide.sources.find((entry) => entry.id === id)
                          return source ? <SourceLink key={id} href={source.url} task={pilotTask}>{source.title}</SourceLink> : null
                        })}
                      </div>
                      {nextStep ? <button type="button" className="student-guide-next" onClick={() => goToStep(nextStep.id)}>Dalej: krok {index + 2} <ArrowRight size={16} aria-hidden /></button> : null}
                    </div>
                  </details>
                </li>
              )
            })}
          </ol>
        </section>
        <aside className="student-guide-aside">
          <section className="student-guide-result">
            <span className="student-guide-side-icon"><CircleCheck size={23} aria-hidden /></span>
            <h2>Jak sprawdzić wynik?</h2>
            <p>{guide.status}</p>
          </section>
          <section className="student-guide-contact">
            <span className="student-guide-side-icon"><LifeBuoy size={23} aria-hidden /></span>
            <h2>Potrzebujesz pomocy?</h2>
            <p>{guide.contact.text}</p>
            <SourceLink href={guide.contact.url} task={pilotTask}>Kontakt w serwisie UJ</SourceLink>
          </section>
        </aside>
      </div>
      <details className="student-guide-sources">
        <summary><ShieldCheck size={20} aria-hidden /><span>Oficjalne źródła <small>{guide.sources.length} odnośników</small></span><ChevronDown size={18} aria-hidden /></summary>
        <ul>{guide.sources.map((source) => <li key={source.id}><SourceLink href={source.url} task={pilotTask}>{source.title}</SourceLink></li>)}</ul>
        <p>Opracowanie UJverse na podstawie źródeł UJ. Sprawdzenie redakcyjne nie oznacza odczytu Twojego konta ani zatwierdzenia poradnika przez uczelnię.</p>
      </details>
    </article>
  )
}

function GuideCatalogue() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const category = params.get('kategoria') ?? 'all'
  const normalize = (value: string) => value.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l')
  const normalizedQuery = normalize(query.trim())
  const visibleGuides = STUDENT_GUIDES.filter((entry) => (category === 'all' || category === guideCategory(entry)) && normalize(`${entry.title} ${entry.description} ${entry.shortTitle}`).includes(normalizedQuery))
  const setFilter = (name: string, value: string) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    if (value && value !== 'all') next.set(name, value)
    else next.delete(name)
    return next
  }, { replace: true })
  return (
    <>
      <header className="student-guide-header student-guide-catalogue-hero guide-topic-studia">
        <div>
          <p className="student-guide-scope"><BookOpen size={17} aria-hidden /> Poradniki UJverse</p>
          <h1>Jak załatwić sprawę?</h1>
          <p>Od „gdzie zacząć?” do właściwego formularza. Wybierz temat i przejdź przez kolejne kroki.</p>
          <div className="student-guide-catalogue-trust"><ShieldCheck size={17} aria-hidden /><span>Oficjalne źródła UJ</span><span aria-hidden>·</span><span>Bez logowania</span></div>
        </div>
        <div className="student-guide-catalogue-art"><GuideIllustration overview /></div>
      </header>
      <div className="student-guide-find">
        <div className="student-guide-search"><Search size={19} aria-hidden /><label className="sr-only" htmlFor="student-guide-search-input">Znajdź poradnik</label><input id="student-guide-search-input" type="search" value={query} onChange={(event) => setFilter('q', event.target.value)} placeholder="Czego potrzebujesz?" />{query ? <button type="button" aria-label="Wyczyść wyszukiwanie poradników" onClick={() => setFilter('q', '')}><X size={17} aria-hidden /></button> : null}</div>
        <div className="student-guide-filters" role="group" aria-label="Kategorie poradników">
          <button type="button" aria-pressed={category === 'all'} onClick={() => setFilter('kategoria', 'all')}>Wszystkie</button>
          {Object.entries(GUIDE_CATEGORIES).map(([value, { label, Icon }]) => <button type="button" key={value} className={`guide-topic-${value}`} aria-pressed={category === value} onClick={() => setFilter('kategoria', value)}><Icon size={16} aria-hidden />{label}</button>)}
        </div>
      </div>
      <p className="student-guide-results-count" role="status">{visibleGuides.length === STUDENT_GUIDES.length ? `${visibleGuides.length} poradników na studenckie sprawy` : `Znalezione poradniki: ${visibleGuides.length}`}</p>
      {visibleGuides.length ? (
        <ul className="student-guide-catalogue">
          {visibleGuides.map((entry) => {
            const topic = guideCategory(entry)
            const { label, Icon } = GUIDE_CATEGORIES[topic]
            return (
              <li key={entry.slug} className={`guide-topic-${topic}`}>
                <Link to={`/poradniki/${entry.slug}`} className="student-guide-card">
                  <div className="student-guide-card-art"><span className="student-guide-category"><Icon size={14} aria-hidden />{label}</span><GuideIllustration category={topic} guideSlug={entry.slug} /></div>
                  <div className="student-guide-card-copy"><h2>{entry.shortTitle}</h2><p>{entry.description}</p><span className="student-guide-card-bottom"><span><ClipboardList size={15} aria-hidden /> {entry.steps.length} kroków</span><span>Zobacz poradnik <ArrowRight size={17} aria-hidden /></span></span></div>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="student-guide-empty"><Search size={28} aria-hidden /><h2>Poszukajmy inaczej</h2><p>Spróbuj krótszej nazwy albo wybierz inną kategorię.</p><button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Pokaż wszystkie poradniki</button></div>
      )}
      <p className="student-guide-local-note student-guide-catalogue-note"><ShieldCheck size={16} aria-hidden />Każdy poradnik podaje datę sprawdzenia i oficjalne źródła. Twoja lista kroków zapisuje się lokalnie, bez konta.</p>
    </>
  )
}

/** Public route: /poradniki and /poradniki/:slug; parent router supplies slug. */
export default function StudentGuides({ slug }: { slug?: string | null }) {
  const guide = findStudentGuide(slug)
  if (slug && !guide) return (
    <div className="student-guides"><h1>Nie znaleziono poradnika</h1><p>Wybierz jeden z dostępnych tematów.</p><Link to="/poradniki" className="student-guide-back">Przejdź do poradników <ArrowRight size={17} aria-hidden /></Link></div>
  )
  return (
    <div className="student-guides">
      {guide ? <GuideDetail key={guide.slug} guide={guide} /> : <GuideCatalogue />}
      <SupportResources />
    </div>
  )
}
