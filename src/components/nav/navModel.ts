/**
 * Jedno źródło architektury informacji dla SideNav (desktop) i MobileDrawer.
 * Najpierw informacje (dla wszystkich), potem konto (tylko zalogowani).
 */
import {
  AlarmClock,
  Bell,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home,
  Link2,
  Megaphone,
  MessageCircle,
  Search,
  User,
  Users,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

export type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>

export type PrimaryNavTarget = 'home' | 'komunikaty' | 'rejestracje' | 'wydarzenia' | 'szukaj' | 'niezbednik' | 'chat'
export type AccountNavTarget = 'mojPlan' | 'aula' | 'feed' | 'notifications' | 'profile'
export type NavTarget = PrimaryNavTarget | AccountNavTarget | 'settings'

export type NavEntry<T extends NavTarget = NavTarget> = {
  target: T
  label: string
  icon: NavIcon
  title?: string
}

export const PRIMARY_NAV: ReadonlyArray<NavEntry<PrimaryNavTarget>> = [
  { target: 'chat', label: 'Versuś AI', icon: MessageCircle, title: 'Zapytaj Versusia — także bez logowania' },
  { target: 'home', label: 'Start', icon: Home, title: 'Strona startowa — najważniejsze informacje' },
  { target: 'komunikaty', label: 'Komunikaty', icon: Megaphone, title: 'Komunikaty wydziałów UJ' },
  { target: 'rejestracje', label: 'Rejestracje', icon: AlarmClock, title: 'Rejestracje z USOSweb' },
  { target: 'wydarzenia', label: 'Wydarzenia', icon: CalendarDays, title: 'Wydarzenia na UJ' },
  { target: 'szukaj', label: 'Szukaj', icon: Search, title: 'Szukaj informacji' },
  { target: 'niezbednik', label: 'Niezbędnik', icon: Link2, title: 'USOSweb, PEGAZ, poczta i narzędzia' },
]

export const ACCOUNT_NAV: ReadonlyArray<NavEntry<AccountNavTarget>> = [
  { target: 'mojPlan', label: 'Mój plan', icon: ClipboardList, title: 'Twój plan zajęć' },
  { target: 'aula', label: 'Aula', icon: GraduationCap, title: 'Aula — czat rocznika' },
  { target: 'feed', label: 'Społeczność', icon: Users, title: 'Wpisy studentów' },
  { target: 'notifications', label: 'Powiadomienia', icon: Bell },
  { target: 'profile', label: 'Profil', icon: User },
]

/** Który element nawigacji podświetlić dla danego widoku aplikacji. */
export function navTargetForView(view: string): NavTarget | null {
  switch (view) {
    case 'chat':
    case 'home':
    case 'komunikaty':
    case 'rejestracje':
    case 'wydarzenia':
    case 'szukaj':
    case 'niezbednik':
    case 'mojPlan':
    case 'aula':
    case 'feed':
    case 'notifications':
    case 'profile':
    case 'settings':
      return view
    case 'usos':
      return 'rejestracje'
    case 'events':
      return 'wydarzenia'
    case 'search':
      return 'szukaj'
    case 'sale':
    case 'znizki':
    case 'miejsca':
      return 'niezbednik'
    case 'post':
    case 'group':
      return 'feed'
    default:
      return null
  }
}
