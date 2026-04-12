import { useRef, useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { UJ_DEPARTMENTS, DEPT_SHORT } from '../lib/departments'

type Props = {
  selected: string
  onChange: (dept: string) => void
}

const chipBase =
  'shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-full text-sm whitespace-nowrap transition-[color,box-shadow,border-color,background-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]/40 min-h-[44px] md:min-h-0 backdrop-blur-md border'

const chipInactive = `${chipBase} font-medium bg-black/[0.04] border-black/10 text-[#1e293b] hover:bg-black/[0.06] dark:bg-white/5 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.08]`

const chipActive = `${chipBase} font-bold border-[#C5A059] text-[#1e293b] shadow-[0_0_10px_rgba(197,160,89,0.3)] dark:text-white dark:shadow-[0_0_10px_rgba(197,160,89,0.35)] bg-black/[0.06] dark:bg-white/[0.08]`

const navBtnCls =
  'absolute z-20 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full backdrop-blur-sm border transition-colors duration-150 bg-white/90 border-black/10 text-slate-500 hover:text-[#0f172a] dark:bg-white/10 dark:border-white/10 dark:text-slate-400 dark:hover:text-white'

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
    <div className="relative m-0 flex w-full min-w-0 max-w-full items-stretch p-0">
      {canScrollLeft && (
        <button
          type="button"
          onClick={scrollLeft}
          aria-label="Przewiń w lewo"
          className={`${navBtnCls} left-0`}
        >
          <ChevronLeft size={18} />
        </button>
      )}

      <div
        ref={containerRef}
        className="scrollbar-hide m-0 flex w-full min-w-0 max-w-full justify-start gap-2 overflow-x-auto scroll-smooth scroll-pl-0 scroll-pe-4 snap-x py-0 pl-0 pr-4"
      >
        <button
          type="button"
          onClick={() => onChange('')}
          className={`m-0 ${selected === '' ? chipActive : chipInactive}`}
        >
          Wszystkie
        </button>

        {UJ_DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            type="button"
            onClick={() => onChange(dept)}
            className={`m-0 ${selected === dept ? chipActive : chipInactive}`}
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
          className={`${navBtnCls} right-0`}
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  )
}
