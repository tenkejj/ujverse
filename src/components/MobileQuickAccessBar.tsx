import type { LucideIcon } from 'lucide-react'
import { ICONS_MOBILE } from '../styles/mobile-theme'

const linkCls =
  'm-0 flex w-full min-w-0 flex-col items-center justify-center gap-1 px-0 py-1.5 text-center text-zinc-600 transition-colors hover:text-[#1e293b] active:text-[#1e293b] dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-zinc-100 [-webkit-tap-highlight-color:transparent]'

const labelCls =
  'text-[10px] font-medium leading-none tracking-wide text-zinc-600 dark:text-zinc-400'

type Item = { label: string; href: string; Icon: LucideIcon }

type Props = {
  items: readonly Item[]
}

/** Minimalistyczny wiersz linków (ikona + podpis), jak dolna nawigacja — bez pigułek. */
export default function MobileQuickAccessBar({ items }: Props) {
  return (
    <div className="m-0 grid w-full min-w-0 grid-cols-3 px-0 py-0.5">
      {items.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
        >
          <Icon
            size={ICONS_MOBILE.bottomNavIconSize}
            strokeWidth={ICONS_MOBILE.bottomNavInactiveStrokeWidth}
            className="shrink-0 text-[#1e293b] dark:text-zinc-300"
            aria-hidden
          />
          <span className={labelCls}>{label}</span>
        </a>
      ))}
    </div>
  )
}
