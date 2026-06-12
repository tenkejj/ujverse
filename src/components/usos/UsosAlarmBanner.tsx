/**
 * UJverse — UsosAlarmBanner: globalny banner alarmu rejestracji USOS.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Pokazuje się tylko gdy user ma subskrypcję której `opens_at` jest
 * w najbliższych 24h (phase 'critical' lub 'urgent'). Persistuje
 * dismissed-set w `sessionStorage` żeby banner nie był annoying
 * (zniknięcie zostaje do końca sesji — następnego dnia znów się pokaże
 * jeśli alarm wciąż aktualny).
 *
 * Klik w banner = navigate to `/usos`. Klik w X = dismiss tę pozycję.
 *
 * Pozycja: floating sticky belka pod headerem, full-width, slide-down
 * (entry) + slide-up (dismiss). Z-index niższy niż Header (50) i Bottom
 * Nav (modal layer), ale nad treścią.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell, Clock, ExternalLink, X } from 'lucide-react'
import { UsosRegistrationsService } from '../../services/UsosRegistrationsService'
import { COUNTDOWN_PHASE_TINT, computeCountdown, type MyUpcomingRegistration } from '../../types/usosRegistrations'

type Props = {
  userId: string | null
  /** Wywołane przy kliknięciu w banner — np. `navigate('/usos')`. */
  onNavigateToUsos: () => void
}

const SESSION_DISMISS_KEY = 'ujverse.usos.alarm.dismissed.v1'
/** Co ile sekund odświeżyć listę z serwera (oprócz tickeria 30s do recompute phase). */
const POLL_INTERVAL_MS = 5 * 60 * 1000

function readDismissedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_DISMISS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeDismissedIds(set: Set<string>): void {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, JSON.stringify(Array.from(set)))
  } catch {
    /* ignore quota */
  }
}

export default function UsosAlarmBanner({ userId, onNavigateToUsos }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const [upcoming, setUpcoming] = useState<MyUpcomingRegistration[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => readDismissedIds())
  const [, setTick] = useState(0)

  // Re-render co 30s żeby phase się aktualizował
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Fetch initial + polling
  useEffect(() => {
    if (!userId) {
      setUpcoming([])
      return
    }
    let cancelled = false
    const fetchData = async () => {
      const { data } = await UsosRegistrationsService.getMyUpcoming(userId)
      if (!cancelled) setUpcoming(data)
    }
    void fetchData()
    const id = setInterval(fetchData, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [userId])

  /**
   * Wyselektuj najbardziej "palącą" subskrypcję dla bannera:
   *   - phase critical/urgent
   *   - nie dismissed lokalnie (sessionStorage)
   *   - nie dismissed po stronie servera (`dismissed_at`)
   * Sortuj po opens_at rosnąco — pokazujemy NAJBLIŻSZE.
   */
  const activeAlarm = useMemo<MyUpcomingRegistration | null>(() => {
    for (const u of upcoming) {
      if (u.dismissed_at) continue
      if (dismissedIds.has(u.registration_id)) continue
      const cd = computeCountdown(u.opens_at, u.closes_at)
      if (cd.phase === 'critical' || cd.phase === 'urgent' || cd.phase === 'live') {
        return u
      }
    }
    return null
  }, [upcoming, dismissedIds])

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissedIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        writeDismissedIds(next)
        return next
      })
    },
    [],
  )

  return (
    <AnimatePresence>
      {activeAlarm && (
        <motion.div
          key={`usos-alarm-${activeAlarm.registration_id}`}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -32 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -32 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="sticky top-0 z-40 w-full bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 px-3 py-2 shadow-sm ring-1 ring-red-200/60 dark:from-red-500/10 dark:via-orange-500/10 dark:to-amber-500/10 dark:ring-red-400/20"
          role="alert"
          aria-live="polite"
        >
          <AlarmInner alarm={activeAlarm} onClick={onNavigateToUsos} onDismiss={() => handleDismiss(activeAlarm.registration_id)} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AlarmInner({
  alarm,
  onClick,
  onDismiss,
}: {
  alarm: MyUpcomingRegistration
  onClick: () => void
  onDismiss: () => void
}) {
  const cd = computeCountdown(alarm.opens_at, alarm.closes_at)
  const audience =
    alarm.audience_label ??
    [alarm.study_program, alarm.year ? `${alarm.year} rok` : null].filter(Boolean).join(' · ')

  return (
    <div className="mx-auto flex max-w-[1800px] items-center gap-2.5">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 items-center gap-2.5 text-left"
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-sm">
          <Bell size={13} strokeWidth={2.6} />
          {cd.phase === 'critical' && (
            <motion.span
              className="absolute inset-0 rounded-full bg-red-500/40"
              animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col leading-tight sm:flex-row sm:items-center sm:gap-2">
          <span className="line-clamp-1 text-[12.5px] font-bold text-red-900 dark:text-red-100">
            {cd.phase === 'live' ? 'TRWA REJESTRACJA' : 'Rejestracja USOS wkrótce'}
            <span className="hidden font-semibold text-red-800/80 dark:text-red-200/80 sm:inline">
              {' · '}
              {alarm.title}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-1 text-[11px] text-red-800/90 dark:text-red-200/90">
            <span className="sm:hidden line-clamp-1 font-semibold">{alarm.title}</span>
            {audience && <span className="hidden sm:inline opacity-80">{audience}</span>}
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${COUNTDOWN_PHASE_TINT[cd.phase]}`}>
              <Clock size={9} strokeWidth={2.6} />
              {cd.compact}
            </span>
          </span>
        </div>
      </button>

      <a
        href={alarm.registration_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="hidden items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400 sm:inline-flex"
      >
        <ExternalLink size={11} strokeWidth={2.4} />
        USOS
      </a>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-full p-1 text-red-700/70 hover:bg-red-100 hover:text-red-900 dark:text-red-200/70 dark:hover:bg-red-500/20 dark:hover:text-red-100"
        aria-label="Schowaj alarm"
      >
        <X size={14} strokeWidth={2.4} />
      </button>
    </div>
  )
}
