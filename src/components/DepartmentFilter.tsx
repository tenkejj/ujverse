import { useRef, useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { UJ_DEPARTMENTS, DEPT_SHORT } from '../lib/departments'

type Props = {
  selected: string
  onChange: (dept: string) => void
}

const pillBase =
  'shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all duration-150 focus:outline-none'

const pillActive =
  'bg-uj-blue text-white shadow-uj-soft'

const pillInactive =
  'bg-white dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/20 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-transparent'

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
      {/* Przycisk lewy */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={scrollLeft}
          aria-label="Przewiń w lewo"
          className="absolute left-0 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-dark-bg/80 backdrop-blur-sm text-gray-300 hover:text-white hover:bg-dark-bg transition-all duration-150 shadow-md"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {/* Kontener pigułek */}
      <div
        ref={containerRef}
        className="flex overflow-x-auto scroll-smooth snap-x gap-2 px-8 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Pigułka "Wszystkie" */}
        <button
          type="button"
          onClick={() => onChange('')}
          className={`${pillBase} ${selected === '' ? pillActive : pillInactive}`}
        >
          Wszystkie
        </button>

        {/* Pigułki wydziałów */}
        {UJ_DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            type="button"
            onClick={() => onChange(dept)}
            className={`${pillBase} ${selected === dept ? pillActive : pillInactive}`}
          >
            {DEPT_SHORT[dept] ?? dept}
          </button>
        ))}
      </div>

      {/* Przycisk prawy */}
      {canScrollRight && (
        <button
          type="button"
          onClick={scrollRight}
          aria-label="Przewiń w prawo"
          className="absolute right-0 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-dark-bg/80 backdrop-blur-sm text-gray-300 hover:text-white hover:bg-dark-bg transition-all duration-150 shadow-md"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  )
}
