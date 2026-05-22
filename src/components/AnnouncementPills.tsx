import { useMemo, useState } from 'react'
import { formatLecturerPillLabel } from '../lib/lecturerDisplayName'
import type { AnnouncementMeta, AnnouncementStatus, UnifiedContent } from '../types/content'
import AnnouncementDrawer from './AnnouncementDrawer'

const STATUS_DOT: Record<AnnouncementStatus, string> = {
  cancelled: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]',
  remote: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.45)]',
  duty: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
}

const MAX_PILLS = 24

const scrollTrackCls =
  'scrollbar-hide flex w-full min-w-0 flex-row flex-nowrap justify-start gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth py-1 pl-0! pr-1 scroll-pe-3 [-webkit-overflow-scrolling:touch]'

/** Zgodne z pigułkami wydziałów (`DepartmentFilter`) na mobile. */
const pillBtn =
  'm-0 inline-flex h-9 min-h-[34px] shrink-0 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white active:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:shadow-none dark:backdrop-blur-none dark:hover:bg-white/12 dark:active:bg-white/10'

/** Deduplikacja po `id` + fingerprint (dla legacy rekordów z różnymi id a identyczną treścią). */
function dedupe(items: UnifiedContent<AnnouncementMeta>[]): UnifiedContent<AnnouncementMeta>[] {
  const seenIds = new Set<string>()
  const seenFp = new Set<string>()
  const out: UnifiedContent<AnnouncementMeta>[] = []
  for (const a of items) {
    if (seenIds.has(a.id)) continue
    seenIds.add(a.id)
    const fp = a.metadata.bodyFingerprint?.trim()
    if (fp) {
      if (seenFp.has(fp)) continue
      seenFp.add(fp)
    }
    out.push(a)
  }
  return out
}

type Props = {
  /** Komunikaty już przefiltrowane po wydziale i posortowane (DataService). */
  announcements: UnifiedContent<AnnouncementMeta>[]
  loading: boolean
}

export default function AnnouncementPills({ announcements, loading }: Props) {
  const [openAnn, setOpenAnn] = useState<UnifiedContent<AnnouncementMeta> | null>(null)

  const pills = useMemo(() => dedupe(announcements).slice(0, MAX_PILLS), [announcements])

  return (
    <>
      <div className="relative m-0 w-full min-w-0 md:hidden">
        <div className={scrollTrackCls}>
          {loading ? (
            <>
              {[1, 2, 3, 4, 5].map((k) => (
                <div
                  key={k}
                  className="h-9 min-h-[34px] w-24 shrink-0 animate-pulse rounded-full bg-zinc-200/80 dark:bg-white/10"
                />
              ))}
            </>
          ) : pills.length === 0 ? (
            <span className="flex h-9 min-h-[34px] items-center text-sm text-zinc-500">
              Brak komunikatów
            </span>
          ) : (
            pills.map((ann) => {
              const pillLabel = formatLecturerPillLabel(ann.author.displayName)
              return (
                <button
                  key={ann.metadata.bodyFingerprint?.trim() ? ann.metadata.bodyFingerprint! : ann.id}
                  type="button"
                  onClick={() => setOpenAnn(ann)}
                  className={pillBtn}
                  title={ann.author.displayName}
                >
                  <span
                    className={`inline-block size-2 shrink-0 rounded-full ${STATUS_DOT[ann.metadata.status]}`}
                    aria-hidden
                  />
                  <span>{pillLabel}</span>
                </button>
              )
            })
          )}
        </div>
      </div>

      <AnnouncementDrawer announcement={openAnn} onClose={() => setOpenAnn(null)} />
    </>
  )
}
