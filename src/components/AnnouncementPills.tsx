import { useMemo, useState } from 'react'
import { canonicalDepartment } from '../lib/departments'
import { sortAnnouncements } from '../hooks/useAnnouncements'
import type { AcademicAnnouncement, AnnouncementStatus } from '../types'
import AnnouncementDrawer from './AnnouncementDrawer'

const STATUS_DOT: Record<AnnouncementStatus, string> = {
  cancelled: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]',
  remote: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.45)]',
  duty: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
}

function filterByDepartment(
  items: AcademicAnnouncement[],
  selectedDepartment: string,
): AcademicAnnouncement[] {
  if (!selectedDepartment.trim()) return items
  const sel = canonicalDepartment(selectedDepartment)
  if (!sel) return items
  return items.filter((a) => {
    const rowDept = canonicalDepartment(a.department)
    if (rowDept == null) return true
    return rowDept === sel
  })
}

const MAX_PILLS = 24

/** Jedna pozycja na `id` (pierwsze wystąpienie w tablicy). */
function uniqueAnnouncementsById(items: AcademicAnnouncement[]): AcademicAnnouncement[] {
  const uniqueIds = Array.from(new Set(items.map((a) => a.id)))
  return uniqueIds
    .map((id) => items.find((a) => a.id === id))
    .filter((a): a is AcademicAnnouncement => a != null)
}

/** Gdy `body_fingerprint` jest znany — jedna pigułka na treść (różne `id` w starych danych). */
function uniqueAnnouncementsByFingerprint(items: AcademicAnnouncement[]): AcademicAnnouncement[] {
  const seenFp = new Set<string>()
  const out: AcademicAnnouncement[] = []
  for (const a of items) {
    const fp = a.body_fingerprint?.trim()
    if (fp) {
      if (seenFp.has(fp)) continue
      seenFp.add(fp)
    }
    out.push(a)
  }
  return out
}

type Props = {
  selectedDepartment: string
  announcements: AcademicAnnouncement[]
  loading: boolean
}

export default function AnnouncementPills({
  selectedDepartment,
  announcements,
  loading,
}: Props) {
  const [openAnn, setOpenAnn] = useState<AcademicAnnouncement | null>(null)

  const pills = useMemo(() => {
    const unique = uniqueAnnouncementsById(announcements)
    const filtered = filterByDepartment(unique, selectedDepartment)
    const sorted = sortAnnouncements(filtered)
    const deduped = uniqueAnnouncementsByFingerprint(sorted)
    return deduped.slice(0, MAX_PILLS)
  }, [announcements, selectedDepartment])

  const pillBtn =
    'm-0 inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 text-left shadow-sm backdrop-blur-sm transition-colors hover:bg-white active:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none dark:backdrop-blur-none dark:hover:bg-white/12 dark:active:bg-white/10'

  return (
    <>
      <div className="relative m-0 w-full min-w-0 md:hidden">
        <div
          className="scrollbar-hide flex w-full min-w-0 flex-row flex-nowrap justify-start gap-2 overflow-x-auto scroll-smooth py-1 !pl-0 pr-1 scroll-pe-3"
          style={{ paddingLeft: 0 }}
        >
          {loading ? (
            <>
              {[1, 2, 3, 4, 5].map((k) => (
                <div key={k} className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-zinc-200/80 dark:bg-white/10" />
              ))}
            </>
          ) : pills.length === 0 ? (
            <span className="flex h-9 items-center text-[11px] text-zinc-500">Brak komunikatów</span>
          ) : (
            pills.map((ann) => (
              <button
                key={ann.body_fingerprint?.trim() ? ann.body_fingerprint : ann.id}
                type="button"
                onClick={() => setOpenAnn(ann)}
                className={pillBtn}
              >
                <span
                  className={`inline-block size-2 shrink-0 rounded-full ${STATUS_DOT[ann.status]}`}
                  aria-hidden
                />
                <span className="max-w-[9rem] truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                  {ann.lecturer_name}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <AnnouncementDrawer announcement={openAnn} onClose={() => setOpenAnn(null)} />
    </>
  )
}
