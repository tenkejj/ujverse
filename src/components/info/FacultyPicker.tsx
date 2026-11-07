import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Landmark, Search, X } from 'lucide-react'
import { DEPT_SHORT, UJ_DEPARTMENTS } from '../../lib/departments'
import type { FacultySource } from '../../lib/info/preferences'
import { useDialogA11y } from './useDialogA11y'
import '../../styles/faculty-picker.css'

type Props = {
  faculty: string | null
  source: FacultySource
  persistent: boolean
  onChange: (faculty: string | null) => void
  className?: string
  variant?: 'chip' | 'hero'
}

const FACULTIES = UJ_DEPARTMENTS.map((name) => ({
  value: name,
  short: DEPT_SHORT[name] ?? name,
  name: name.replace(/^Wydział\s+/, ''),
}))

function searchText(value: string) {
  return value
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
}

export default function FacultyPicker({
  faculty,
  source,
  persistent,
  onChange,
  className = '',
  variant = 'chip',
}: Props) {
  const [open, setOpen] = useState(false)
  const needsChoice = !faculty && source === 'none'
  const selection = faculty?.replace(/^Wydział\s+/, '') ?? 'Wszystkie wydziały'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Twój wydział: ${faculty ?? 'wszystkie wydziały'}. ${needsChoice ? 'Wybierz wydział' : 'Zmień wydział'}`}
        title={
          faculty ?? 'Wybierz wydział, by dopasować komunikaty i rejestracje'
        }
        className={`faculty-picker faculty-selector ${needsChoice ? 'faculty-picker-needs-choice' : ''} ${variant === 'hero' ? 'faculty-selector-hero' : ''} ${className}`.trim()}
      >
        <span className="faculty-picker-icon" aria-hidden="true">
          <Landmark size={20} strokeWidth={1.75} />
        </span>
        <span className="faculty-picker-copy">
          <span className="faculty-picker-label">Twój wydział</span>
          <span className="faculty-picker-value">{selection}</span>
        </span>
        {needsChoice ? (
          <span className="faculty-selector-hint">
            Dopasuj komunikaty i rejestracje
          </span>
        ) : null}
        <span className="faculty-picker-action">
          <span>
            {needsChoice ? 'Wybierz' : 'Zmień'}
            <span className="faculty-selector-action-suffix"> wydział</span>
          </span>
          <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
        </span>
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <FacultyDialog
              faculty={faculty}
              source={source}
              persistent={persistent}
              onClose={() => setOpen(false)}
              onSelect={(next) => {
                onChange(next)
                setOpen(false)
              }}
            />,
            document.body,
          )
        : null}
    </>
  )
}

function FacultyDialog({
  faculty,
  source,
  persistent,
  onClose,
  onSelect,
}: {
  faculty: string | null
  source: FacultySource
  persistent: boolean
  onClose: () => void
  onSelect: (faculty: string | null) => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const searchId = useId()
  const listTitleId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  useDialogA11y(true, panelRef, onClose, searchRef)

  const terms = searchText(query).trim().split(/\s+/).filter(Boolean)
  const options = FACULTIES.filter((option) => {
    const searchable = searchText(`${option.value} ${option.short}`)
    return terms.every((term) => searchable.includes(term))
  })
  const clearSearch = () => {
    setQuery('')
    searchRef.current?.focus()
  }

  return (
    <div className="faculty-dialog-layer">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="faculty-dialog-backdrop"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="faculty-dialog"
      >
        <header className="faculty-dialog-header">
          <div>
            <h2 id={titleId}>Wybierz wydział</h2>
            <p id={descriptionId}>
              Dopasujemy komunikaty i rejestracje do Twojego wyboru.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij wybór wydziału"
            className="faculty-dialog-close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="faculty-dialog-search">
          <label htmlFor={searchId}>Szukaj wydziału</label>
          <div className="faculty-search-field">
            <Search size={18} aria-hidden="true" />
            <input
              ref={searchRef}
              id={searchId}
              name="faculty-search"
              type="search"
              autoComplete="off"
              placeholder="Nazwa lub skrót, np. WMI"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Wyczyść wyszukiwanie"
              >
                <X size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="faculty-dialog-content">
          <button
            type="button"
            aria-pressed={faculty === null}
            onClick={() => onSelect(null)}
            className="faculty-all-option"
          >
            <span className="faculty-option-abbreviation" aria-hidden="true">
              <Landmark size={20} strokeWidth={1.75} />
            </span>
            <span className="faculty-option-copy">
              <strong>Wszystkie wydziały</strong>
              <span>Informacje z całego UJ</span>
            </span>
            {faculty === null ? <Check size={18} aria-hidden="true" /> : null}
          </button>

          <div className="faculty-results-heading">
            <h3 id={listTitleId}>Wydziały UJ</h3>
            <span>{options.length}</span>
          </div>
          {options.length ? (
            <ul aria-labelledby={listTitleId} className="faculty-option-list">
              {options.map((option) => {
                const active = option.value === faculty
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(option.value)}
                      className="faculty-option"
                    >
                      <span
                        className="faculty-option-abbreviation"
                        aria-hidden="true"
                      >
                        {option.short}
                      </span>
                      <span className="faculty-option-copy">
                        <span className="sr-only">Wydział </span>
                        <strong>{option.name}</strong>
                      </span>
                      {active ? <Check size={18} aria-hidden="true" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="faculty-search-empty" role="status">
              <p>Nie znaleziono wydziału</p>
              <span>Spróbuj pełnej nazwy lub innego skrótu.</span>
              <button type="button" onClick={clearSearch}>
                Wyczyść wyszukiwanie
              </button>
            </div>
          )}
        </div>

        <footer className="faculty-dialog-footer">
          <p>
            {source === 'profile'
              ? 'Zmiana dotyczy tego urządzenia. Wydział w profilu pozostaje bez zmian.'
              : persistent
                ? 'Zapamiętamy wybór w tej przeglądarce. Nie potrzebujesz konta.'
                : 'Wybór obowiązuje w tej karcie. Przeglądarka nie pozwala go zapisać.'}
          </p>
        </footer>
      </div>
    </div>
  )
}
