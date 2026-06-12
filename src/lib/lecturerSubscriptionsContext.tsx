/**
 * UJverse — Context dla subskrypcji wykładowców („Mój Plan").
 *
 * Świadomie OSOBNY kontekst od session (per architect rule #1 — nie powielamy
 * AuthContextu). Provider montuje się raz w `App.tsx` z session.user.id i daje
 * dowolnemu komponentowi (np. AnnouncementCard głęboko w drzewie) lokalny
 * dostęp do listy subskrypcji + akcji toggle bez prop-drillingu przez
 * EventsView, AcademicAnnouncementsWidget itd.
 */
import { createContext, useContext, type ReactNode } from 'react'
import {
  useLecturerSubscriptions,
  type UseLecturerSubscriptionsResult,
} from '../hooks/useLecturerSubscriptions'

const LecturerSubscriptionsContext = createContext<UseLecturerSubscriptionsResult | null>(null)

type ProviderProps = {
  userId: string | null
  children: ReactNode
}

export function LecturerSubscriptionsProvider({ userId, children }: ProviderProps) {
  const value = useLecturerSubscriptions({ userId })
  return (
    <LecturerSubscriptionsContext.Provider value={value}>
      {children}
    </LecturerSubscriptionsContext.Provider>
  )
}

/**
 * Konsumpcja przez UI. Zwraca `null` kiedy provider nie jest dostępny — to
 * świadomy fallback: komponent może być wyrenderowany w gałęzi gdzie nie
 * potrzebujemy subskrypcji (np. anonimowy widok), zamiast rzucać błędem.
 */
export function useLecturerSubscriptionsContext(): UseLecturerSubscriptionsResult | null {
  return useContext(LecturerSubscriptionsContext)
}
