import { useRef, useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const showDropdown = isFocused && query.length > 1
  const isActive = isFocused || query.length > 0

  useEffect(() => {
    if (mobileOpen) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMobileOpen(false)
        setQuery('')
        setIsFocused(false)
      }
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [mobileOpen])

  const handleClear = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative flex items-center">

      {/* Desktop search input */}
      <div className="hidden sm:block relative">
        <div className="relative flex items-center">
          <Search
            size={14}
            className={`absolute left-3 pointer-events-none transition-colors duration-200 ${
              isActive ? 'text-uj-orange' : 'text-slate-400 dark:text-gray-500'
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder="Szukaj..."
            className={`
              h-8 pl-8 pr-8 rounded-full bg-slate-100 dark:bg-white/8 text-[13px]
              text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500
              border transition-all duration-300 focus:outline-none
              ${isActive
                ? 'w-52 border-uj-orange/40 ring-2 ring-uj-orange/15 bg-white dark:bg-white/10'
                : 'w-36 border-transparent hover:border-slate-200 dark:hover:border-white/10'
              }
            `}
          />
          <AnimatePresence>
            {query.length > 0 && (
              <motion.button
                type="button"
                onClick={handleClear}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-2.5 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"
                aria-label="Wyczyść"
              >
                <X size={12} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Dropdown skeleton — desktop */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-dark-card rounded-2xl shadow-xl dark:shadow-none border border-slate-200 dark:border-white/8 overflow-hidden z-50"
            >
              <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5">
                <p className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                  Wyniki wyszukiwania
                </p>
              </div>
              <div className="p-2 space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-xl">
                    <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-white/10 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div
                        className="h-2.5 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse"
                        style={{ width: `${60 + i * 12}%` }}
                      />
                      <div
                        className="h-2 bg-slate-100 dark:bg-white/5 rounded-full animate-pulse"
                        style={{ width: `${35 + i * 8}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/5 text-center">
                <span className="text-[12px] text-slate-400 dark:text-gray-500">
                  Wyszukiwanie wkrótce dostępne
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile: icon button → full overlay */}
      <div className="sm:hidden">
        <AnimatePresence mode="wait">
          {!mobileOpen ? (
            <motion.button
              key="icon"
              type="button"
              onClick={() => setMobileOpen(true)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 dark:text-gray-400 hover:text-uj-orange hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
              aria-label="Szukaj"
            >
              <Search size={17} />
            </motion.button>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0, width: 36 }}
              animate={{ opacity: 1, width: 180 }}
              exit={{ opacity: 0, width: 36 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center"
            >
              <Search size={13} className="absolute left-3 text-uj-orange pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                placeholder="Szukaj..."
                className="w-full h-8 pl-8 pr-8 rounded-full bg-white dark:bg-white/10 border border-uj-orange/40 ring-2 ring-uj-orange/15 text-[13px] text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => { setMobileOpen(false); setQuery('') }}
                className="absolute right-2.5 text-slate-400 dark:text-gray-500"
                aria-label="Zamknij"
              >
                <X size={12} />
              </button>

              {/* Mobile dropdown */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-dark-card rounded-2xl shadow-xl dark:shadow-none border border-slate-200 dark:border-white/8 overflow-hidden z-50"
                  >
                    <div className="p-2 space-y-1.5">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-xl">
                          <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-white/10 animate-pulse shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-2.5 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse" style={{ width: `${60 + i * 12}%` }} />
                            <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full animate-pulse" style={{ width: `${35 + i * 8}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/5 text-center">
                      <span className="text-[12px] text-slate-400 dark:text-gray-500">Wyszukiwanie wkrótce dostępne</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
