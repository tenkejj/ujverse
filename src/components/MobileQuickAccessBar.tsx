import type { LucideIcon } from 'lucide-react'

const barCls =
  'm-0 grid w-full min-w-0 grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-black/35 py-2 backdrop-blur-md dark:bg-black/35'

type Item = { label: string; href: string; Icon: LucideIcon }

type Props = {
  items: readonly Item[]
}

export default function MobileQuickAccessBar({ items }: Props) {
  return (
    <div className={barCls}>
      {items.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="m-0 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-center transition-colors hover:bg-white/10 active:bg-white/5"
        >
          <span className="flex h-5 w-full items-center justify-center">
            <Icon
              size={18}
              className="shrink-0 text-[#a48955] dark:text-brand-gold-bright"
              strokeWidth={2}
              aria-hidden
            />
          </span>
          <span className="block w-full text-center text-[8px] font-semibold uppercase leading-tight tracking-wide text-slate-700 dark:text-slate-300">
            {label}
          </span>
        </a>
      ))}
    </div>
  )
}
