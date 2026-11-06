import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { normalizeSearchQuery } from '../../lib/info/search'

function isEditableTarget(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

/**
 * Pole wyszukiwania informacji w nagłówku (od `md`). Enter → `/szukaj?q=`.
 * Ctrl/Cmd+K ustawia fokus w polu, a gdy pole jest niewidoczne (mobile) —
 * otwiera stronę wyszukiwarki.
 */
export default function HeaderSearch({ className = '' }: { className?: string }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      const active = document.activeElement
      if (active !== inputRef.current && isEditableTarget(active)) return
      event.preventDefault()
      const input = inputRef.current
      if (input && input.offsetParent !== null) {
        input.focus()
        input.select()
      } else {
        navigate('/szukaj')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const query = normalizeSearchQuery(value)
    navigate(query ? `/szukaj?q=${encodeURIComponent(query)}` : '/szukaj', {
      state: { searchNonce: Date.now() },
    })
    setValue('')
    inputRef.current?.blur()
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={
        'campus-header-search relative hidden h-10 w-full min-w-0 max-w-80 items-center gap-2 rounded-2xl px-3.5 md:flex ' +
        'backdrop-blur-md backdrop-saturate-150 border border-white/55 bg-white/55 ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_8px_-3px_rgba(15,23,42,0.1)] ' +
        'transition-colors duration-200 focus-within:border-brand-ink/40 ' +
        'dark:border-white/10 dark:bg-bg-card/80 dark:shadow-none dark:focus-within:border-brand-gold-bright/45 ' +
        className
      }
    >
      <Search strokeWidth={2} className="size-5 shrink-0 text-brand-ink dark:text-zinc-400" aria-hidden />
      <label htmlFor="header-info-search" className="sr-only">
        Szukaj komunikatów, rejestracji i wydarzeń
      </label>
      <input
        ref={inputRef}
        id="header-info-search"
        type="search"
        name="ujverse-omni-search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Szukaj na UJ…"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className="ujverse-search-input h-full w-full min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-500 caret-brand-ink dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:caret-brand-gold-bright"
      />
      {!focused && value.length === 0 ? (
        <kbd
          aria-hidden
          className="hidden shrink-0 rounded-md border border-zinc-300/80 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-zinc-500 lg:inline dark:border-white/15 dark:text-zinc-400"
        >
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      ) : null}
    </form>
  )
}
