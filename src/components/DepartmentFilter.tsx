import { useRef, useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { UJ_DEPARTMENTS, DEPT_SHORT } from '../lib/departments'

type Props = {
  selected: string
  onChange: (dept: string) => void
}

const pillBase =
  'shrink-0 inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[13px] font-sans whitespace-nowrap transition-colors duration-150 focus:outline-none border border-border-app bg-bg-app'

const pillActive = `${pillBase} font-bold text-accent-interactive`

const pillInactive = `${pillBase} font-medium text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5`

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
