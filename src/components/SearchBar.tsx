import { useRef, useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Props = {
  value: string
  onChange: (q: string) => void
}

export default function SearchBar({ value, onChange }: Props) {
  const [isFocused, setIsFocused] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isActive = isFocused || value.length > 0

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
        onChange('')
        setIsFocused(false)
      }
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [mobileOpen, onChange])

  const handleClear = () => {
    onChange('')
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
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder="Szukaj postów..."
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
            {value.length > 0 && (
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
      </div>

      {/* Mobile: icon button → expanding input */}
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
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                placeholder="Szukaj postów..."
                className="w-full h-8 pl-8 pr-8 rounded-full bg-white dark:bg-white/10 border border-uj-orange/40 ring-2 ring-uj-orange/15 text-[13px] text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => { setMobileOpen(false); onChange('') }}
                className="absolute right-2.5 text-slate-400 dark:text-gray-500"
                aria-label="Zamknij"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
