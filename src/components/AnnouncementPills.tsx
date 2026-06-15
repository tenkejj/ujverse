import { useMemo, useState } from 'react'
import { formatLecturerPillLabel } from '../lib/lecturerDisplayName'
import { ANNOUNCEMENT_STATUS_DOT } from '../lib/announcementStatusStyles'
import type { AnnouncementMeta, UnifiedContent } from '../types/content'
import AnnouncementDrawer from './AnnouncementDrawer'

// Reuse shared style mapy z `announcementStatusStyles` — jeden Record domknięty
// na pełny union AnnouncementStatus, eliminuje ryzyko rozjazdu z desktop card
// przy dodawaniu kolejnych statusów (TS by zgłosił błąd w obu miejscach).
const STATUS_DOT = ANNOUNCEMENT_STATUS_DOT

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
  /**
   * Komunikaty z `useAnnouncements(selectedDepartment)` (DataService) —
   * już przefiltrowane po wybranym wydziale (pillsy `DepartmentFilter` w
   * `FeedView` sterują `selectedDepartment`).
   */
  announcements: UnifiedContent<AnnouncementMeta>[]
  loading: boolean
  /**
   * Render jako fragment (pills + portal drawer) — bez własnego scroll trackera
   * i wrappera `md:hidden`. Pozwala osadzić pigułki w istniejącym `flex` railu
   * (np. `MobileDashboard`). Empty state nie renderuje nic poza drawerem.
   */
  inline?: boolean
}

export default function AnnouncementPills({ announcements, loading, inline = false }: Props) {
  const [openAnn, setOpenAnn] = useState<UnifiedContent<AnnouncementMeta> | null>(null)

  const pills = useMemo(() => dedupe(announcements).slice(0, MAX_PILLS), [announcements])

  const skeletonNodes = [1, 2, 3, 4, 5].map((k) => (
    <div
      key={`skel-${k}`}
      className="h-9 min-h-[34px] w-24 shrink-0 animate-pulse rounded-full bg-zinc-200/80 dark:bg-white/10"
    />
  ))

  const pillNodes = pills.map((ann) => {
    // Komunikaty wydziałowe (Liferay/WP) mają `title` ale `lecturer_name`
    // = generyczny fallback („Komunikat wydziałowy"). Trzymamy pigułkę
    // krótką: pierwsze ~40 znaków tytułu zamiast bezsensownego nazwiska.
    const facultyTitle = ann.metadata.title?.trim()
    const rawLabel =
      facultyTitle && facultyTitle.length > 0
        ? facultyTitle.length > 42
          ? `${facultyTitle.slice(0, 40)}…`
          : facultyTitle
        : formatLecturerPillLabel(ann.author.displayName)
    const tooltip = facultyTitle ?? ann.author.displayName
    return (
      <button
        key={ann.metadata.bodyFingerprint?.trim() ? ann.metadata.bodyFingerprint! : ann.id}
        type="button"
        onClick={() => setOpenAnn(ann)}
        className={pillBtn}
        title={tooltip}
      >
        <span
          className={`inline-block size-2 shrink-0 rounded-full ${STATUS_DOT[ann.metadata.status]}`}
          aria-hidden
        />
        <span>{rawLabel}</span>
      </button>
    )
  })

  if (inline) {
    return (
      <>
        {loading ? skeletonNodes : pillNodes}
        <AnnouncementDrawer announcement={openAnn} onClose={() => setOpenAnn(null)} />
      </>
    )
  }

  return (
    <>
      <div className="relative m-0 w-full min-w-0 md:hidden">
        <div className={scrollTrackCls}>
          {loading ? (
            skeletonNodes
          ) : pills.length === 0 ? (
            <span className="flex h-9 min-h-[34px] items-center text-sm text-zinc-500">
              Brak komunikatów
            </span>
          ) : (
            pillNodes
          )}
        </div>
      </div>

      <AnnouncementDrawer announcement={openAnn} onClose={() => setOpenAnn(null)} />
    </>
  )
}
