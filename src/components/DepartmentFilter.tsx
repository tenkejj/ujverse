import { useRef, useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { UJ_DEPARTMENTS, DEPT_SHORT } from '../lib/departments'

type Props = {
  selected: string
  onChange: (dept: string) => void
}

const pillBase =
  'shrink-0 inline-flex items-center justify-center px-4 py-2 md:px-3 md:py-1.5 rounded-full text-sm whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a48955]/35 dark:focus-visible:ring-brand-gold/35 border border-border-app bg-bg-app min-h-[44px] md:min-h-0'

const pillActive = `${pillBase} font-bold text-accent-interactive`

const pillInactive = `${pillBase} font-medium text-[#1e293b] dark:text-slate-200 hover:bg-[#F0EDE4]/60 dark:hover:bg-white/[0.03]`

export default function DepartmentFilter({ selected, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState])

  const scrollLeft = () => {
    containerRef.current?.scrollBy({ left: -200, behavior: 'smooth' })
  }

  const scrollRight = () => {
    containerRef.current?.scrollBy({ left: 200, behavior: 'smooth' })
  }

  return (
    <div className="relative flex items-center w-full">
      {canScrollLeft && (
        <button
          type="button"
          onClick={scrollLeft}
          aria-label="Przewiń w lewo"
          className="absolute left-0 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-bg-app/95 backdrop-blur-sm text-slate-500 border border-border-app hover:text-fg-primary transition-colors duration-150"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      <div
        ref={containerRef}
        className="flex overflow-x-auto scroll-smooth snap-x gap-2 px-8 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        <button
          type="button"
          onClick={() => onChange('')}
          className={selected === '' ? pillActive : pillInactive}
        >
          Wszystkie
        </button>

        {UJ_DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            type="button"
            onClick={() => onChange(dept)}
            className={selected === dept ? pillActive : pillInactive}
          >
            {DEPT_SHORT[dept] ?? dept}
          </button>
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={scrollRight}
          aria-label="Przewiń w prawo"
          className="absolute right-0 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-bg-app/95 backdrop-blur-sm text-slate-500 border border-border-app hover:text-fg-primary transition-colors duration-150"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  )
}
