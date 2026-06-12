/**
 * UJverse — EventsHub: opakowuje EventsView i CalendarView w jednolity
 * widok z przełącznikiem tabów (Wydarzenia / Kalendarz).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 *
 * Filozofia:
 *   - Tabs są stickowate na górze (pod sticky headerem aplikacji), żeby przy
 *     scrollu siatki nadal było wiadomo gdzie jesteśmy.
 *   - Stan aktywnego taba żyje TYLKO tutaj. W przyszłej iteracji można go
 *     przeflashować przez `useLocation()` (np. `/events?tab=calendar`),
 *     żeby deep-link działał — w v1 trzymamy lokalnie dla prostoty.
 *   - EventsView i CalendarView są niezależne: każdy ma swój sticky toolbar
 *     pod tabami.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CalendarRange } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import EventsView from './EventsView'

const CalendarView = lazy(() => import('./calendar/CalendarView'))

type Props = {
  currentUserId: string
  onNavigateToProfileHandle?: (handle: string) => void
}

type TabKey = 'events' | 'calendar'

const TABS: { key: TabKey; label: string; icon: typeof CalendarDays }[] = [
  { key: 'events', label: 'Wydarzenia', icon: CalendarDays },
  { key: 'calendar', label: 'Kalendarz', icon: CalendarRange },
]

/**
 * Deep-link z innych części apki:
 *   navigate('/events', { state: { tab: 'calendar', openCalendarDay: 'YYYY-MM-DD' } })
 * EventsHub czyta `state.tab` (jeśli istnieje) i przełącza widok;
 * `openCalendarDay` przekazujemy do CalendarView przez prop, który ten
 * konsumuje TYLKO przy mount/re-mount (a nie w pętli).
 */
type LocationState = {
  tab?: TabKey
  openCalendarDay?: string
}

export default function EventsHub({
  currentUserId,
  onNavigateToProfileHandle,
}: Props) {
  const location = useLocation()
  const navigate = useNavigate()

  const incomingState = (location.state ?? null) as LocationState | null
  const initialTab: TabKey =
    incomingState?.tab === 'calendar' || incomingState?.tab === 'events'
      ? incomingState.tab
      : 'events'

  const [tab, setTab] = useState<TabKey>(initialTab)
  const initialCalendarDay = useMemo(
    () => incomingState?.openCalendarDay ?? null,
    // Tylko z initial mount — kolejne re-rendery NIE zmieniają tej wartości.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Po skonsumowaniu state'a wyczyść go, żeby refresh strony / „wstecz"
  // nie wracał do tego samego deep-linka (analogicznie do EventsView).
  useEffect(() => {
    if (incomingState?.tab != null || incomingState?.openCalendarDay != null) {
      navigate(location.pathname, { replace: true, state: null })
    }
    // Wyzwalamy raz po mount — dalsze re-rendery z odświeżonym location
    // nie powtórzą czyszczenia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      {/* Tab switcher — segmented control */}
      <div
        className="relative inline-flex w-full max-w-md items-stretch rounded-full border border-zinc-200/80 bg-white/85 p-1 backdrop-blur-md dark:border-white/10 dark:bg-bg-card/80"
        role="tablist"
        aria-label="Widoki strony Wydarzenia"
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className="relative flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            >
              {active ? (
                <motion.span
                  layoutId="events-hub-tab-bg"
                  className="absolute inset-0 rounded-full bg-[#1e293b] dark:bg-[#D4AF37]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              ) : null}
              <Icon
                size={15}
                strokeWidth={2.25}
                aria-hidden
                className={`relative z-[1] shrink-0 transition-colors ${
                  active ? 'text-white dark:text-[#1e293b]' : 'text-fg-secondary'
                }`}
              />
              <span
                className={`relative z-[1] transition-colors ${
                  active ? 'text-white dark:text-[#1e293b]' : 'text-fg-secondary'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'events' ? (
          <motion.div
            key="events"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <EventsView
              currentUserId={currentUserId}
              onNavigateToProfileHandle={onNavigateToProfileHandle}
            />
          </motion.div>
        ) : (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <Suspense
              fallback={
                <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-fg-secondary dark:border-white/10">
                  Ładuję kalendarz…
                </div>
              }
            >
              <CalendarView initialSelectedDay={initialCalendarDay} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
