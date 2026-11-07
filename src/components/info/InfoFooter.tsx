import { useId } from 'react'
import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { INFO_RESOURCES, type InfoResource } from '../../lib/info/resources'
import { SourcesNote } from './InfoBlocks'
import '../../styles/info-footer.css'

type Props = {
  isAuthenticated: boolean
  showTools: boolean
  announcementsLatest: string | null
  registrationsLatest: string | null
  registrationsStale: boolean
  eventsLatest: string | null
  now: Date
}

const GROUPS = [
  {
    id: 'university',
    label: 'Serwisy UJ',
    ids: ['usosweb', 'pegaz', 'poczta'],
  },
  {
    id: 'ujverse',
    label: 'Narzędzia UJverse',
    ids: ['sale', 'moj-plan', 'miejsca'],
  },
] as const

/** A single footer groups useful destinations and the origin of the information. */
export default function InfoFooter({
  isAuthenticated,
  showTools,
  announcementsLatest,
  registrationsLatest,
  registrationsStale,
  eventsLatest,
  now,
}: Props) {
  const id = useId()

  return (
    <footer
      className={`info-footer${showTools ? '' : ' info-footer-compact'}`}
      aria-label="Serwisy i informacje o UJverse"
    >
      {showTools ? (
        <section className="info-footer-tools" aria-labelledby={`${id}-tools`}>
          <header className="info-footer-heading">
            <h2 id={`${id}-tools`}>Serwisy i narzędzia</h2>
            <Link to="/niezbednik" className="info-footer-all">
              Cały niezbędnik <ArrowRight size={16} aria-hidden />
            </Link>
          </header>
          <div className="info-footer-groups">
            {GROUPS.map((group) => (
              <nav key={group.id} aria-labelledby={`${id}-${group.id}`}>
                <h3 id={`${id}-${group.id}`}>{group.label}</h3>
                <ul>
                  {group.ids.map((resourceId) => {
                    const resource = INFO_RESOURCES.find(
                      (item) => item.id === resourceId,
                    )
                    return resource ? (
                      <li key={resource.id}>
                        <ResourceLink
                          resource={resource}
                          isAuthenticated={isAuthenticated}
                        />
                      </li>
                    ) : null
                  })}
                </ul>
              </nav>
            ))}
          </div>
        </section>
      ) : null}

      <div className="info-footer-about">
        <p>
          <strong>UJverse</strong> · niezależny projekt studencki.
          <span>Ważne informacje potwierdzaj w źródle.</span>
        </p>
        <details className="info-footer-sources">
          <summary>
            Źródła i aktualność danych
            <ChevronDown size={15} aria-hidden />
          </summary>
          <div className="info-footer-source-content">
            <SourcesNote
              as="div"
              announcementsLatest={announcementsLatest}
              registrationsLatest={registrationsLatest}
              registrationsStale={registrationsStale}
              eventsLatest={eventsLatest}
              now={now}
            />
          </div>
        </details>
      </div>
    </footer>
  )
}

function ResourceLink({
  resource,
  isAuthenticated,
}: {
  resource: InfoResource
  isAuthenticated: boolean
}) {
  const content = (
    <>
      <span className="info-footer-link-copy">
        <span className="info-footer-link-title">
          {resource.label}
          {resource.external ? <ArrowUpRight size={14} aria-hidden /> : null}
        </span>
        <span className="info-footer-link-description">
          {resource.description}
        </span>
      </span>
      {resource.requiresAccount && !isAuthenticated ? (
        <span className="info-footer-account">Wymaga konta</span>
      ) : null}
    </>
  )

  return resource.external ? (
    <a
      className="info-footer-resource"
      href={resource.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {content}
      <span className="sr-only"> (nowa karta)</span>
    </a>
  ) : (
    <Link className="info-footer-resource" to={resource.href}>
      {content}
    </Link>
  )
}
