import { useState } from 'react'
import type { FormEvent } from 'react'
import { Search } from 'lucide-react'
import { SEARCH_MOBILE } from '../styles/mobile-theme'

type Props = {
  onNavigateToSearch: (query?: string) => void
  variant?: 'icon' | 'inlineCapsule'
}

export default function HeaderSearchTrigger({ onNavigateToSearch, variant = 'icon' }: Props) {
  const [query, setQuery] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onNavigateToSearch(query)
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => onNavigateToSearch()}
        className={SEARCH_MOBILE.triggerButtonClass}
        aria-label="Szukaj"
      >
        <Search size={20} strokeWidth={2} className="shrink-0 md:stroke-2" />
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="hidden md:flex">
      <label className="sr-only" htmlFor="header-inline-search-input">
        Szukaj
      </label>
      <div className="flex h-9 lg:h-10 w-52 lg:w-60 xl:w-72 shrink-0 items-center rounded-full border border-zinc-200 bg-white/80 px-3.5 backdrop-blur-md transition-colors duration-200 focus-within:border-[#1e293b]/35 dark:border-white/10 dark:bg-bg-card/80 dark:focus-within:border-brand-gold-bright/40">
        <Search size={16} strokeWidth={2} className="mr-2.5 shrink-0 text-[#1e293b] dark:text-zinc-400" />
        <input
          id="header-inline-search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj"
          className="h-full w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-500 dark:text-zinc-200 dark:placeholder:text-zinc-500"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </form>
  )
}
