import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { UJ_DEPARTMENTS, DEPT_SHORT } from '../lib/departments'

type Props = {
  selected: string
  onChange: (dept: string) => void
}

const chipBase =
  'shrink-0 inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/30 min-h-[34px] md:min-h-0 border'

const chipInactive = `${chipBase} font-medium bg-transparent border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-700 dark:bg-transparent dark:border-white/10 dark:text-zinc-100 dark:hover:border-white/20`

const chipActive = `${chipBase} font-semibold bg-transparent border-[#1e293b] text-[#1e293b] dark:text-[#D4AF37] dark:border-[#D4AF37]`

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

  const scrollRight = () => {
    containerRef.current?.scrollBy({ left: 220, behavior: 'smooth' })
  }

  const scrollLeft = () => {
    containerRef.current?.scrollBy({ left: -220, behavior: 'smooth' })
  }

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="m-0 flex w-full min-w-0 max-w-full flex-nowrap justify-start gap-2 overflow-x-auto overscroll-x-contain scrollbar-hide [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:[display:none] py-0 px-4 md:px-6"
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
      {canScrollLeft && (
        <div className="absolute left-0 top-0 z-10 hidden h-full w-12 bg-gradient-to-r from-white to-transparent pointer-events-none dark:from-black/20 md:flex">
          <button
            type="button"
            onClick={scrollLeft}
            aria-label="Przewiń wydziały w lewo"
            className="pointer-events-auto absolute left-1 top-1/2 z-20 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 dark:bg-zinc-800/40 backdrop-blur-md border border-white/20 dark:border-white/10 text-[#1e293b] dark:text-white hover:bg-white/20 dark:hover:bg-zinc-700/60 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 z-10 hidden h-full w-12 bg-gradient-to-l from-white to-transparent pointer-events-none dark:from-black/20 md:flex">
          <button
            type="button"
            onClick={scrollRight}
            aria-label="Przewiń wydziały w prawo"
            className="pointer-events-auto absolute right-1 top-1/2 z-20 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 dark:bg-zinc-800/40 backdrop-blur-md border border-white/20 dark:border-white/10 text-[#1e293b] dark:text-white hover:bg-white/20 dark:hover:bg-zinc-700/60 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
