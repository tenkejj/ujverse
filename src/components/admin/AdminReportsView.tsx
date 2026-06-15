/**
 * Admin Reports — panel zgłoszeń użytkowników (`/admin/reports`).
 *
 * Źródło danych: `public.reports` (RLS — SELECT widoczne dla admina przez
 * `is_profile_admin()`). Frontend dodatkowo gate'uje render po
 * `myProfile.role === 'admin'` — żeby nie pokazywać pustego ekranu
 * non-adminowi, który teoretycznie trafi na URL.
 *
 * Funkcjonalność:
 *  - Filtry statusu (Wszystkie / Otwarte / W trakcie / Rozwiązane / Odrzucone)
 *    + auto-licznik per-bucket.
 *  - Lista zgłoszeń: kto zgłosił, kiedy, powód (badge), opcjonalny `details`
 *    od zgłaszającego (quote), preview zgłoszonej treści (post/komentarz)
 *    + link do strony.
 *  - Workflow: status zmieniany przez UPDATE (RLS = tylko admin).
 *    Trigger `reports_set_resolved_at_trg` ustawia `resolved_at` / `resolved_by`.
 *  - Bonus: szybkie „Usuń treść" (skasowanie zgłoszonego posta/komentarza)
 *    plus pole `resolution_note` (notatka admina widoczna po rozwiązaniu).
 *
 * Spójność z designem:
 *  - `BaseCard` jako fundament wszystkich kart (jak `AdminDiagView`).
 *  - tokeny `text-fg-*`, `border-border-app`, `bg-bg-card` — light/dark
 *    z `src/index.css` (`@theme`).
 *  - Akcent: navy w light (`#1e293b`), gold w dark (`brand-gold`) — jak
 *    `SettingsView`/`ReportModal`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flag,
  Loader2,
  MessageSquareWarning,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { toast } from '../../lib/appToast'
import { relativeTime } from '../../lib/utils'
import type { Profile } from '../../types'
import BaseCard from '../ui/BaseCard'
import UserAvatar from '../UserAvatar'

// ── Typy ──────────────────────────────────────────────────────────────────

type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

type ReportedPost = {
  id: number
  /** Kolumna w DB to `content` — `body` to alias z `PostsAdapter` w UI. */
  content: string | null
  user_id: string | null
  created_at: string
  image_url: string | null
}

type ReportedComment = {
  id: number
  post_id: number | null
  user_id: string | null
  content: string
  created_at: string
}

type ReportRow = {
  id: number
  reporter_id: string
  post_id: number | null
  comment_id: number | null
  reason: string
  details: string | null
  status: ReportStatus
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
}

type ReportItem = ReportRow & {
  reporter: Profile | null
  resolver: Profile | null
  post: ReportedPost | null
  comment: ReportedComment | null
  /** Autor zgłoszonej treści (post lub komentarz) — fetchowany osobno. */
  contentAuthor: Profile | null
}

type StatusFilter = 'all' | ReportStatus

type Counts = Record<StatusFilter, number>

/**
 * Supabase rzuca `PostgrestError` (`{ message, details, hint, code }`) — to
 * NIE jest instance Error, więc surowy `String(err)` daje `[object Object]`.
 * Ten helper wyciąga czytelny opis (priorytet: message > details > hint > code).
 */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null) {
    const obj = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [obj.message, obj.details, obj.hint, obj.code]
      .filter((v): v is string | number => v !== undefined && v !== null && v !== '')
      .map(String)
    if (parts.length > 0) return parts.join(' · ')
    try { return JSON.stringify(err) } catch { return String(err) }
  }
  return String(err)
}

// ── Tokeny stylów (lokalne, spójne z SettingsView/AdminDiagView) ──────────

const accentText = 'text-[#1e293b] dark:text-brand-gold-bright'

const sectionIconBubble =
  'flex h-8 w-8 items-center justify-center rounded-xl ' +
  'border border-[#1e293b]/15 bg-[#1e293b]/[0.05] text-[#1e293b] ' +
  'dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/[0.06] dark:text-brand-gold-bright'

const outlineBtnCls =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 ' +
  'text-xs font-semibold transition-colors ' +
  'border-[#1e293b]/35 bg-transparent text-[#1e293b] hover:border-[#1e293b]/55 hover:bg-[#1e293b]/[0.04] ' +
  'dark:border-brand-gold/45 dark:text-brand-gold-bright dark:hover:border-brand-gold-bright/60 ' +
  'dark:hover:bg-brand-gold-bright/[0.06] disabled:cursor-not-allowed disabled:opacity-55'

const dangerBtnCls =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 ' +
  'text-xs font-semibold transition-colors ' +
  'border-rose-500/40 text-rose-600 hover:border-rose-500/60 hover:bg-rose-500/[0.05] ' +
  'dark:border-rose-500/40 dark:text-rose-300 dark:hover:border-rose-400/55 dark:hover:bg-rose-500/[0.08] ' +
  'disabled:cursor-not-allowed disabled:opacity-55'

const successBtnCls =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 ' +
  'text-xs font-semibold transition-colors ' +
  'border-emerald-500/40 text-emerald-700 hover:border-emerald-500/60 hover:bg-emerald-500/[0.05] ' +
  'dark:border-emerald-400/40 dark:text-emerald-300 dark:hover:border-emerald-400/55 dark:hover:bg-emerald-500/[0.08] ' +
  'disabled:cursor-not-allowed disabled:opacity-55'

const noteFieldCls =
  'w-full resize-none rounded-xl border border-border-app bg-transparent px-3 py-2 text-sm leading-relaxed ' +
  'text-fg-primary placeholder:text-fg-tertiary outline-none transition-colors ' +
  'focus:border-[#1e293b]/45 focus:bg-[#1e293b]/3 ' +
  'dark:focus:border-brand-gold/45 dark:focus:bg-white/4'

// ── Etykiety / metadata statusu ───────────────────────────────────────────

const STATUS_META: Record<
  ReportStatus,
  { label: string; tone: string; icon: typeof CheckCircle2 }
> = {
  open: {
    label: 'Otwarte',
    tone:
      'border-rose-300 bg-rose-50 text-rose-700 ' +
      'dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200',
    icon: AlertTriangle,
  },
  reviewing: {
    label: 'W trakcie',
    tone:
      'border-amber-300 bg-amber-50 text-amber-800 ' +
      'dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200',
    icon: Clock3,
  },
  resolved: {
    label: 'Rozwiązane',
    tone:
      'border-emerald-300 bg-emerald-50 text-emerald-700 ' +
      'dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200',
    icon: CheckCircle2,
  },
  dismissed: {
    label: 'Odrzucone',
    tone:
      'border-zinc-300 bg-zinc-100 text-zinc-700 ' +
      'dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300',
    icon: XCircle,
  },
}

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'open', label: 'Otwarte' },
  { id: 'reviewing', label: 'W trakcie' },
  { id: 'resolved', label: 'Rozwiązane' },
  { id: 'dismissed', label: 'Odrzucone' },
]

// ── Komponent główny ──────────────────────────────────────────────────────

type Props = {
  myProfile: Profile | null
  onBack: () => void
}

export default function AdminReportsView({ myProfile, onBack }: Props) {
  const isAdmin = myProfile?.role === 'admin'

  const [items, setItems] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('open')
  const [actionBusyId, setActionBusyId] = useState<number | null>(null)
  /** notatki edytowane lokalnie per-report (przed UPDATE) */
  const [noteDraftById, setNoteDraftById] = useState<Record<number, string>>({})

  // ── Fetch zgłoszeń ──────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    setError(null)
    try {
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select(
          'id, reporter_id, post_id, comment_id, reason, details, status, resolved_by, resolved_at, resolution_note, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(200)

      if (reportsError) throw reportsError

      const rows = (reports ?? []) as ReportRow[]

      // Zbieramy potrzebne ID-ki batchem żeby wykonać po jednym query
      // na entity (zamiast N+1).
      const profileIds = new Set<string>()
      const postIds = new Set<number>()
      const commentIds = new Set<number>()
      for (const r of rows) {
        if (r.reporter_id) profileIds.add(r.reporter_id)
        if (r.resolved_by) profileIds.add(r.resolved_by)
        if (r.post_id) postIds.add(r.post_id)
        if (r.comment_id) commentIds.add(r.comment_id)
      }

      const [profilesQ, postsQ, commentsQ] = await Promise.all([
        profileIds.size
          ? supabase
              .from('profiles')
              .select('id, full_name, username, avatar_url, department, role')
              .in('id', Array.from(profileIds))
          : Promise.resolve({ data: [] as Profile[], error: null }),
        postIds.size
          ? supabase
              .from('posts')
              .select('id, content, user_id, created_at, image_url')
              .in('id', Array.from(postIds))
          : Promise.resolve({ data: [] as ReportedPost[], error: null }),
        commentIds.size
          ? supabase
              .from('comments')
              .select('id, post_id, user_id, content, created_at')
              .in('id', Array.from(commentIds))
          : Promise.resolve({ data: [] as ReportedComment[], error: null }),
      ])

      if (profilesQ.error) throw profilesQ.error
      if (postsQ.error) throw postsQ.error
      if (commentsQ.error) throw commentsQ.error

      const profilesById = new Map<string, Profile>()
      for (const p of (profilesQ.data ?? []) as Profile[]) profilesById.set(p.id, p)

      const postsById = new Map<number, ReportedPost>()
      for (const p of (postsQ.data ?? []) as ReportedPost[]) postsById.set(p.id, p)

      const commentsById = new Map<number, ReportedComment>()
      for (const c of (commentsQ.data ?? []) as ReportedComment[]) commentsById.set(c.id, c)

      // Drugie zapytanie po profile autorów treści (jeśli nie byli już w `profileIds`).
      const contentAuthorIds = new Set<string>()
      for (const p of postsById.values()) if (p.user_id) contentAuthorIds.add(p.user_id)
      for (const c of commentsById.values()) if (c.user_id) contentAuthorIds.add(c.user_id)
      const missingAuthorIds = Array.from(contentAuthorIds).filter((id) => !profilesById.has(id))
      if (missingAuthorIds.length > 0) {
        const { data: extraProfiles, error: extraError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, department, role')
          .in('id', missingAuthorIds)
        if (extraError) throw extraError
        for (const p of (extraProfiles ?? []) as Profile[]) profilesById.set(p.id, p)
      }

      const composed: ReportItem[] = rows.map((r) => {
        const post = r.post_id ? postsById.get(r.post_id) ?? null : null
        const comment = r.comment_id ? commentsById.get(r.comment_id) ?? null : null
        const contentAuthorId = post?.user_id ?? comment?.user_id ?? null
        return {
          ...r,
          reporter: profilesById.get(r.reporter_id) ?? null,
          resolver: r.resolved_by ? profilesById.get(r.resolved_by) ?? null : null,
          post,
          comment,
          contentAuthor: contentAuthorId ? profilesById.get(contentAuthorId) ?? null : null,
        }
      })

      setItems(composed)
    } catch (err) {
      const msg = errorMessage(err)
      // Loguj surowy obiekt do konsoli — przydaje się przy debug-u RLS / kolumn.
      console.error('[AdminReportsView] fetch failed:', err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // ── Liczniki per-filter (wszystkie statusy widoczne tym samym SELECT-em) ──
  const counts: Counts = useMemo(() => {
    const c: Counts = { all: items.length, open: 0, reviewing: 0, resolved: 0, dismissed: 0 }
    for (const it of items) c[it.status] += 1
    return c
  }, [items])

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((it) => it.status === filter)),
    [filter, items],
  )

  // ── Akcje admina ─────────────────────────────────────────────────────────

  const updateReport = useCallback(
    async (
      reportId: number,
      patch: Partial<Pick<ReportRow, 'status' | 'resolution_note'>>,
      successMessage: string,
    ) => {
      setActionBusyId(reportId)
      try {
        const { error: updateError } = await supabase
          .from('reports')
          .update(patch)
          .eq('id', reportId)
        if (updateError) throw updateError
        toast.success(successMessage)
        await refresh()
      } catch (err) {
        console.error('[AdminReportsView] update failed:', err)
        toast.error(`Nie udało się zaktualizować: ${errorMessage(err)}`)
      } finally {
        setActionBusyId(null)
      }
    },
    [refresh],
  )

  const handleStartReview = useCallback(
    (item: ReportItem) => {
      void updateReport(item.id, { status: 'reviewing' }, 'Oznaczono jako w trakcie')
    },
    [updateReport],
  )

  const handleResolve = useCallback(
    (item: ReportItem) => {
      const note = (noteDraftById[item.id] ?? '').trim() || null
      void updateReport(
        item.id,
        { status: 'resolved', resolution_note: note },
        'Zgłoszenie rozwiązane',
      )
    },
    [noteDraftById, updateReport],
  )

  const handleDismiss = useCallback(
    (item: ReportItem) => {
      const note = (noteDraftById[item.id] ?? '').trim() || null
      void updateReport(
        item.id,
        { status: 'dismissed', resolution_note: note },
        'Zgłoszenie odrzucone',
      )
    },
    [noteDraftById, updateReport],
  )

  const handleReopen = useCallback(
    (item: ReportItem) => {
      void updateReport(item.id, { status: 'open' }, 'Zgłoszenie ponownie otwarte')
    },
    [updateReport],
  )

  const handleDeleteContent = useCallback(
    async (item: ReportItem) => {
      const label = item.post_id ? 'post' : 'komentarz'
      if (!window.confirm(`Na pewno usunąć ${label} zgłoszony w tym raporcie?`)) return
      setActionBusyId(item.id)
      try {
        if (item.post_id) {
          const { error: delError } = await supabase
            .from('posts')
            .delete()
            .eq('id', item.post_id)
          if (delError) throw delError
        } else if (item.comment_id) {
          const { error: delError } = await supabase
            .from('comments')
            .delete()
            .eq('id', item.comment_id)
          if (delError) throw delError
        }
        // Po skasowaniu treści zamykamy zgłoszenie automatycznie.
        const note = (noteDraftById[item.id] ?? '').trim()
        const autoNote =
          note ||
          `Treść usunięta przez administratora (${item.post_id ? 'post' : 'komentarz'} #${
            item.post_id ?? item.comment_id
          }).`
        await supabase
          .from('reports')
          .update({ status: 'resolved', resolution_note: autoNote })
          .eq('id', item.id)
        toast.success(`Usunięto ${label} i zamknięto zgłoszenie`)
        await refresh()
      } catch (err) {
        console.error('[AdminReportsView] delete content failed:', err)
        toast.error(`Nie udało się usunąć: ${errorMessage(err)}`)
      } finally {
        setActionBusyId(null)
      }
    },
    [noteDraftById, refresh],
  )

  // ── Render: gate dla non-adminów ─────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <BaseCard className="p-8 text-center">
          <ShieldCheck size={36} className="mx-auto mb-3 text-fg-tertiary" />
          <h2 className="text-lg font-semibold text-fg-primary">Brak uprawnień</h2>
          <p className="mt-2 text-sm text-fg-secondary">
            Panel zgłoszeń jest dostępny tylko dla administratorów.
          </p>
          <button type="button" onClick={onBack} className={`${outlineBtnCls} mt-4`}>
            <ArrowLeft size={14} />
            Wróć
          </button>
        </BaseCard>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 md:px-6 md:py-8">
      {/* Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white/70 text-zinc-700 backdrop-blur transition-colors hover:border-[#1e293b]/30 hover:bg-white hover:text-[#1e293b] dark:border-white/10 dark:bg-white/4 dark:text-zinc-300 dark:hover:border-brand-gold-bright/40 dark:hover:bg-white/7 dark:hover:text-brand-gold-bright"
            aria-label="Poprzednia strona"
          >
            <ArrowLeft size={20} strokeWidth={2.25} aria-hidden />
          </button>
          <div className="flex items-start gap-3">
            <span className={sectionIconBubble} aria-hidden>
              <Flag className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-fg-primary">
                Zgłoszenia
              </h1>
              <p className="mt-1 text-sm text-fg-secondary">
                Centrum moderacji — zgłoszenia od użytkowników na posty i komentarze.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white/80 px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:bg-zinc-800"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          Odśwież
        </button>
      </header>

      {/* Filtry ──────────────────────────────────────────────────────────── */}
      <BaseCard className="p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const isActive = filter === f.id
            const n = counts[f.id]
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'border-[#1e293b]/45 bg-[#1e293b]/8 text-[#1e293b] dark:border-brand-gold/45 dark:bg-brand-gold/10 dark:text-brand-gold-bright'
                    : 'border-transparent text-fg-secondary hover:border-[#1e293b]/25 hover:bg-[#1e293b]/4 hover:text-fg-primary dark:hover:border-brand-gold/25 dark:hover:bg-white/4 dark:hover:text-zinc-100'
                }`}
                aria-pressed={isActive}
              >
                {f.label}
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                    isActive
                      ? 'bg-[#1e293b]/15 text-[#1e293b] dark:bg-brand-gold/20 dark:text-brand-gold-bright'
                      : 'bg-zinc-200/70 text-fg-secondary dark:bg-white/10 dark:text-fg-secondary'
                  }`}
                >
                  {n}
                </span>
              </button>
            )
          })}
        </div>
      </BaseCard>

      {/* Błąd ────────────────────────────────────────────────────────────── */}
      {error ? (
        <BaseCard className="border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Błąd pobierania zgłoszeń</p>
              <p className="mt-1 wrap-break-word font-mono text-xs">{error}</p>
            </div>
          </div>
        </BaseCard>
      ) : null}

      {/* Lista ───────────────────────────────────────────────────────────── */}
      {loading && items.length === 0 ? (
        <BaseCard className="flex items-center justify-center gap-2 p-8 text-sm text-fg-secondary">
          <Loader2 size={16} className="animate-spin" />
          Ładuję zgłoszenia…
        </BaseCard>
      ) : filtered.length === 0 ? (
        <BaseCard className="p-10 text-center">
          <MessageSquareWarning size={36} className={`mx-auto mb-3 ${accentText}`} />
          <p className="text-sm font-semibold text-fg-primary">
            {filter === 'all'
              ? 'Brak zgłoszeń.'
              : `Brak zgłoszeń w kategorii „${FILTERS.find((f) => f.id === filter)?.label}".`}
          </p>
          <p className="mt-1 text-xs text-fg-secondary">
            Zgłoszenia od użytkowników trafiają tutaj automatycznie.
          </p>
        </BaseCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <ReportCard
              key={item.id}
              item={item}
              busy={actionBusyId === item.id}
              note={noteDraftById[item.id] ?? item.resolution_note ?? ''}
              onNoteChange={(value) =>
                setNoteDraftById((prev) => ({ ...prev, [item.id]: value }))
              }
              onStartReview={() => handleStartReview(item)}
              onResolve={() => handleResolve(item)}
              onDismiss={() => handleDismiss(item)}
              onReopen={() => handleReopen(item)}
              onDeleteContent={() => void handleDeleteContent(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Karta pojedynczego zgłoszenia ─────────────────────────────────────────

type ReportCardProps = {
  item: ReportItem
  busy: boolean
  note: string
  onNoteChange: (value: string) => void
  onStartReview: () => void
  onResolve: () => void
  onDismiss: () => void
  onReopen: () => void
  onDeleteContent: () => void
}

function ReportCard({
  item,
  busy,
  note,
  onNoteChange,
  onStartReview,
  onResolve,
  onDismiss,
  onReopen,
  onDeleteContent,
}: ReportCardProps) {
  const meta = STATUS_META[item.status]
  const StatusIcon = meta.icon
  const isClosed = item.status === 'resolved' || item.status === 'dismissed'
  const reporterName =
    item.reporter?.full_name ||
    item.reporter?.username ||
    'Nieznany użytkownik'
  const reporterHandle = item.reporter?.username
    ? `@${item.reporter.username}`
    : null

  const targetKind: 'post' | 'comment' | null = item.post_id
    ? 'post'
    : item.comment_id
      ? 'comment'
      : null

  const targetLink =
    targetKind === 'post' && item.post_id
      ? `/thread/${item.post_id}`
      : targetKind === 'comment' && item.comment?.post_id
        ? `/thread/${item.comment.post_id}#comment-${item.comment_id}`
        : null

  const targetBodyText =
    targetKind === 'post'
      ? item.post?.content ?? null
      : item.comment?.content ?? null

  const contentMissing =
    (targetKind === 'post' && !item.post) ||
    (targetKind === 'comment' && !item.comment)

  const authorName =
    item.contentAuthor?.full_name || item.contentAuthor?.username || 'nieznany'

  return (
    <BaseCard className="p-4 sm:p-5">
      {/* Wiersz nagłówka: status + meta */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}
        >
          <StatusIcon size={12} aria-hidden />
          {meta.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50/70 px-2.5 py-0.5 text-[11px] font-semibold text-fg-secondary dark:border-white/10 dark:bg-white/4">
          {targetKind === 'post' ? 'Post' : targetKind === 'comment' ? 'Komentarz' : '—'} #
          {targetKind === 'post' ? item.post_id : item.comment_id}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#1e293b]/15 bg-[#1e293b]/4 px-2.5 py-0.5 text-[11px] font-semibold text-[#1e293b] dark:border-brand-gold/30 dark:bg-brand-gold/8 dark:text-brand-gold-bright">
          {item.reason}
        </span>
        <span className="ml-auto font-mono text-[11px] text-fg-tertiary" title={item.created_at}>
          {relativeTime(item.created_at)} temu · #{item.id}
        </span>
      </div>

      {/* Zgłaszający */}
      <div className="mb-3 flex items-start gap-3">
        <UserAvatar
          profile={item.reporter}
          name={reporterName}
          className="h-9 w-9"
          textSize="text-xs"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg-primary">
            {reporterName}
            {reporterHandle ? (
              <span className="ml-1.5 text-xs font-normal text-fg-tertiary">
                {reporterHandle}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-fg-secondary">zgłosił {targetKind === 'post' ? 'post' : 'komentarz'}</p>
        </div>
      </div>

      {/* Opis od zgłaszającego (details) */}
      {item.details ? (
        <blockquote className="mb-3 rounded-xl border border-border-app bg-zinc-50/60 px-3 py-2 text-sm leading-relaxed text-fg-primary dark:bg-white/3">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-fg-tertiary">
            Szczegóły od zgłaszającego
          </span>
          <span className="whitespace-pre-wrap wrap-break-word">{item.details}</span>
        </blockquote>
      ) : null}

      {/* Preview zgłoszonej treści */}
      <div className="mb-3 rounded-xl border border-border-app bg-bg-card/40 px-3 py-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-tertiary">
          <span>Zgłoszona treść · autor: {authorName}</span>
          {targetLink ? (
            <Link
              to={targetLink}
              className={`inline-flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold ${accentText} hover:underline`}
            >
              <ExternalLink size={11} aria-hidden />
              Otwórz
            </Link>
          ) : null}
        </div>
        {contentMissing ? (
          <p className="text-xs italic text-fg-tertiary">
            Treść została już usunięta (lub jest niedostępna).
          </p>
        ) : (
          <>
            {targetBodyText ? (
              <p className="line-clamp-4 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-fg-primary">
                {targetBodyText}
              </p>
            ) : (
              <p className="text-xs italic text-fg-tertiary">(brak treści tekstowej)</p>
            )}
            {targetKind === 'post' && item.post?.image_url ? (
              <img
                src={item.post.image_url}
                alt=""
                className="mt-2 max-h-40 w-auto rounded-lg border border-border-app object-cover"
              />
            ) : null}
          </>
        )}
      </div>

      {/* Notatka admina (edytowalna gdy otwarte/in-review; readonly gdy zamknięte) */}
      {isClosed && item.resolution_note ? (
        <div className="mb-3 rounded-xl border border-border-app bg-zinc-50/60 px-3 py-2 text-sm dark:bg-white/3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-tertiary">
            Nota admina
            {item.resolver?.username ? ` · ${item.resolver.full_name ?? item.resolver.username}` : ''}
            {item.resolved_at ? ` · ${relativeTime(item.resolved_at)} temu` : ''}
          </p>
          <p className="whitespace-pre-wrap wrap-break-word text-fg-primary">
            {item.resolution_note}
          </p>
        </div>
      ) : (
        <div className="mb-3">
          <label
            htmlFor={`note-${item.id}`}
            className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-fg-tertiary"
          >
            Nota admina (opcjonalna)
          </label>
          <textarea
            id={`note-${item.id}`}
            rows={2}
            value={note}
            onChange={(e) => onNoteChange(e.target.value.slice(0, 1000))}
            placeholder="Dodaj krótką notę o tym, jak rozwiązano zgłoszenie (widoczna dla adminów)."
            className={noteFieldCls}
            disabled={busy}
          />
        </div>
      )}

      {/* Akcje */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-tertiary">
            <Loader2 size={12} className="animate-spin" />
            Pracuję…
          </span>
        ) : null}
        {item.status === 'open' ? (
          <button
            type="button"
            onClick={onStartReview}
            disabled={busy}
            className={outlineBtnCls}
          >
            <Clock3 size={12} />
            W trakcie
          </button>
        ) : null}
        {!isClosed && !contentMissing ? (
          <button
            type="button"
            onClick={onDeleteContent}
            disabled={busy}
            className={dangerBtnCls}
            title="Usuń zgłoszoną treść i zamknij zgłoszenie"
          >
            <Trash2 size={12} />
            Usuń treść
          </button>
        ) : null}
        {!isClosed ? (
          <>
            <button
              type="button"
              onClick={onDismiss}
              disabled={busy}
              className={outlineBtnCls}
            >
              <XCircle size={12} />
              Odrzuć
            </button>
            <button
              type="button"
              onClick={onResolve}
              disabled={busy}
              className={successBtnCls}
            >
              <CheckCircle2 size={12} />
              Rozwiąż
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onReopen}
            disabled={busy}
            className={outlineBtnCls}
          >
            <RefreshCcw size={12} />
            Otwórz ponownie
          </button>
        )}
      </div>
    </BaseCard>
  )
}
