/**
 * UJverse — „Mój Plan" view: personalne subskrypcje wykładowców +
 * najnowsze komunikaty zgrupowane per nazwisko.
 *
 * Source of truth dla stanu subskrypcji: `LecturerSubscriptionsProvider`
 * (kontekst zamontowany w App.tsx). Widok jest klientem read+toggle przez
 * kontekst — nie pobiera wykładowców z innych adapterów.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, BellOff, GraduationCap, Megaphone, Search, X } from 'lucide-react'
import BaseCard from './ui/BaseCard'
import EmptyState from './EmptyState'
import AnnouncementDrawer from './AnnouncementDrawer'
import ImportTimetablePanel from './ImportTimetablePanel'
import TimetableInsights from './TimetableInsights'
import TodayClassesWidget from './TodayClassesWidget'
import WeekTimetableView from './WeekTimetableView'
import { useLecturerSubscriptionsContext } from '../lib/lecturerSubscriptionsContext'
import { DataService } from '../services/DataService'
import {
  deriveKeyClient,
  type LecturerSubscriptionAnnouncement,
  type LecturerSuggestion,
} from '../services/adapters/LecturerSubscriptionsAdapter'
import {
  ANNOUNCEMENT_STATUS_BADGE,
  ANNOUNCEMENT_STATUS_DOT,
  ANNOUNCEMENT_STATUS_LABEL,
} from '../lib/announcementStatusStyles'
import { theme } from '../styles/theme'
import { toast } from '../lib/appToast'
import type { AnnouncementMeta, UnifiedContent } from '../types/content'
import type { LecturerSubscription } from '../types'

type GroupedAnnouncements = Map<string, LecturerSubscriptionAnnouncement[]>

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function announcementToUnified(
  ann: LecturerSubscriptionAnnouncement,
): UnifiedContent<AnnouncementMeta> {
  return {
    id: ann.id,
    type: 'announcement',
    title: ann.lecturer_name,
    author: {
      id: `lecturer:${ann.lecturer_name}`,
      displayName: ann.lecturer_name,
      subtitle: ann.department,
      avatarUrl: null,
    },
    body: ann.body,
    timestamp: ann.created_at,
    badges: [],
    metadata: {
      status: ann.status,
      source: 'ISI UJ',
      department: ann.department,
      bodyFingerprint: null,
      // LecturerSubscription RPC (`get_subscribed_lecturer_announcements`)
      // nie zwraca jeszcze pól AI — rozszerzymy w follow-upie. Do tego
      // czasu sekcja TL;DR i badge kalendarza na MojPlanView pozostaną
      // ukryte (oba pola null = brak renderowania w `AnnouncementCard`).
      summary: null,
      extractedCalendar: null,
    },
    actions: [],
  }
}

function AddLecturerPanel() {
  const ctx = useLecturerSubscriptionsContext()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<LecturerSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!focused) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true)
      const out = await DataService.suggestLecturers(query.trim(), 12)
      setSuggestions(out)
      setLoading(false)
    }, 180)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query, focused])

  const handleAdd = async (name: string) => {
    if (!ctx || !ctx.userId) {
      toast.error('Zaloguj się, żeby dodać wykładowcę.')
      return
    }
    await ctx.toggle(name)
    setQuery('')
    setSuggestions([])
  }

  if (!ctx || !ctx.userId) return null

  return (
    <BaseCard variant="default" className="relative z-30 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/10 dark:border-brand-gold-bright/35 dark:bg-brand-gold/15">
          <Bell size={18} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] font-bold ${theme.text.primary}`}>Dodaj wykładowcę</p>
          <p className={`mt-0.5 text-[13px] leading-relaxed ${theme.text.muted}`}>
            Wpisz nazwisko — powiadomimy Cię gdy ten wykładowca ogłosi cokolwiek (odwołanie, zdalne zajęcia, dyżur).
          </p>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          />
          <input
            type="text"
            value={query}
            placeholder="np. Magdalena Zych"
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 180)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-10 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand-gold/45 focus:ring-2 focus:ring-brand-gold/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-brand-gold-bright/40 dark:focus:ring-brand-gold-bright/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setSuggestions([])
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              aria-label="Wyczyść"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {focused && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-zinc-950">
            {loading ? (
              <div className="px-3 py-4 text-center text-xs text-zinc-500">Szukam…</div>
            ) : suggestions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-zinc-500">
                {query.trim()
                  ? 'Brak wykładowcy w bazie komunikatów. Możesz dodać ręcznie poniższym przyciskiem.'
                  : 'Zacznij pisać, żeby zobaczyć podpowiedzi.'}
              </div>
            ) : (
              suggestions.map((s) => {
                const already = ctx.subscribedKeys.has(s.lecturer_key)
                return (
                  <button
                    key={s.lecturer_key}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAdd(s.lecturer_name)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${
                      already ? 'opacity-50' : ''
                    }`}
                    disabled={already}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/[0.06]">
                      <GraduationCap size={14} className="text-brand-gold dark:text-brand-gold-bright" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${theme.text.primary}`}>{s.lecturer_name}</p>
                      <p className={`truncate text-[11px] ${theme.text.muted}`}>
                        {s.announcement_count} komunikat{s.announcement_count === 1 ? '' : 'y'}
                        {s.latest_at ? ` · ostatni ${formatDate(s.latest_at)}` : ''}
                      </p>
                    </div>
                    {already && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-gold dark:text-brand-gold-bright">
                        Subskrybujesz
                      </span>
                    )}
                  </button>
                )
              })
            )}
            {query.trim().length >= 2 && !suggestions.some((s) => deriveKeyClient(s.lecturer_name) === deriveKeyClient(query)) && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleAdd(query.trim())}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-brand-gold/40 px-3 py-2 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/5 dark:border-brand-gold-bright/40 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/5"
              >
                <Bell size={14} /> Dodaj „{query.trim()}" ręcznie
              </button>
            )}
          </div>
        )}
      </div>
    </BaseCard>
  )
}

function LecturerSubscriptionCard({
  sub,
  announcements,
  onOpenAnnouncement,
  onUnsubscribe,
}: {
  sub: LecturerSubscription
  announcements: LecturerSubscriptionAnnouncement[]
  onOpenAnnouncement: (ann: LecturerSubscriptionAnnouncement) => void
  onUnsubscribe: () => void
}) {
  const latest = announcements[0] ?? null
  const more = announcements.slice(1, 4)

  return (
    <BaseCard variant="default" className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#a48955]/35 to-[#7a6b45]/15 ring-1 ring-brand-gold/30 dark:ring-brand-gold-bright/30">
          <GraduationCap size={20} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <p className={`text-[15px] font-bold leading-snug ${theme.text.primary}`}>{sub.display_name}</p>
            <button
              type="button"
              onClick={onUnsubscribe}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-[11px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100"
            >
              <BellOff size={12} /> Wyłącz
            </button>
          </div>
          <p className={`mt-0.5 text-[11px] ${theme.text.muted}`}>
            Subskrybujesz od {formatDate(sub.created_at)} ·{' '}
            {announcements.length === 0
              ? 'Brak komunikatów w bazie'
              : `${announcements.length} komunikat${announcements.length === 1 ? '' : 'y'} łącznie`}
          </p>
        </div>
      </div>

      {latest ? (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => onOpenAnnouncement(latest)}
            className="group flex w-full items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-3 text-left transition-colors hover:border-brand-gold/35 hover:bg-brand-gold/[0.04] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-brand-gold-bright/30 dark:hover:bg-brand-gold-bright/[0.04]"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10">
              <Megaphone size={14} className="text-brand-gold dark:text-brand-gold-bright" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border bg-transparent px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${ANNOUNCEMENT_STATUS_BADGE[latest.status]}`}
                >
                  <span className={`inline-block size-1.5 rounded-full ${ANNOUNCEMENT_STATUS_DOT[latest.status]}`} aria-hidden />
                  {ANNOUNCEMENT_STATUS_LABEL[latest.status]}
                </span>
                <span className={`text-[11px] tabular-nums ${theme.text.muted}`}>
                  {formatDate(latest.created_at)}
                </span>
              </div>
              <p className={`line-clamp-3 text-[13px] leading-relaxed ${theme.text.primary}`}>{latest.body}</p>
            </div>
          </button>
          {more.length > 0 && (
            <div className="space-y-1">
              {more.map((ann) => (
                <button
                  key={ann.id}
                  type="button"
                  onClick={() => onOpenAnnouncement(ann)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.04]"
                >
                  <span className={`inline-block size-1.5 shrink-0 rounded-full ${ANNOUNCEMENT_STATUS_DOT[ann.status]}`} aria-hidden />
                  <span className={`flex-1 truncate ${theme.text.muted}`}>{ann.body.replace(/\s+/g, ' ').trim()}</span>
                  <span className={`shrink-0 tabular-nums ${theme.text.muted}`}>{formatDate(ann.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className={`mt-4 rounded-xl border border-dashed border-zinc-200 px-3 py-3 text-center text-[12px] ${theme.text.muted} dark:border-white/10`}>
          Brak komunikatów do tej pory. Pierwszy pojawi się tu i jako powiadomienie.
        </p>
      )}
    </BaseCard>
  )
}

export default function MojPlanView() {
  const ctx = useLecturerSubscriptionsContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [allAnnouncements, setAllAnnouncements] = useState<LecturerSubscriptionAnnouncement[]>([])
  const [loading, setLoading] = useState(false)
  const [openAnn, setOpenAnn] = useState<UnifiedContent<AnnouncementMeta> | null>(null)
  const [timetableCount, setTimetableCount] = useState<number>(0)
  const [todayWidgetTick, setTodayWidgetTick] = useState(0)

  const subscribedKeys = useMemo(
    () => (ctx ? Array.from(ctx.subscribedKeys) : []),
    [ctx],
  )

  const refreshFeed = useCallback(async () => {
    if (subscribedKeys.length === 0) {
      setAllAnnouncements([])
      return
    }
    setLoading(true)
    const rows = await DataService.listAnnouncementsForLecturerKeys(subscribedKeys, 120)
    setLoading(false)
    setAllAnnouncements(rows)
  }, [subscribedKeys])

  useEffect(() => {
    void refreshFeed()
  }, [refreshFeed])

  const refreshTimetableCount = useCallback(async () => {
    if (!ctx?.userId) {
      setTimetableCount(0)
      return
    }
    const n = await DataService.timetableEntryCount(ctx.userId)
    setTimetableCount(n)
  }, [ctx?.userId])

  useEffect(() => {
    void refreshTimetableCount()
  }, [refreshTimetableCount])

  // Deep-link z notyfikacji: /moj-plan?announcement=ID → otwórz drawer
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const target = params.get('announcement')
    if (!target) return
    const found = allAnnouncements.find((a) => a.id === target)
    if (found) {
      setOpenAnn(announcementToUnified(found))
      params.delete('announcement')
      navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true })
    }
  }, [allAnnouncements, location.pathname, location.search, navigate])

  const grouped: GroupedAnnouncements = useMemo(() => {
    const map = new Map<string, LecturerSubscriptionAnnouncement[]>()
    for (const ann of allAnnouncements) {
      const key = deriveKeyClient(ann.lecturer_name)
      const arr = map.get(key) ?? []
      arr.push(ann)
      map.set(key, arr)
    }
    return map
  }, [allAnnouncements])

  if (!ctx) {
    return (
      <div className="py-12">
        <EmptyState
          icon={GraduationCap}
          title="Mój Plan jest niedostępny"
          subtitle="Zaloguj się, żeby zarządzać subskrypcjami wykładowców."
        />
      </div>
    )
  }

  if (!ctx.userId) {
    return (
      <div className="py-12">
        <EmptyState
          icon={GraduationCap}
          title="Mój Plan jest niedostępny"
          subtitle="Zaloguj się, żeby otrzymywać powiadomienia o odwołanych zajęciach."
        />
      </div>
    )
  }

  /**
   * Layout:
   * - Mobile (default): jednokolumnowy flow — wszystkie karty w pionie,
   *   kolejność = main column → aside column. Najpierw user widzi DANE
   *   (Today / Week / Subscriptions), poniżej KONTROLKI (Insights / Import /
   *   Add lecturer). Mobile-first: data first, controls below.
   *
   * - Desktop (lg+): 2-col grid `[2fr 1fr]`. Lewa kolumna (main) to dane —
   *   szerokie karty z planem i komunikatami. Prawa kolumna (aside) to
   *   utility-stack (stats + import + add) z `sticky` na górze, żeby user
   *   miał dostęp do kontrolek nawet podczas scrollowania długiej listy
   *   subskrypcji albo planu na cały tydzień.
   *
   * UWAGA: `lg:min-w-0` na <main> jest konieczne — grid items mają default
   * `min-width: auto`, co blokuje truncate w środku kart (np. nazwy
   * przedmiotów w Week view). Bez tego layout breakuje gdy summary jest
   * długie.
   */

  const subscriptionsBlock = ctx.loading && ctx.subscriptions.length === 0 ? (
    <BaseCard variant="default" className="p-8">
      <div className="space-y-3">
        <div className="h-4 w-1/3 animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-zinc-100 dark:bg-white/5" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-zinc-100 dark:bg-white/5" />
      </div>
    </BaseCard>
  ) : ctx.subscriptions.length === 0 ? (
    <BaseCard variant="default" className="p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/10 dark:border-brand-gold-bright/35 dark:bg-brand-gold/15">
        <Bell size={26} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2} />
      </div>
      <p className={`mt-4 text-[15px] font-semibold ${theme.text.primary}`}>Jeszcze nikogo nie subskrybujesz</p>
      <p className={`mx-auto mt-1 max-w-md text-[13px] leading-relaxed ${theme.text.muted}`}>
        Dodaj wykładowcę z listy {' '}
        <span className="lg:hidden">poniżej</span>
        <span className="hidden lg:inline">obok</span>
        . Możesz też kliknąć dzwonek 🔔 przy nazwisku w dowolnym komunikacie, żeby aktywować powiadomienia jednym kliknięciem.
      </p>
    </BaseCard>
  ) : (
    <div className="space-y-4">
      {loading && (
        <p className={`text-center text-xs ${theme.text.muted}`}>Ładuję komunikaty…</p>
      )}
      {ctx.subscriptions.map((sub) => (
        <LecturerSubscriptionCard
          key={sub.id}
          sub={sub}
          announcements={grouped.get(sub.lecturer_key) ?? []}
          onOpenAnnouncement={(ann) => setOpenAnn(announcementToUnified(ann))}
          onUnsubscribe={() => void ctx.remove(sub.id)}
        />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className={`text-2xl font-bold tracking-tight ${theme.text.primary} lg:text-3xl`}>
          Mój Plan
        </h1>
        <p className={`max-w-2xl text-sm leading-relaxed ${theme.text.muted}`}>
          Twój plan zajęć + powiadomienia gdy któryś z Twoich wykładowców coś ogłosi (odwołanie / zdalne zajęcia / dyżur). Importujesz plan raz na semestr, a odwołania wpadają tu i jako notyfikacja — bez sprawdzania ISI UJ.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:items-start lg:gap-5">
        <main className="space-y-5 lg:min-w-0">
          <TodayClassesWidget key={`today-${todayWidgetTick}`} userId={ctx.userId} variant="panel" />

          {timetableCount > 0 && (
            <WeekTimetableView userId={ctx.userId} refreshTick={todayWidgetTick} />
          )}

          {subscriptionsBlock}
        </main>

        {/*
          Aside z `sticky`: na lg+ kontrolki (stats, import, dodaj wykładowcę)
          przyklejają się na górze viewportu (top-4) i pozostają widoczne
          podczas scrollowania długiej listy subskrypcji / planu.
          Świadomie BEZ `overflow-y-auto` — to clipowałoby dropdown autosuggesta
          „Dodaj wykładowcę" (`absolute` w aside). Trzy karty (Insights ~150px
          + Import ~350px + Add ~250px) ≈ 750px łącznie, co spokojnie mieści
          się w typowym viewporcie laptopa (768+ wysokości).
        */}
        <aside className="mt-5 space-y-5 lg:mt-0 lg:sticky lg:top-4 lg:self-start">
          {timetableCount > 0 && (
            <TimetableInsights userId={ctx.userId} refreshTick={todayWidgetTick} />
          )}

          <ImportTimetablePanel
            userId={ctx.userId}
            existingCount={timetableCount}
            onImported={() => {
              void refreshTimetableCount()
              setTodayWidgetTick((t) => t + 1)
            }}
            onCleared={() => {
              setTimetableCount(0)
              setTodayWidgetTick((t) => t + 1)
            }}
          />

          <AddLecturerPanel />
        </aside>
      </div>

      <AnnouncementDrawer announcement={openAnn} onClose={() => setOpenAnn(null)} />
    </div>
  )
}
