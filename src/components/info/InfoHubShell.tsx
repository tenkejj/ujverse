/** Shared information-page structure: one set of filters, readable content, no dashboard chrome. */
import { useId, type ReactNode } from 'react'
import { Search } from 'lucide-react'

export type HubFilter = { key: string; label: string; count?: number }

export function InfoHubShell({ children }: { children: ReactNode }) {
  return <div className="campus-hub">{children}</div>
}

export function InfoHubTitle({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="campus-page-heading">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="campus-heading-side">{actions}</div> : null}
    </header>
  )
}

export function InfoHubToolbar({
  filters,
  activeKey,
  onFilterChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Szukaj…',
  searchAriaLabel = 'Szukaj',
  trailing,
}: {
  filters: HubFilter[]
  activeKey: string
  onFilterChange: (key: string) => void
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchAriaLabel?: string
  trailing?: ReactNode
}) {
  const inputId = useId()
  return (
    <div className="campus-toolbar">
      <div className="campus-filters" role="group" aria-label="Filtry listy">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            aria-pressed={filter.key === activeKey}
            onClick={() => onFilterChange(filter.key)}
          >
            {filter.label}
            {typeof filter.count === 'number' ? (
              <span>{filter.count}</span>
            ) : null}
          </button>
        ))}
      </div>
      {onSearchChange ? (
        <div className="campus-list-search">
          <Search size={17} aria-hidden />
          <label className="sr-only" htmlFor={inputId}>
            {searchAriaLabel}
          </label>
          <input
            id={inputId}
            type="search"
            name="filter"
            autoComplete="off"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
      ) : null}
      {trailing ? (
        <div className="campus-toolbar-trailing">{trailing}</div>
      ) : null}
    </div>
  )
}

export function InfoHubSection({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section className="campus-hub-section" aria-labelledby={headingId}>
      <div className="campus-section-heading">
        <h2 id={headingId}>{title}</h2>
        {typeof count === 'number' ? (
          <span className="campus-count">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function InfoHubCardGrid({ children }: { children: ReactNode }) {
  return <ul className="campus-entry-list">{children}</ul>
}
