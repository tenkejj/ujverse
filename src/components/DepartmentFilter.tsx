import { UJ_DEPARTMENTS, DEPT_SHORT } from '../lib/departments'
import HorizontalPillScroller from './ui/HorizontalPillScroller'

type Props = {
  selected: string
  onChange: (dept: string) => void
}

const chipBase =
  'shrink-0 inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/30 min-h-[34px] md:min-h-0 border'

const chipInactive = `${chipBase} font-medium bg-transparent border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-700 dark:bg-transparent dark:border-white/10 dark:text-zinc-100 dark:hover:border-white/20`

const chipActive = `${chipBase} font-semibold bg-transparent border-[#1e293b] text-[#1e293b] dark:text-[#D4AF37] dark:border-[#D4AF37]`

const scrollTrackCls =
  'm-0 flex w-full min-w-0 max-w-full flex-nowrap justify-start gap-1.5 overflow-x-auto overscroll-x-contain [touch-action:pan-x] scrollbar-hide scroll-smooth [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0 pl-0 pr-1 md:gap-2 md:px-6'

export default function DepartmentFilter({ selected, onChange }: Props) {
  return (
    <HorizontalPillScroller
      scrollClassName={scrollTrackCls}
      watchDeps={[selected]}
      scrollLeftLabel="Przewiń wydziały w lewo"
      scrollRightLabel="Przewiń wydziały w prawo"
      withMobileEdgeSpacer={false}
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
    </HorizontalPillScroller>
  )
}
