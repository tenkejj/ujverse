import { ZoneIcon } from '../services/TagService'

type Props = {
  slug: string
  title: string
  description: string
  postCountLabel: string | null
}

/**
 * `ZoneHeader` — wspólny hero każdej strefy (`/group/:slug`).
 *
 * Ikona pochodzi z `ZoneIcon` (rejestru w `TagService`), więc nowa strefa
 * dodana do `OFFICIAL_TAGS` automatycznie ma poprawną ikonę bez zmian tutaj.
 *
 * Slug musi pochodzić z routingu (`App.tsx` → `GroupView` → `GroupCard`)
 * — nie zgadujemy go z URL ani z nazwy grupy.
 */
export default function ZoneHeader({ slug, title, description, postCountLabel }: Props) {
  return (
    <header
      className={[
        'relative overflow-hidden rounded-2xl border border-zinc-200/80',
        'bg-gradient-to-br from-white via-zinc-50/90 to-zinc-100/50',
        'px-6 py-7 sm:px-8 sm:py-8',
        'dark:border-white/10 dark:from-zinc-950/90 dark:via-zinc-950/70 dark:to-black/40',
      ].join(' ')}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#1e293b]/5 blur-2xl dark:bg-brand-gold/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#1e293b]/15 to-transparent dark:via-brand-gold/25"
        aria-hidden
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <span
          className={[
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
            'bg-[#1e293b]/8 text-[#1e293b] ring-1 ring-[#1e293b]/10',
            'dark:bg-brand-gold/12 dark:text-brand-gold-bright dark:ring-brand-gold/20',
          ].join(' ')}
        >
          <ZoneIcon slug={slug} className="size-8" strokeWidth={1.5} />
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[#1e293b] dark:text-zinc-50 sm:text-[1.65rem]">
              {title}
            </h1>
            {postCountLabel && (
              <span
                className={[
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  'bg-[#1e293b]/8 text-[#1e293b]/90',
                  'dark:bg-brand-gold/12 dark:text-brand-gold-bright',
                ].join(' ')}
              >
                {postCountLabel}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-xl">
            {description}
          </p>
          <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
            Tag: <span className="text-[#1e293b]/80 dark:text-brand-gold-bright/90">#{slug}</span>
          </p>
        </div>
      </div>
    </header>
  )
}
