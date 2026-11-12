/**
 * UJverse — root application component (session, routing, feed orchestration).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Widoki informacyjne (`PUBLIC_VIEWS`) działają bez konta; pozostałe wymagają
 * sesji i bez niej pokazują `AuthRequired` zamiast pełnoekranowego logowania.
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocation, useNavigate } from 'react-router-dom'
import { PenSquare } from 'lucide-react'
import { toast } from './lib/appToast'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './supabaseClient'
import type { AppNotification, Comment, Post, Profile } from './types'
import Header from './components/Header'
import SideNav from './components/SideNav'
import MobileDrawer from './components/MobileDrawer'
import { EventsProvider } from './hooks/useEvents'
import ResetPassword from './pages/ResetPassword'
import BottomNav from './components/BottomNav'
import { ViewErrorBoundary } from './components/ViewErrorBoundary'
import { canonicalDepartment } from './lib/departments'
import { extractPostTags } from './lib/postTags'
import { Analytics } from '@vercel/analytics/react'
import { DataService } from './services/DataService'
import { PostService } from './services/PostService'
import { useFeedQuery } from './hooks/useFeedQuery'
import { useFeedMutations } from './hooks/useFeedMutations'
import { useAulaUnread } from './hooks/useAulaUnread'
import { useMyCohort } from './hooks/useMyCohort'
import { playNotificationPing } from './lib/notificationSound'
import { LecturerSubscriptionsProvider } from './lib/lecturerSubscriptionsContext'
import { useOnboarding } from './hooks/useOnboarding'
import { useFacultyPreference } from './hooks/useInfoPreferences'
import { consumePostAuthPath, loginPathFor } from './lib/info/postAuth'
import { sanitizeNextPath } from './lib/info/links'
import type { NavTarget } from './components/nav/navModel'
import InfoDashboard from './components/info/InfoDashboard'
import AnnouncementsPage from './components/info/AnnouncementsPage'
import RegistrationsPage from './components/info/RegistrationsPage'
import ToolsPage from './components/info/ToolsPage'
import InfoSearchPage from './components/info/InfoSearchPage'
import { recordPilotVisit } from './lib/info/productMetrics'
import { useChatStore } from './store/useChatStore'
import AuthRequired from './components/info/AuthRequired'
import { PROTECTED_FEATURES } from './components/info/protectedFeatures'
import { RowSkeletons } from './components/info/infoUi'
import { isGroupIndexPath, slugFromGroupPath } from './lib/groupPaths'

// Widoki konta i społeczności ładowane dopiero przy wejściu — strona startowa
// nie pobiera kodu feedu, profili ani powiadomień.
const Auth = lazy(() => import('./Auth'))
const FeedView = lazy(() => import('./components/FeedView'))
const EventsHub = lazy(() => import('./components/EventsHub'))
const ProfilePage = lazy(() => import('./pages/Profile'))
const NotificationsView = lazy(() => import('./components/NotificationsView'))
const SinglePostView = lazy(() => import('./components/SinglePostView'))
const ComposeBox = lazy(() => import('./components/ComposeBox'))
const SettingsView = lazy(() => import('./components/SettingsView'))
const NotificationPopup = lazy(
  () => import('./components/notifications/NotificationPopup'),
)
const ProfileModal = lazy(() => import('./components/ProfileModal'))
const SearchPageView = lazy(() => import('./components/SearchPageView'))
const GroupView = lazy(() => import('./components/GroupView'))
const GroupsIndexView = lazy(() => import('./components/GroupsIndexView'))
const MojPlanView = lazy(() => import('./components/MojPlanView'))
const AdminDiagView = lazy(() => import('./components/admin/AdminDiagView'))
const AdminReportsView = lazy(
  () => import('./components/admin/AdminReportsView'),
)
const OfficialEventsPage = lazy(
  () => import('./components/info/OfficialEventsPage'),
)
const StudentGuides = lazy(() => import('./components/info/StudentGuides'))
const ChatAssistantFab = lazy(
  () => import('./components/chat/ChatAssistantFab'),
)
const ChatHubView = lazy(() => import('./components/chat/ChatHubView'))
const AulaView = lazy(() => import('./components/aula/AulaView'))
const SaleFinderView = lazy(
  () => import('./components/sale-finder/SaleFinderView'),
)
const ZniskiView = lazy(() => import('./components/discounts/ZniskiView'))
const UsosRegistrationsView = lazy(
  () => import('./components/usos/UsosRegistrationsView'),
)
const UsosAlarmBanner = lazy(() => import('./components/usos/UsosAlarmBanner'))
const MiejscaNaukiView = lazy(
  () => import('./components/study-spots/MiejscaNaukiView'),
)
const OnboardingTour = lazy(
  () => import('./components/onboarding/OnboardingTour'),
)

type AppShellView =
  | 'home'
  | 'komunikaty'
  | 'rejestracje'
  | 'wydarzenia'
  | 'szukaj'
  | 'niezbednik'
  | 'poradniki'
  | 'login'
  | 'feed'
  | 'profile'
  | 'notifications'
  | 'events'
  | 'search'
  | 'post'
  | 'userProfile'
  | 'settings'
  | 'group'
  | 'chat'
  | 'aula'
  | 'sale'
  | 'mojPlan'
  | 'znizki'
  | 'usos'
  | 'miejsca'
  | 'adminDiag'
  | 'adminReports'

/** Widoki publiczne i lokalne preferencje; ustawienia konta chroni SettingsView. */
const PUBLIC_VIEWS: ReadonlySet<AppShellView> = new Set<AppShellView>([
  'home',
  'komunikaty',
  'rejestracje',
  'wydarzenia',
  'szukaj',
  'niezbednik',
  'poradniki',
  'sale',
  'chat',
  'settings',
  'login',
])

/** Widoki korzystające z kontekstu wydarzeń społeczności (`useEvents`). */
const EVENTS_CONTEXT_VIEWS: ReadonlySet<AppShellView> = new Set<AppShellView>([
  'feed',
  'events',
  'profile',
  'userProfile',
])

/** Widoki renderujące posty — tylko tu pobieramy feed. */
const POST_VIEWS: ReadonlySet<AppShellView> = new Set<AppShellView>([
  'feed',
  'profile',
  'userProfile',
  'search',
  'group',
  'post',
])

/** Kanoniczne ścieżki widoków bez parametrów (aliasy obsługuje `parseAppRoute`). */
const VIEW_PATHS: Partial<Record<AppShellView, string>> = {
  home: '/',
  komunikaty: '/komunikaty',
  rejestracje: '/rejestracje',
  wydarzenia: '/wydarzenia',
  szukaj: '/szukaj',
  niezbednik: '/niezbednik',
  poradniki: '/poradniki',
  login: '/logowanie',
  feed: '/spolecznosc',
  profile: '/profile',
  events: '/events',
  notifications: '/notifications',
  search: '/search',
  chat: '/chat',
  aula: '/aula',
  mojPlan: '/moj-plan',
  sale: '/sale',
  znizki: '/znizki',
  usos: '/usos',
  miejsca: '/miejsca',
  settings: '/settings',
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

function profileHandleFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/profile\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

function threadPostIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/thread\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

function isResetPasswordPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname)
  return normalized === '/reset-password'
}

/**
 * Powłoka obok SideNav: header i bannery idą na pełną szerokość do prawej
 * krawędzi okna. Wąskość feedu (max-w-7xl) ustawia tylko `<main>` przez
 * `getAppContentShellClass` — wcześniej cała ramka 80rem ucinała header.
 */
function getAppShellClass(_view: AppShellView): string {
  return 'w-full lg:ml-56 lg:w-[calc(100%-14rem)]'
}

/** Wspólny `max-w` + padding dla `<main>` — mieści się w kolumnie obok SideNav. */
function getAppContentShellClass(view: AppShellView): string {
  if (view === 'chat' || view === 'aula') return 'w-full px-4 lg:px-6'
  if (
    view === 'home' ||
    view === 'events' ||
    view === 'wydarzenia' ||
    view === 'komunikaty' ||
    view === 'rejestracje' ||
    view === 'niezbednik' ||
    view === 'poradniki' ||
    view === 'miejsca' ||
    view === 'notifications'
  ) {
    return 'mx-auto w-full max-w-[1800px] px-4 lg:px-6 xl:px-8'
  }
  if (view === 'mojPlan') {
    return 'mx-auto w-full max-w-[1600px] px-4 lg:px-8 xl:px-12'
  }
  if (
    view === 'szukaj' ||
    view === 'feed' ||
    view === 'profile' ||
    view === 'userProfile' ||
    view === 'search' ||
    view === 'group' ||
    view === 'sale' ||
    view === 'znizki' ||
    view === 'usos' ||
    view === 'adminDiag' ||
    view === 'adminReports'
  ) {
    return 'mx-auto w-full max-w-7xl px-4 lg:px-6'
  }
  // Ta sama szerokość co feed — karty ustawień rozkładają się w siatce.
  if (view === 'settings') return 'mx-auto w-full max-w-7xl px-4 lg:px-6'
  return 'mx-auto w-full max-w-2xl px-4'
}

function getMainLayoutClass(view: AppShellView): string {
  if (view === 'chat' || view === 'aula') return 'w-full'
  const base = 'py-4 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-4'
  if (view === 'settings') return `${base} space-y-0`
  if (view === 'profile' || view === 'userProfile') return `${base} space-y-4`
  // Wąskie widoki (post, thread itd.) — jak dawniej `max-w-2xl space-y-3`.
  const shellWideViews: AppShellView[] = [
    'home',
    'komunikaty',
    'rejestracje',
    'szukaj',
    'niezbednik',
    'poradniki',
    'feed',
    'search',
    'group',
    'wydarzenia',
    'events',
    'sale',
    'znizki',
    'usos',
    'adminDiag',
    'adminReports',
    'miejsca',
    'notifications',
    'mojPlan',
  ]
  if (!shellWideViews.includes(view)) return `${base} space-y-3`
  return base
}

type RouteParseOk = {
  kind: 'ok'
  view: AppShellView
  profileHandle: string | null
  postId: string | null
}

type RouteParseUnknown = { kind: 'unknown' }

/** Single place that maps pathname → shell view + mirrored state (listener + effectiveActiveView). */
function parseAppRoute(
  normalizedPath: string,
): RouteParseOk | RouteParseUnknown {
  const simple = (view: AppShellView): RouteParseOk => ({
    kind: 'ok',
    view,
    profileHandle: null,
    postId: null,
  })
  // Warstwa informacyjna (publiczna).
  if (normalizedPath === '/') return simple('home')
  if (normalizedPath === '/komunikaty') return simple('komunikaty')
  if (normalizedPath === '/rejestracje') return simple('rejestracje')
  if (normalizedPath === '/wydarzenia') return simple('wydarzenia')
  if (normalizedPath === '/szukaj') return simple('szukaj')
  if (normalizedPath === '/niezbednik') return simple('niezbednik')
  if (
    normalizedPath === '/poradniki' ||
    /^\/poradniki\/[a-z0-9-]+$/.test(normalizedPath)
  )
    return simple('poradniki')
  if (normalizedPath === '/logowanie') return simple('login')
  // Feed społeczności — dawniej pod `/`.
  if (normalizedPath === '/spolecznosc') return simple('feed')
  if (normalizedPath === '/settings') {
    return { kind: 'ok', view: 'settings', profileHandle: null, postId: null }
  }
  const postId = threadPostIdFromPath(normalizedPath)
  if (postId) {
    return { kind: 'ok', view: 'post', profileHandle: null, postId }
  }
  const handleRaw = profileHandleFromPath(normalizedPath)
  if (handleRaw) {
    const profileHandle = handleRaw.trim().toLowerCase()
    if (profileHandle) {
      return { kind: 'ok', view: 'userProfile', profileHandle, postId: null }
    }
  }
  if (normalizedPath === '/profile') {
    return { kind: 'ok', view: 'profile', profileHandle: null, postId: null }
  }
  if (normalizedPath === '/events') {
    return { kind: 'ok', view: 'events', profileHandle: null, postId: null }
  }
  if (normalizedPath === '/notifications') {
    return {
      kind: 'ok',
      view: 'notifications',
      profileHandle: null,
      postId: null,
    }
  }
  if (normalizedPath === '/search') {
    return { kind: 'ok', view: 'search', profileHandle: null, postId: null }
  }
  if (normalizedPath === '/chat') {
    return { kind: 'ok', view: 'chat', profileHandle: null, postId: null }
  }
  if (normalizedPath === '/aula') {
    return { kind: 'ok', view: 'aula', profileHandle: null, postId: null }
  }
  // `/moj-plan` jest jedyną stroną akademicką — `/dzis` i `/briefing` zostały
  // skonsolidowane do jednego widoku (Dziś + Tydzień + Zmiany + Komunikaty
  // + Eventy + Next exam w jednym miejscu).
  if (
    normalizedPath === '/moj-plan' ||
    normalizedPath === '/dzis' ||
    normalizedPath === '/briefing'
  ) {
    return { kind: 'ok', view: 'mojPlan', profileHandle: null, postId: null }
  }
  if (normalizedPath === '/sale') {
    return { kind: 'ok', view: 'sale', profileHandle: null, postId: null }
  }
  if (normalizedPath === '/znizki') {
    return { kind: 'ok', view: 'znizki', profileHandle: null, postId: null }
  }
  // Alarmy i wpisy społeczności (wymaga konta). `/rejestracje` to od pivotu
  // publiczna lista z USOSweb (wyżej).
  if (normalizedPath === '/usos') {
    return { kind: 'ok', view: 'usos', profileHandle: null, postId: null }
  }
  if (normalizedPath === '/miejsca' || normalizedPath === '/sale-nauki') {
    return { kind: 'ok', view: 'miejsca', profileHandle: null, postId: null }
  }
  // Admin diag dashboard — token-gated po stronie serwera, sam URL nie
  // wymaga roli `admin` (każdy zalogowany może otworzyć, ale bez tokena
  // nie pobierze danych z `/api/diag/*`).
  if (normalizedPath === '/admin/cache' || normalizedPath === '/admin/diag') {
    return { kind: 'ok', view: 'adminDiag', profileHandle: null, postId: null }
  }
  // Panel zgłoszeń — gate'owany po stronie klienta po
  // `myProfile.role === 'admin'` ORAZ po stronie DB przez RLS
  // (`reports_select_own_or_admin` używa `is_profile_admin()`).
  if (
    normalizedPath === '/admin/reports' ||
    normalizedPath === '/admin/zgloszenia'
  ) {
    return {
      kind: 'ok',
      view: 'adminReports',
      profileHandle: null,
      postId: null,
    }
  }
  if (isGroupIndexPath(normalizedPath)) {
    return { kind: 'ok', view: 'group', profileHandle: null, postId: null }
  }
  const groupSlug = slugFromGroupPath(normalizedPath)
  if (groupSlug) {
    return { kind: 'ok', view: 'group', profileHandle: null, postId: null }
  }
  return { kind: 'unknown' }
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  /** `false` dopóki `getSession()` nie odpowie — widoki publiczne nie czekają, chronione pokazują szkielet. */
  const [authReady, setAuthReady] = useState(false)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const facultyPreference = useFacultyPreference({
    sessionUserId: session?.user?.id ?? null,
    profileDepartment: myProfile?.department ?? null,
  })
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [activeProfileHandle, setActiveProfileHandle] = useState<string | null>(
    null,
  )
  const [selectedDepartment, setSelectedDepartment] = useState('')
  /** Raz na sesję: po załadowaniu profilu ustawiamy filtr na `profiles.department`. */
  const departmentDefaultFromProfileRef = useRef<string | null>(null)
  const [isMobileComposeOpen, setIsMobileComposeOpen] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false)
  const [bellRingTick, setBellRingTick] = useState(0)
  const notificationsAnchorRef = useRef<HTMLButtonElement | null>(null)

  const normalizedPath = useMemo(
    () => normalizePathname(location.pathname),
    [location.pathname],
  )
  useEffect(() => {
    recordPilotVisit()
  }, [normalizedPath])
  const routeSnapshot = useMemo(
    () => parseAppRoute(normalizedPath),
    [normalizedPath],
  )
  const effectiveActiveView: AppShellView = useMemo(() => {
    if (routeSnapshot.kind === 'unknown') return 'home'
    return routeSnapshot.view
  }, [routeSnapshot])

  // Posts — single React Query cache `['feed', viewerId]` (patrz `useFeedQuery`).
  // Wszystko (lista, likes, comments count) idzie z jednego RPC `get_feed_snapshot`.
  // Pobierane tylko na widokach z postami — strona startowa ich nie potrzebuje.
  const feedQuery = useFeedQuery(
    POST_VIEWS.has(effectiveActiveView) ? (session?.user?.id ?? null) : null,
  )
  const feedMutations = useFeedMutations(session?.user?.id ?? null)
  const posts = feedQuery.posts as Post[]
  const postsLoading = feedQuery.isLoading
  const postsError = feedQuery.error?.message ?? null

  // Overlay enrichmentu dla postów spoza feed cache (głównie GroupCard — posty
  // z konkretnej strefy mogą być starsze niż pierwsza strona feedu). Mapy
  // feedQuery są autorytatywne dla aktualnie pobranych stron feedu; overlay
  // dorzuca enrichment dla pozostałych.
  const [extraLikesCountByPost, setExtraLikesCountByPost] = useState<
    Record<string, number>
  >({})
  const [extraLikedPostIds, setExtraLikedPostIds] = useState<
    Record<string, boolean>
  >({})
  const [extraCommentsCountByPost, setExtraCommentsCountByPost] = useState<
    Record<string, number>
  >({})
  const likesCountByPost = useMemo(
    () => ({ ...extraLikesCountByPost, ...feedQuery.likesCountByPost }),
    [extraLikesCountByPost, feedQuery.likesCountByPost],
  )
  const likedPostIds = useMemo(
    () => ({ ...extraLikedPostIds, ...feedQuery.likedPostIds }),
    [extraLikedPostIds, feedQuery.likedPostIds],
  )
  const commentsCountByPost = useMemo(
    () => ({ ...extraCommentsCountByPost, ...feedQuery.commentsCountByPost }),
    [extraCommentsCountByPost, feedQuery.commentsCountByPost],
  )

  // Compose
  const [isComposing, setIsComposing] = useState(false)
  const [createBody, setCreateBody] = useState('')
  const [createImageFile, setCreateImageFile] = useState<File | null>(null)
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(
    null,
  )
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Likes UI state (poza React Query — tylko per-post loading + heart pop animation).
  const [likeLoadingByPost, setLikeLoadingByPost] = useState<
    Record<string, boolean>
  >({})
  const [heartPopPostId, setHeartPopPostId] = useState<string | null>(null)
  const heartPopTimeout = useRef<number | null>(null)

  // Comments
  const [commentsByPost, setCommentsByPost] = useState<
    Record<string, Comment[]>
  >({})
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set(),
  )
  const [commentInput, setCommentInput] = useState<Record<string, string>>({})
  const [commentSubmitting, setCommentSubmitting] = useState<
    Record<string, boolean>
  >({})
  const [commentReplyTargetByPost, setCommentReplyTargetByPost] = useState<
    Record<string, { commentId: number; username: string } | null>
  >({})
  const [commentLikeLoadingByPost, setCommentLikeLoadingByPost] = useState<
    Record<string, Record<number, boolean>>
  >({})
  /** true while initial/user-triggered fetch runs; realtime refetches use silent mode (no flag). */
  const [commentsLoadingByPost, setCommentsLoadingByPost] = useState<
    Record<string, boolean>
  >({})
  const [profileHandleByUserId, setProfileHandleByUserId] = useState<
    Record<string, string>
  >({})

  const expandedCommentsRef = useRef(expandedComments)
  // Set of postIds where the current user just submitted a comment (1.5 s cooldown window)
  const recentlySubmittedRef = useRef<Set<string>>(new Set())
  // Mirror of commentsByPost state — lets realtime closures read current IDs without stale captures
  const commentsByPostRef = useRef(commentsByPost)
  useEffect(() => {
    expandedCommentsRef.current = expandedComments
  }, [expandedComments])
  useEffect(() => {
    commentsByPostRef.current = commentsByPost
  }, [commentsByPost])

  const sortCommentsForThread = useCallback((items: Comment[]): Comment[] => {
    const withStableOrder = [...items].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    const children = new Map<number, Comment[]>()
    const roots: Comment[] = []
    for (const item of withStableOrder) {
      const parentId = item.parent_id
      if (!parentId) {
        roots.push(item)
      } else {
        const bucket = children.get(parentId) ?? []
        bucket.push(item)
        children.set(parentId, bucket)
      }
    }
    const ordered: Comment[] = []
    const walk = (root: Comment) => {
      ordered.push(root)
      for (const child of children.get(root.id) ?? []) walk(child)
    }
    for (const root of roots) walk(root)
    // Keep orphaned comments visible if parent was deleted client-side.
    for (const item of withStableOrder) {
      if (!ordered.some((entry) => entry.id === item.id)) ordered.push(item)
    }
    return ordered
  }, [])

  const postIds = useMemo(
    () =>
      posts
        .map((p) => p?.id)
        .filter((id): id is string => id !== undefined && id !== null),
    [posts],
  )

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  )
  const routeProfileHandle = useMemo(() => {
    const h = profileHandleFromPath(normalizedPath)
    return h ? h.toLowerCase() : null
  }, [normalizedPath])
  const routeThreadPostId = useMemo(
    () => threadPostIdFromPath(normalizedPath),
    [normalizedPath],
  )
  const routeGroupSlug = useMemo(
    () => slugFromGroupPath(normalizedPath),
    [normalizedPath],
  )
  // Unread badge dla Auli — lekka subskrypcja cohort_messages (poza widokiem
  // Auli; gdy user na niej jest, hook się sam wycisza i marker się resetuje).
  const { hasUnread: aulaHasUnread, markSeen: markAulaSeen } = useAulaUnread({
    userId: session?.user?.id ?? null,
    myProfile,
    isOnAula: effectiveActiveView === 'aula',
  })

  // Cohort zalogowanego usera — używany przez OmniSearchHub (sekcja Aula
  // w globalnym searchu jest opt-in: tylko gdy mamy cohortId).
  const { cohort: myCohort } = useMyCohort({
    userId: session?.user?.id ?? null,
    myProfile,
  })
  const myCohortId = myCohort?.id ?? null
  const navigateToAulaMessage = useCallback(
    (messageId: number) => {
      navigate(`/aula?message=${messageId}`)
    },
    [navigate],
  )

  // Po wejściu na stronę (i załadowaniu profilu) filtr wydziału + komunikaty
  // startują na wydziale usera — np. WZiKS zamiast „Wszystkie”. Raz na sesję:
  // jeśli user przełączy pille ręcznie, nie nadpisujemy przy kolejnych renderach.
  useEffect(() => {
    departmentDefaultFromProfileRef.current = null
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return
    const canon = canonicalDepartment(myProfile?.department)
    if (!canon) return
    if (departmentDefaultFromProfileRef.current === session.user.id) return
    departmentDefaultFromProfileRef.current = session.user.id
    setSelectedDepartment(canon)
  }, [session?.user?.id, myProfile?.department])

  /** Keep navigation-related state aligned with the URL (hybrid shell). */
  useEffect(() => {
    if (isResetPasswordPath(location.pathname)) return
    const parsed = parseAppRoute(normalizedPath)
    if (parsed.kind === 'unknown') {
      navigate('/', { replace: true })
      return
    }
    const { profileHandle, postId } = parsed
    setActiveProfileHandle((prev) => {
      const next = profileHandle
      return prev === next ? prev : next
    })
    setActivePostId((prev) => {
      const next = postId
      return prev === next ? prev : next
    })
  }, [location.pathname, normalizedPath, navigate])

  const fetchProfileHandleByUserId = useCallback(
    async (userId: string): Promise<string | null> => {
      const cached = profileHandleByUserId[userId]
      if (cached) return cached
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle()
      if (error || !data?.username) return null
      const nextHandle = String(data.username).trim().toLowerCase()
      if (!nextHandle) return null
      setProfileHandleByUserId((prev) =>
        prev[userId] === nextHandle ? prev : { ...prev, [userId]: nextHandle },
      )
      return nextHandle
    },
    [profileHandleByUserId],
  )

  // ── Image preview URL management ──────────────────────────────────────────

  useEffect(() => {
    if (!createImageFile) {
      setCreateImagePreview(null)
      return
    }
    const url = URL.createObjectURL(createImageFile)
    setCreateImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [createImageFile])

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchMyProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select(
        'id, full_name, username, avatar_url, banner_url, bio, department, role, is_banned, is_searchable, show_department, study_program, year_started, study_mode, onboarding_completed_at, onboarding_skipped_at',
      )
      .eq('id', userId)
      .single()
    if (data) {
      setMyProfile(data as Profile)
      if (data.username) {
        const normalized = String(data.username).trim().toLowerCase()
        if (normalized) {
          setProfileHandleByUserId((prev) =>
            prev[userId] === normalized
              ? prev
              : { ...prev, [userId]: normalized },
          )
        }
      }
    }
  }, [])

  const fetchCommentsForPost = useCallback(
    async (postId: string, opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false
      if (!silent) setCommentsLoadingByPost((p) => ({ ...p, [postId]: true }))
      try {
        const commentsQ = await supabase
          .from('comments')
          .select(
            'id, post_id, user_id, content, created_at, parent_id, profiles(id, full_name, username, avatar_url, department)',
          )
          .eq('post_id', Number(postId))
          .order('created_at', { ascending: true })

        if (commentsQ.error) {
          console.error(
            '[fetchCommentsForPost] comments query error:',
            commentsQ.error,
          )
        }
        if (commentsQ.error) return

        const commentsNormalized: Comment[] = (commentsQ.data ?? []).map(
          (c) => ({
            id: Number(c.id),
            post_id: String(c.post_id ?? postId),
            user_id: String(c.user_id ?? ''),
            content: String(c.content ?? ''),
            created_at: String(c.created_at ?? new Date().toISOString()),
            parent_id: Number(c.parent_id ?? 0) || null,
            is_reply: Boolean(c.parent_id),
            can_like: true,
            profiles: Array.isArray(c.profiles)
              ? ((c.profiles[0] ?? null) as Profile | null)
              : ((c.profiles ?? null) as Profile | null),
          }),
        )

        const commentIds = commentsNormalized
          .map((comment) => Number(comment.id))
          .filter((commentId) => Number.isFinite(commentId) && commentId > 0)

        const { data: likesRows } = commentIds.length
          ? await supabase
              .from('comment_likes')
              .select('comment_id, user_id')
              .in('comment_id', commentIds)
          : {
              data: [] as Array<{ comment_id: number; user_id: string | null }>,
            }

        const likesCountByComment: Record<number, number> = {}
        const likedByMe: Record<number, boolean> = {}
        for (const row of likesRows ?? []) {
          const commentId = Number(row.comment_id)
          if (!Number.isFinite(commentId) || commentId <= 0) continue
          likesCountByComment[commentId] =
            (likesCountByComment[commentId] ?? 0) + 1
          if (row.user_id === session?.user?.id) {
            likedByMe[commentId] = true
          }
        }

        const commentsWithLikes: Comment[] = commentsNormalized.map(
          (comment) => ({
            ...comment,
            likes_count: likesCountByComment[comment.id] ?? 0,
            is_liked: Boolean(likedByMe[comment.id]),
          }),
        )

        const normalized = sortCommentsForThread(commentsWithLikes)
        setCommentsByPost((prev) => ({ ...prev, [postId]: normalized }))
      } finally {
        if (!silent)
          setCommentsLoadingByPost((p) => ({ ...p, [postId]: false }))
      }
    },
    [session?.user?.id, sortCommentsForThread],
  )

  const fetchNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!session?.user?.id) return
      const silent = opts?.silent ?? false
      if (!silent) setNotificationsLoading(true)
      const { data, error } = await DataService.listNotificationsForUser(
        session.user.id,
      )
      if (error) {
        console.error('[fetchNotifications]', error.message)
      } else {
        const next = data ?? []
        setNotifications(next)
        setProfileHandleByUserId((prev) => {
          let changed = false
          const merged = { ...prev }
          for (const item of next) {
            const actorId = item.actor?.id
            const handle = item.actor?.username?.trim().toLowerCase()
            if (!actorId || !handle || merged[actorId] === handle) continue
            merged[actorId] = handle
            changed = true
          }
          return changed ? merged : prev
        })
      }
      if (!silent) setNotificationsLoading(false)
    },
    [session],
  )

  // Cache username handles from feed posts (used by routing/profile-link logic).
  // React Query trzyma listę postów; my po prostu mapujemy `profiles.username` na
  // `profileHandleByUserId`. Bez tego nawigacja po `/profile/:handle` z URL-a do
  // zalogowanego usera może zostać bez handlu, gdy posty są w cache, ale handle
  // jeszcze nie był zapisany.
  useEffect(() => {
    if (posts.length === 0) return
    setProfileHandleByUserId((prev) => {
      let changed = false
      const merged = { ...prev }
      for (const post of posts) {
        const userId = post.profiles?.id
        const handle = post.profiles?.username?.trim().toLowerCase()
        if (!userId || !handle || merged[userId] === handle) continue
        merged[userId] = handle
        changed = true
      }
      return changed ? merged : prev
    })
  }, [posts])

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => setSession(s))
      .catch((err) => console.warn('[auth] getSession failed', err))
      .finally(() => setAuthReady(true))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      setAuthReady(true)
      if (event === 'PASSWORD_RECOVERY') {
        const p = (window.location.pathname || '/').replace(/\/+$/, '') || '/'
        if (p !== '/reset-password') {
          navigate('/reset-password', { replace: true })
        }
        return
      }
      // Powrót tam, skąd użytkownik przyszedł do logowania (także po OAuth,
      // który wraca na `/`). Cel jest zapisywany tylko przez stronę `/logowanie`.
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && s) {
        const next = consumePostAuthPath()
        if (next) navigate(next, { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  // Zalogowany użytkownik na `/logowanie` (np. zaraz po zalogowaniu hasłem)
  // wraca pod `?next=` albo na stronę startową.
  useEffect(() => {
    if (!authReady || !session || normalizedPath !== '/logowanie') return
    const next = sanitizeNextPath(
      new URLSearchParams(location.search).get('next'),
    )
    navigate(next ?? '/', { replace: true })
  }, [authReady, session, normalizedPath, location.search, navigate])

  const chatIdentity = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!authReady) return
    const next = session?.user.id ?? null
    if (chatIdentity.current !== undefined && chatIdentity.current !== next) {
      useChatStore.getState().clearHistory()
    }
    chatIdentity.current = next
  }, [authReady, session?.user.id])

  // Po wylogowaniu (lub wygaśnięciu sesji) czyścimy stan konta — widoki
  // publiczne działają dalej, chronione pokażą `AuthRequired`.
  useEffect(() => {
    if (session) return
    setMyProfile(null)
    setNotifications([])
    setNotificationsPanelOpen(false)
    setMenuOpen(false)
    setProfileModalOpen(false)
    setIsMobileComposeOpen(false)
  }, [session])

  const handleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Nie udało się wylogować. Spróbuj ponownie.')
      return
    }
    useChatStore.getState().clearHistory()
    navigate('/')
  }, [navigate])

  /**
   * OAuth domain guard — Google OAuth pozwala wybrać dowolne konto Google
   * (parametr `hd=uj.edu.pl` to tylko HINT w accountchooser, nie restrykcja).
   * Tu twardo sprawdzamy że email jest z domeny UJ (lub legacy shadow
   * `@ujverse.test`). Jeśli nie — sign out + toast.
   *
   * Sprawdzamy `app_metadata.provider` żeby NIE blokować legacy shadow
   * userów którzy mogliby teoretycznie mieć email spoza UJ wzorca.
   */
  useEffect(() => {
    if (!session?.user) return
    const provider =
      (session.user.app_metadata?.provider as string | undefined) ?? null
    if (provider !== 'google') return
    const email = session.user.email ?? ''
    const isAllowed =
      /@(student\.)?uj\.edu\.pl$/i.test(email) || /@ujverse\.test$/i.test(email)
    if (isAllowed) return
    toast.error(
      'Konta Google poza domeną UJ nie mogą się logować. Użyj konta @uj.edu.pl lub @student.uj.edu.pl.',
    )
    void supabase.auth.signOut()
  }, [session])

  useEffect(() => {
    if (!session) return
    void fetchMyProfile(session.user.id)
  }, [session, fetchMyProfile])

  useEffect(() => {
    if (!session?.user?.id) return
    void fetchNotifications()
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          setBellRingTick((t) => t + 1)
          playNotificationPing()
          void fetchNotifications({ silent: true })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user?.id, fetchNotifications])

  // ── Create post ───────────────────────────────────────────────────────────

  const handleCreatePost = async () => {
    if (createLoading) return
    setCreateError(null)
    const content = createBody.trim()
    const hasMedia = Boolean(createImageFile)
    if (!content && !hasMedia) {
      setCreateError('Dodaj treść albo zdjęcie zanim opublikujesz.')
      return
    }
    const userId = session?.user?.id
    if (!userId) return

    setCreateLoading(true)
    let imageUrl: string | null = null

    if (createImageFile) {
      const safeName = createImageFile.name.replace(/[^\w.-]/g, '_')
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(`${userId}/${Date.now()}-${safeName}`, createImageFile)
      if (uploadError) {
        setCreateError(uploadError.message)
        toast.error('Błąd przesyłania zdjęcia.')
        setCreateLoading(false)
        return
      }
      imageUrl = supabase.storage.from('media').getPublicUrl(uploadData.path)
        .data.publicUrl
    }

    const postContent = content || ''
    const tags = extractPostTags(postContent)
    const { error } = await PostService.createPost({
      userId,
      content: postContent,
      imageUrl,
      tags,
    })
    if (error) {
      setCreateError(error.message)
      toast.error('Nie udało się opublikować wpisu.')
      setCreateLoading(false)
      return
    }

    setCreateBody('')
    setCreateImageFile(null)
    setIsComposing(false)
    setCreateLoading(false)
    toast.success('Wpis opublikowany!')
    feedMutations.invalidateFeed()
  }

  const resetCompose = () => {
    setIsComposing(false)
    setCreateBody('')
    setCreateImageFile(null)
    setCreateError(null)
    setIsMobileComposeOpen(false)
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  const navigateToPost = useCallback(
    (postId: string) => {
      navigate(`/thread/${encodeURIComponent(postId)}`)
    },
    [navigate],
  )

  const navigateToMainView = useCallback(
    (view: AppShellView) => {
      const p = normalizePathname(location.pathname)
      const simplePath = VIEW_PATHS[view]
      if (simplePath) {
        if (p !== simplePath) navigate(simplePath)
        return
      }
      const currentHandle = activeProfileHandle ?? routeProfileHandle
      if (view === 'userProfile' && currentHandle) {
        const target = `/profile/${encodeURIComponent(currentHandle)}`
        if (p !== target) navigate(target)
        return
      }
      if (view === 'post' && activePostId) {
        const target = `/thread/${encodeURIComponent(activePostId)}`
        if (p !== target) navigate(target)
        return
      }
      if (p !== '/') navigate('/')
    },
    [
      location.pathname,
      navigate,
      activeProfileHandle,
      routeProfileHandle,
      activePostId,
    ],
  )

  const navigateToUser = useCallback(
    async (userId: string) => {
      const handle = await fetchProfileHandleByUserId(userId)
      if (!handle) return
      navigate(`/profile/${encodeURIComponent(handle)}`)
    },
    [fetchProfileHandleByUserId, navigate],
  )

  const navigateToProfileByHandle = useCallback(
    (handle: string) => {
      const normalized = handle.trim().toLowerCase()
      if (!normalized) return
      navigate(`/profile/${encodeURIComponent(normalized)}`)
    },
    [navigate],
  )

  const openSettings = useCallback(() => {
    if (normalizePathname(location.pathname) !== '/settings') {
      navigate('/settings')
    }
  }, [location.pathname, navigate])

  const navigateToPostFromNotificationsPanel = useCallback(
    (postId: string) => {
      setNotificationsPanelOpen(false)
      navigate(`/thread/${encodeURIComponent(postId)}`)
    },
    [navigate],
  )

  const goBackInHistory = useCallback(() => {
    navigate(-1)
  }, [navigate])

  /**
   * Fetcher likes/comments dla postów spoza feed cache (group view). Zapisuje
   * do `extra*` overlay; feed cache pozostaje autorytatywny tam gdzie ma dane.
   */
  const handleGroupPostsLoaded = useCallback(
    async (ids: string[]) => {
      const viewerId = session?.user?.id
      if (!viewerId || ids.length === 0) return
      const numericIds = ids.map(Number).filter((n) => Number.isFinite(n))
      if (numericIds.length === 0) return

      const [likesQ, commentsQ] = await Promise.all([
        supabase
          .from('likes')
          .select('post_id, user_id')
          .in('post_id', numericIds),
        supabase.from('comments').select('post_id').in('post_id', numericIds),
      ])

      const likeCounts: Record<string, number> = {}
      const likedFlags: Record<string, boolean> = {}
      for (const like of likesQ.data ?? []) {
        const key = String(like.post_id)
        likeCounts[key] = (likeCounts[key] ?? 0) + 1
        if (like.user_id === viewerId) likedFlags[key] = true
      }
      const commentCounts: Record<string, number> = {}
      for (const c of commentsQ.data ?? []) {
        const key = String(c.post_id)
        commentCounts[key] = (commentCounts[key] ?? 0) + 1
      }

      setExtraLikesCountByPost((prev) => ({ ...prev, ...likeCounts }))
      setExtraLikedPostIds((prev) => ({ ...prev, ...likedFlags }))
      setExtraCommentsCountByPost((prev) => ({ ...prev, ...commentCounts }))
    },
    [session?.user?.id],
  )

  const navigateToUserFromNotificationsPanel = useCallback(
    async (userId: string) => {
      setNotificationsPanelOpen(false)
      await navigateToUser(userId)
    },
    [navigateToUser],
  )

  const markNotificationRead = useCallback(
    async (id: string) => {
      const userId = session?.user?.id
      if (!userId) return
      const idKey = String(id)
      setNotifications((prev) =>
        prev.map((n) => (String(n.id) === idKey ? { ...n, is_read: true } : n)),
      )
      const { error } = await DataService.markNotificationRead(userId, idKey)
      if (error) {
        console.error('[markNotificationRead]', error.message)
        toast.error('Nie udało się zaktualizować powiadomienia.')
        await fetchNotifications({ silent: true })
        return
      }
      await fetchNotifications({ silent: true })
    },
    [session?.user?.id, fetchNotifications],
  )

  const markAllRead = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    const { error } = await DataService.markAllNotificationsRead(userId)
    if (error) {
      console.error('[markAllRead]', error.message)
      toast.error('Nie udało się oznaczyć powiadomień jako przeczytane.')
      await fetchNotifications({ silent: true })
      return
    }
    await fetchNotifications({ silent: true })
  }, [session?.user?.id, fetchNotifications])

  const clearAllNotifications = useCallback(async () => {
    if (!session?.user?.id) return
    setNotifications([])
    const { error } = await DataService.clearAllNotificationsForUser(
      session.user.id,
    )
    if (error) {
      console.error('[clearAllNotifications]', error.message)
      toast.error('Nie udało się wyczyścić powiadomień.')
      await fetchNotifications({ silent: true })
      return
    }
    await fetchNotifications({ silent: true })
  }, [session?.user?.id, fetchNotifications])

  const toggleNotificationsPanel = useCallback(() => {
    setNotificationsPanelOpen((prev) => {
      const next = !prev
      if (next) void fetchNotifications()
      return next
    })
  }, [fetchNotifications])

  const closeNotificationsPanel = useCallback(() => {
    setNotificationsPanelOpen(false)
  }, [])

  // ── Likes ─────────────────────────────────────────────────────────────────

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!session?.user?.id || likeLoadingByPost[postId]) return
      const alreadyLiked = Boolean(likedPostIds[postId])

      // Heart-pop tylko przy polubieniu (nie przy odlubieniu).
      if (!alreadyLiked) {
        setHeartPopPostId(postId)
        if (heartPopTimeout.current) clearTimeout(heartPopTimeout.current)
        heartPopTimeout.current = window.setTimeout(
          () => setHeartPopPostId(null),
          450,
        )
      }

      setLikeLoadingByPost((p) => ({ ...p, [postId]: true }))

      // Post jest w feed cache → mutacja przez React Query (optimistic + rollback).
      if (
        postId in feedQuery.likesCountByPost ||
        postId in feedQuery.likedPostIds
      ) {
        try {
          await feedMutations.toggleLike.mutateAsync({
            postId,
            currentlyLiked: alreadyLiked,
          })
        } catch (err) {
          console.error('[toggleLike] feed mutation failed:', err)
        }
      } else {
        // Post spoza feed cache (np. GroupCard) — patch overlay + direct supabase.
        setExtraLikesCountByPost((p) => ({
          ...p,
          [postId]: Math.max(
            0,
            (p[postId] ?? likesCountByPost[postId] ?? 0) +
              (alreadyLiked ? -1 : 1),
          ),
        }))
        setExtraLikedPostIds((p) => ({ ...p, [postId]: !alreadyLiked }))
        if (alreadyLiked) {
          await supabase
            .from('likes')
            .delete()
            .eq('post_id', Number(postId))
            .eq('user_id', session.user.id)
        } else {
          await supabase
            .from('likes')
            .insert([{ post_id: Number(postId), user_id: session.user.id }])
        }
      }

      setLikeLoadingByPost((p) => ({ ...p, [postId]: false }))
    },
    [
      session,
      likeLoadingByPost,
      likedPostIds,
      likesCountByPost,
      feedQuery.likesCountByPost,
      feedQuery.likedPostIds,
      feedMutations,
    ],
  )

  // ── Comments ──────────────────────────────────────────────────────────────

  const toggleComments = useCallback(
    (postId: string) => {
      const shouldOpen = !expandedCommentsRef.current.has(postId)
      setExpandedComments((prev) => {
        const next = new Set(prev)
        if (next.has(postId)) next.delete(postId)
        else next.add(postId)
        return next
      })
      if (shouldOpen) {
        // Fire-and-forget fetch: panel opens immediately, data hydrates in background.
        void fetchCommentsForPost(postId)
      }
    },
    [fetchCommentsForPost],
  )

  const toggleCommentLike = useCallback(
    async (postId: string, comment: Comment) => {
      if (!session?.user?.id || !comment.can_like || comment.id <= 0) return

      const commentId = Number(comment.id)
      const currentlyLiked = Boolean(comment.is_liked)
      const likeDelta = currentlyLiked ? -1 : 1

      setCommentLikeLoadingByPost((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] ?? {}), [commentId]: true },
      }))

      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((item) =>
          item.id !== comment.id
            ? item
            : {
                ...item,
                is_liked: !currentlyLiked,
                likes_count: Math.max(
                  0,
                  Number(item.likes_count ?? 0) + likeDelta,
                ),
              },
        ),
      }))

      const query = supabase.from('comment_likes')
      const { error } = currentlyLiked
        ? await query
            .delete()
            .eq('comment_id', commentId)
            .eq('user_id', session.user.id)
        : await query.insert({
            comment_id: commentId,
            user_id: session.user.id,
          })

      if (error) {
        setCommentsByPost((prev) => ({
          ...prev,
          [postId]: (prev[postId] ?? []).map((item) =>
            item.id !== comment.id
              ? item
              : {
                  ...item,
                  is_liked: currentlyLiked,
                  likes_count: Math.max(
                    0,
                    Number(item.likes_count ?? 0) - likeDelta,
                  ),
                },
          ),
        }))
      }

      setCommentLikeLoadingByPost((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] ?? {}), [commentId]: false },
      }))
    },
    [session?.user?.id],
  )

  const setReplyTarget = useCallback((postId: string, comment: Comment) => {
    const targetId = comment.id
    if (!targetId) return
    const usernameRaw =
      comment.profiles?.username || comment.profiles?.full_name || 'uzytkownik'
    const username = usernameRaw.trim().replace(/^@+/, '') || 'uzytkownik'
    setCommentReplyTargetByPost((prev) => ({
      ...prev,
      [postId]: { commentId: targetId, username },
    }))
  }, [])

  const clearReplyTarget = useCallback((postId: string) => {
    setCommentReplyTargetByPost((prev) => ({ ...prev, [postId]: null }))
  }, [])

  const submitComment = useCallback(
    async (postId: string) => {
      const content = (commentInput[postId] ?? '').trim()
      if (!content || !session?.user?.id || commentSubmitting[postId]) return
      const replyTarget = commentReplyTargetByPost[postId]
      const isReply = Boolean(replyTarget?.commentId)
      const optimisticId = Date.now()

      const optimisticComment: Comment = {
        id: optimisticId,
        post_id: postId,
        user_id: session.user.id,
        content,
        created_at: new Date().toISOString(),
        parent_id: replyTarget?.commentId ?? null,
        is_reply: isReply,
        can_like: true,
        likes_count: 0,
        is_liked: false,
        profiles: myProfile,
      }
      console.log('[submitComment] Local comment added', optimisticComment)

      // Mark this post as recently-submitted so the realtime handler won't overwrite us
      recentlySubmittedRef.current.add(postId)
      window.setTimeout(() => recentlySubmittedRef.current.delete(postId), 1500)

      setCommentsByPost((p) => ({
        ...p,
        [postId]: sortCommentsForThread([
          ...(p[postId] ?? []),
          optimisticComment,
        ]),
      }))
      feedMutations.updateCommentsCount(postId, (n) => n + 1)
      setExtraCommentsCountByPost((p) => ({
        ...p,
        [postId]: (p[postId] ?? 0) + 1,
      }))
      setExpandedComments((prev) => new Set([...prev, postId]))
      setCommentInput((p) => ({ ...p, [postId]: '' }))
      setCommentReplyTargetByPost((prev) => ({ ...prev, [postId]: null }))

      setCommentSubmitting((p) => ({ ...p, [postId]: true }))
      const insertResult = await supabase
        .from('comments')
        .insert([
          {
            post_id: Number(postId),
            user_id: session.user.id,
            content,
            parent_id: replyTarget?.commentId ?? null,
          },
        ])
        .select('id')
        .single()

      const { data: inserted, error: insertError } = insertResult

      if (!insertError && inserted) {
        // Swap temp key → real DB id (keep everything else, avoid any re-fetch)
        const nextId = Number(inserted.id)
        setCommentsByPost((p) => ({
          ...p,
          [postId]: (p[postId] ?? []).map((c) =>
            c.id === optimisticComment.id ? { ...c, id: nextId } : c,
          ),
        }))
      } else if (insertError) {
        console.error('[submitComment] Błąd INSERT:', insertError)
        setCommentsByPost((p) => ({
          ...p,
          [postId]: (p[postId] ?? []).filter(
            (c) => c.id !== optimisticComment.id,
          ),
        }))
        feedMutations.updateCommentsCount(postId, (n) => n - 1)
        setExtraCommentsCountByPost((p) => ({
          ...p,
          [postId]: Math.max(0, (p[postId] ?? 1) - 1),
        }))
        setCommentReplyTargetByPost((prev) => ({
          ...prev,
          [postId]: replyTarget ?? null,
        }))
      }
      setCommentSubmitting((p) => ({ ...p, [postId]: false }))
    },
    [
      commentInput,
      commentReplyTargetByPost,
      commentSubmitting,
      session,
      myProfile,
      sortCommentsForThread,
      feedMutations,
    ],
  )

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        await feedMutations.removePost.mutateAsync({ postId })
      } catch (err) {
        console.error('[handleDeletePost] Błąd Supabase:', err)
        return
      }
      setExtraLikesCountByPost((prev) => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
      setExtraLikedPostIds((prev) => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
      setExtraCommentsCountByPost((prev) => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
      setCommentsByPost((prev) => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
      setCommentReplyTargetByPost((prev) => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
      setCommentLikeLoadingByPost((prev) => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
    },
    [feedMutations],
  )

  const handleDeleteComment = useCallback(
    async (commentId: number, postId: string) => {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
      if (error) {
        console.error('[handleDeleteComment]', error)
        return
      }
      const currentComments = commentsByPostRef.current[postId] ?? []
      const childrenMap = new Map<number, number[]>()
      for (const item of currentComments) {
        if (!item.parent_id) continue
        const bucket = childrenMap.get(item.parent_id) ?? []
        bucket.push(item.id)
        childrenMap.set(item.parent_id, bucket)
      }
      const cascadeIds = new Set<number>()
      const queue: number[] = [commentId]
      while (queue.length > 0) {
        const current = queue.shift()
        if (!current || cascadeIds.has(current)) continue
        cascadeIds.add(current)
        for (const childId of childrenMap.get(current) ?? [])
          queue.push(childId)
      }
      const removedCount =
        currentComments.filter((c) => cascadeIds.has(c.id)).length || 1
      setCommentsByPost((prev) => {
        const before = prev[postId] ?? []
        const filtered = before.filter((c) => !cascadeIds.has(c.id))
        return {
          ...prev,
          [postId]: filtered,
        }
      })
      feedMutations.updateCommentsCount(postId, (n) => n - removedCount)
      setExtraCommentsCountByPost((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] ?? 1) - removedCount),
      }))
      setCommentReplyTargetByPost((prev) => {
        const target = prev[postId]
        if (!target) return prev
        if (!cascadeIds.has(target.commentId)) return prev
        return { ...prev, [postId]: null }
      })
    },
    [feedMutations],
  )

  // ── Realtime ──────────────────────────────────────────────────────────────
  //
  // Kanał `likes` jest zawężony do **moich** zdarzeń (`user_id=eq.<self>`) +
  // throttle przez `feedMutations.invalidateFeed()`. Cel: synchronizacja
  // między urządzeniami tego samego usera. Globalne lubi innych userów nie
  // generują już chatter'u — React Query refetchOnWindowFocus + 30s staleTime
  // zsynchronizuje przy następnym powrocie do okna.

  useEffect(() => {
    if (!session?.user?.id || postIds.length === 0) return
    const viewerId = session.user.id
    let likesInvalidateTimer: number | null = null
    const channel = supabase
      .channel('ujverse-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `user_id=eq.${viewerId}`,
        },
        () => {
          if (likesInvalidateTimer !== null)
            window.clearTimeout(likesInvalidateTimer)
          likesInvalidateTimer = window.setTimeout(() => {
            feedMutations.invalidateFeed()
            likesInvalidateTimer = null
          }, 1500)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_likes' },
        (payload) => {
          const row = payload.eventType === 'DELETE' ? payload.old : payload.new
          const changedCommentId = Number(row?.comment_id ?? 0)
          const actorId = String(row?.user_id ?? '')
          if (!Number.isFinite(changedCommentId) || changedCommentId <= 0)
            return
          if (actorId === session?.user?.id) return
          for (const pid of Object.keys(commentsByPostRef.current)) {
            const comments = commentsByPostRef.current[pid] ?? []
            if (!comments.some((comment) => comment.id === changedCommentId))
              continue
            setCommentsByPost((prev) => ({
              ...prev,
              [pid]: (prev[pid] ?? []).map((comment) => {
                if (comment.id !== changedCommentId) return comment
                const isInsert = payload.eventType === 'INSERT'
                const nextLikes = Math.max(
                  0,
                  Number(comment.likes_count ?? 0) + (isInsert ? 1 : -1),
                )
                return {
                  ...comment,
                  likes_count: nextLikes,
                  is_liked: comment.is_liked,
                }
              }),
            }))
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        (payload) => {
          const pid = String(payload.new?.post_id)
          const commentAuthorId = String(payload.new?.user_id)
          const incomingId = payload.new?.id
          console.log('[Realtime] comment INSERT received', {
            pid,
            commentAuthorId,
            currentUserId: session?.user?.id,
            incomingId,
          })

          if (!postIds.includes(pid)) return

          // Guard 1: skip own comment events (should already be covered, but be explicit)
          if (commentAuthorId === session?.user?.id) {
            console.log('[Realtime] skipping own comment event')
            return
          }

          // Guard 2: cooldown — skip if we just submitted to this post (trigger latency buffer)
          if (recentlySubmittedRef.current.has(pid)) {
            console.log(
              '[Realtime] cooldown active, skipping realtime fetch for',
              pid,
            )
            return
          }

          // Guard 3: de-duplication — skip if this comment ID already exists in local state
          const existing = commentsByPostRef.current[pid] ?? []
          if (
            incomingId !== undefined &&
            existing.some((c) => String(c.id) === String(incomingId))
          ) {
            console.log('[Realtime] duplicate comment, skipping', incomingId)
            return
          }

          feedMutations.updateCommentsCount(pid, (n) => n + 1)
          setExtraCommentsCountByPost((p) => ({
            ...p,
            [pid]: (p[pid] ?? 0) + 1,
          }))
          if (expandedCommentsRef.current.has(pid))
            void fetchCommentsForPost(pid, { silent: true })
        },
      )
      .subscribe()
    return () => {
      if (likesInvalidateTimer !== null)
        window.clearTimeout(likesInvalidateTimer)
      void supabase.removeChannel(channel)
    }
  }, [session?.user?.id, postIds, feedMutations, fetchCommentsForPost])

  useEffect(
    () => () => {
      if (heartPopTimeout.current) clearTimeout(heartPopTimeout.current)
    },
    [],
  )

  // ── Widoki: publiczne vs wymagające konta ─────────────────────────────────

  if (isResetPasswordPath(location.pathname)) {
    return <ResetPassword />
  }

  if (effectiveActiveView === 'login') {
    // Zalogowanego przenosi efekt `/logowanie` wyżej — formularza nie montujemy,
    // żeby nie zapisać zbędnego celu powrotu.
    if (!authReady || session) return null
    return (
      <Suspense fallback={null}>
        <Auth />
      </Suspense>
    )
  }

  const isAuthenticated = Boolean(session)
  const sessionUserId = session?.user?.id ?? null
  const displayName =
    myProfile?.full_name || session?.user?.email?.split('@')[0] || 'Użytkownik'
  const firstName = myProfile?.full_name?.trim().split(/\s+/)[0] || null
  const viewedHandle = routeProfileHandle ?? activeProfileHandle
  const currentPathWithQuery = `${location.pathname}${location.search}`
  const loginHref = loginPathFor(currentPathWithQuery)

  const contentShellClass = getAppContentShellClass(effectiveActiveView)
  const appShellClass = getAppShellClass(effectiveActiveView)
  const mainLayoutClass = getMainLayoutClass(effectiveActiveView)

  const sharedPostProps = {
    myProfile,
    displayName,
    currentUserId: sessionUserId ?? '',
    likesCountByPost,
    likedPostIds,
    heartPopPostId,
    commentsCountByPost,
    commentsByPost,
    commentsLoadingByPost,
    expandedComments,
    commentInput,
    commentSubmitting,
    commentReplyTargetByPost,
    commentLikeLoadingByPost,
    onToggleLike: toggleLike,
    onToggleComments: toggleComments,
    onSubmitComment: submitComment,
    onToggleCommentLike: toggleCommentLike,
    onReplyToComment: setReplyTarget,
    onCancelReply: clearReplyTarget,
    onCommentInputChange: (postId: string, value: string) =>
      setCommentInput((p) => ({ ...p, [postId]: value })),
    onDeletePost: handleDeletePost,
    onDeleteComment: handleDeleteComment,
  }

  const navigateToTarget = (target: NavTarget) => navigateToMainView(target)
  const recoverHome = () => navigateToMainView('home')
  const openMobileCompose = () => {
    setCreateError(null)
    setCreateBody('')
    setCreateImageFile(null)
    setIsMobileComposeOpen(true)
  }

  const viewFallback = (
    <div className="mx-auto w-full max-w-3xl" aria-busy="true">
      <RowSkeletons count={3} />
    </div>
  )

  const renderPublicView = (): ReactNode => {
    switch (effectiveActiveView) {
      case 'settings':
        return (
          <ViewErrorBoundary onRecover={recoverHome}>
            <Suspense fallback={viewFallback}>
              <SettingsView
                key={
                  isAuthenticated
                    ? (session?.user.id ?? 'authenticated')
                    : 'guest'
                }
                isAuthenticated={isAuthenticated}
                email={isAuthenticated ? session?.user.email : undefined}
                myProfile={isAuthenticated ? myProfile : null}
                onProfilePatch={(patch) =>
                  setMyProfile((prev) => (prev ? { ...prev, ...patch } : prev))
                }
                onBack={goBackInHistory}
              />
            </Suspense>
          </ViewErrorBoundary>
        )
      case 'chat':
        return (
          <Suspense fallback={viewFallback}>
            <ChatHubView
              displayName={isAuthenticated ? displayName : ''}
              myProfile={myProfile}
              isAuthenticated={isAuthenticated}
            />
          </Suspense>
        )
      case 'home':
        return (
          <InfoDashboard
            faculty={facultyPreference}
            isAuthenticated={isAuthenticated}
            firstName={firstName}
          />
        )
      case 'komunikaty':
        return <AnnouncementsPage faculty={facultyPreference} />
      case 'rejestracje':
        return (
          <RegistrationsPage
            faculty={facultyPreference}
            isAuthenticated={isAuthenticated}
          />
        )
      case 'wydarzenia':
        return (
          <ViewErrorBoundary onRecover={recoverHome}>
            <Suspense fallback={viewFallback}>
              <OfficialEventsPage isAuthenticated={isAuthenticated} />
            </Suspense>
          </ViewErrorBoundary>
        )
      case 'szukaj':
        // Nowe wyszukiwanie z nagłówka/menu niesie `searchNonce` — zmiana klucza
        // resetuje pole do frazy z URL bez synchronizacji w efekcie.
        return (
          <InfoSearchPage
            key={String(
              (location.state as { searchNonce?: number } | null)
                ?.searchNonce ?? 'szukaj',
            )}
            faculty={facultyPreference}
            isAuthenticated={isAuthenticated}
          />
        )
      case 'niezbednik':
        return <ToolsPage isAuthenticated={isAuthenticated} />
      case 'poradniki':
        return (
          <Suspense fallback={viewFallback}>
            <StudentGuides slug={normalizedPath.split('/')[2] ?? null} />
          </Suspense>
        )
      case 'sale':
        return (
          <ViewErrorBoundary onRecover={recoverHome}>
            <Suspense fallback={viewFallback}>
              <SaleFinderView onBack={goBackInHistory} />
            </Suspense>
          </ViewErrorBoundary>
        )
      default:
        return null
    }
  }

  const renderProtectedView = (s: Session): ReactNode => {
    switch (effectiveActiveView) {
      case 'feed':
        return (
          <>
            <FeedView
              {...sharedPostProps}
              posts={
                selectedDepartment
                  ? posts.filter(
                      (p) =>
                        canonicalDepartment(p.profiles?.department) ===
                        canonicalDepartment(selectedDepartment),
                    )
                  : posts
              }
              postsLoading={postsLoading}
              postsError={postsError}
              hasNextPage={feedQuery.hasNextPage}
              isFetchingNextPage={feedQuery.isFetchingNextPage}
              onFetchNextPage={feedQuery.fetchNextPage}
              selectedDepartment={selectedDepartment}
              onDepartmentChange={setSelectedDepartment}
              isComposing={isComposing}
              createBody={createBody}
              createImageFile={createImageFile}
              createImagePreview={createImagePreview}
              createLoading={createLoading}
              createError={createError}
              onBodyChange={setCreateBody}
              onImageFileChange={setCreateImageFile}
              onComposeOpen={() => {
                setCreateError(null)
                setIsComposing(true)
              }}
              onComposeReset={resetCompose}
              onCreatePost={handleCreatePost}
              onNavigateToPost={navigateToPost}
              onNavigateToUser={navigateToUser}
              onNavigateToEvents={() => navigateToMainView('events')}
              onNavigateToProfileHandle={navigateToProfileByHandle}
            />
            {/* Pisanie wpisu na telefonie — dawniej środkowy przycisk dolnego paska. */}
            <button
              type="button"
              onClick={openMobileCompose}
              className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40 md:hidden dark:bg-gradient-to-br dark:from-brand-gold-bright dark:to-brand-gold dark:text-zinc-900"
            >
              <PenSquare size={18} strokeWidth={2.25} aria-hidden />
              Nowy wpis
            </button>
          </>
        )
      case 'events':
        return (
          <EventsHub
            currentUserId={s.user.id}
            onNavigateToProfileHandle={navigateToProfileByHandle}
          />
        )
      case 'profile':
      case 'userProfile':
        if (effectiveActiveView === 'userProfile' && !viewedHandle) {
          return null
        }
        return (
          <ProfilePage
            {...sharedPostProps}
            posts={posts}
            postsLoading={postsLoading}
            viewedHandle={
              effectiveActiveView === 'userProfile' ? viewedHandle! : null
            }
            onNavigateToPost={navigateToPost}
            joinedAtLabel={
              s.user.created_at
                ? new Date(s.user.created_at).toLocaleDateString('pl-PL', {
                    month: 'long',
                    year: 'numeric',
                  })
                : null
            }
            onOpenProfileModal={() => setProfileModalOpen(true)}
            onNavigateToUser={navigateToUser}
            onNavigateToProfileHandle={navigateToProfileByHandle}
            onNavigateToEvents={() => navigateToMainView('events')}
            onAvatarUpdate={(url) =>
              setMyProfile((prev) =>
                prev ? { ...prev, avatar_url: url } : prev,
              )
            }
            onBannerUpdate={(url) =>
              setMyProfile((prev) =>
                prev ? { ...prev, banner_url: url } : prev,
              )
            }
          />
        )
      case 'notifications':
        return (
          <NotificationsView
            notifications={notifications}
            loading={notificationsLoading}
            onMarkRead={markNotificationRead}
            onMarkAllRead={markAllRead}
            onNavigateToPost={navigateToPost}
            onNavigateToUser={navigateToUser}
          />
        )
      case 'search':
        return (
          <SearchPageView
            {...sharedPostProps}
            onNavigateToUser={navigateToUser}
            onNavigateToPost={navigateToPost}
            onNavigateToEvents={(openEventId) => {
              if (openEventId) {
                navigate('/events', { state: { openEventId } })
                return
              }
              navigateToMainView('events')
            }}
            cohortId={myCohortId}
            onNavigateToAulaMessage={navigateToAulaMessage}
          />
        )
      case 'group':
        if (!routeGroupSlug) return <GroupsIndexView />
        return (
          <GroupView
            groupSlug={routeGroupSlug}
            {...sharedPostProps}
            onNavigateToPost={navigateToPost}
            onNavigateToUser={navigateToUser}
            onPostsLoaded={handleGroupPostsLoaded}
          />
        )
      case 'post':
        if (!routeThreadPostId) return null
        return (
          <SinglePostView
            postId={routeThreadPostId}
            {...sharedPostProps}
            onBack={goBackInHistory}
            onNavigateToUser={navigateToUser}
          />
        )
      case 'aula':
        return (
          <AulaView
            currentUserId={s.user.id}
            myProfile={myProfile}
            onProfilePatch={(patch) =>
              setMyProfile((prev) => (prev ? { ...prev, ...patch } : prev))
            }
            onAulaSeen={markAulaSeen}
          />
        )
      case 'mojPlan':
        return (
          <ViewErrorBoundary onRecover={recoverHome}>
            <MojPlanView
              userId={s.user.id}
              myProfile={myProfile}
              cohort={myCohort}
            />
          </ViewErrorBoundary>
        )
      case 'znizki':
        return (
          <ViewErrorBoundary onRecover={recoverHome}>
            <ZniskiView userId={s.user.id} />
          </ViewErrorBoundary>
        )
      case 'usos':
        return (
          <ViewErrorBoundary onRecover={recoverHome}>
            <UsosRegistrationsView
              userId={s.user.id}
              studyProgram={myProfile?.study_program ?? null}
              yearStarted={myProfile?.year_started ?? null}
            />
          </ViewErrorBoundary>
        )
      case 'miejsca':
        return (
          <ViewErrorBoundary onRecover={recoverHome}>
            <MiejscaNaukiView
              session={s}
              onNavigateToProfile={navigateToProfileByHandle}
            />
          </ViewErrorBoundary>
        )
      case 'adminDiag':
        return (
          <ViewErrorBoundary onRecover={recoverHome}>
            <AdminDiagView />
          </ViewErrorBoundary>
        )
      case 'adminReports':
        return (
          <ViewErrorBoundary onRecover={recoverHome}>
            <AdminReportsView myProfile={myProfile} onBack={goBackInHistory} />
          </ViewErrorBoundary>
        )
      default:
        return null
    }
  }

  const mainViewContent: ReactNode = (() => {
    if (PUBLIC_VIEWS.has(effectiveActiveView)) return renderPublicView()
    // Sesja jeszcze nieznana — szkielet zamiast mignięcia ekranu logowania.
    if (!authReady) return viewFallback
    if (!session) {
      const copy = PROTECTED_FEATURES[effectiveActiveView] ?? {
        feature: 'Ta część UJverse',
        reason: 'Ta funkcja jest dostępna po zalogowaniu.',
      }
      return <AuthRequired copy={copy} nextPath={currentPathWithQuery} />
    }
    return (
      <Suspense fallback={viewFallback}>
        {renderProtectedView(session)}
      </Suspense>
    )
  })()

  const animatedMain = (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${effectiveActiveView}:${viewedHandle ?? ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        {mainViewContent}
      </motion.div>
    </AnimatePresence>
  )

  return (
    <LecturerSubscriptionsProvider userId={sessionUserId}>
      <>
        <Analytics
          beforeSend={(event) => {
            // Search text and account handles are not useful pageview dimensions.
            const url = new URL(event.url)
            url.search = ''
            url.hash = ''
            if (url.pathname.startsWith('/profile/')) url.pathname = '/profile'
            if (url.pathname.startsWith('/thread/')) url.pathname = '/thread'
            return { ...event, url: url.toString() }
          }}
        />
        <a
          href="#tresc"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[500] focus:rounded-xl focus:bg-bg-app focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-ink focus:shadow-lg dark:focus:text-brand-gold-bright"
        >
          Przejdź do treści
        </a>
        {session ? (
          <AppOnboardingGate
            userId={session.user.id}
            myProfile={myProfile}
            onProfilePatch={(patch) =>
              setMyProfile((prev) => (prev ? { ...prev, ...patch } : prev))
            }
          />
        ) : null}
        {session && profileModalOpen ? (
          <Suspense fallback={null}>
            <ProfileModal
              session={session}
              profile={myProfile}
              onClose={() => setProfileModalOpen(false)}
              onSaved={(u) => {
                setMyProfile(u)
                feedMutations.invalidateFeed()
              }}
              onAvatarUpdate={(url) =>
                setMyProfile((prev) =>
                  prev ? { ...prev, avatar_url: url } : prev,
                )
              }
            />
          </Suspense>
        ) : null}

        <AnimatePresence>
          {session && isMobileComposeOpen && (
            <motion.div
              key="mobile-compose-overlay"
              className="fixed inset-0 z-320 md:hidden flex flex-col justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="flex-1 bg-black/55 backdrop-blur-[2px]"
                aria-hidden
                onClick={resetCompose}
              />
              <motion.div
                className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-zinc-200 bg-white px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-[0_-12px_40px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_-16px_48px_rgba(0,0,0,0.5)]"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              >
                <div className="mx-auto mb-2 h-1.5 w-12 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                <Suspense fallback={null}>
                  <ComposeBox
                    sheetMode
                    myProfile={myProfile}
                    displayName={displayName}
                    isComposing={true}
                    body={createBody}
                    imageFile={createImageFile}
                    imagePreview={createImagePreview}
                    isLoading={createLoading}
                    error={createError}
                    onBodyChange={setCreateBody}
                    onImageFileChange={setCreateImageFile}
                    onOpen={() => {
                      setCreateError(null)
                    }}
                    onReset={resetCompose}
                    onSubmit={async () => {
                      await handleCreatePost()
                      setIsMobileComposeOpen(false)
                    }}
                  />
                </Suspense>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="campus-app min-h-dvh w-full max-w-full bg-zinc-50 dark:bg-bg-app">
          <div className={`relative min-h-dvh ${appShellClass}`}>
            <SideNav
              activeView={effectiveActiveView}
              isAuthenticated={isAuthenticated}
              unreadCount={unreadCount}
              aulaHasUnread={aulaHasUnread}
              onNavigate={navigateToTarget}
              onSignOut={() => void handleSignOut()}
              loginHref={loginHref}
            />

            <div className="min-w-0 w-full flex-1">
              <Header
                isAuthenticated={isAuthenticated}
                myProfile={myProfile}
                displayName={displayName}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                activeView={effectiveActiveView}
                unreadCount={unreadCount}
                bellRingTick={bellRingTick}
                notificationsPanelOpen={notificationsPanelOpen}
                notificationsAnchorRef={notificationsAnchorRef}
                onToggleNotificationsPanel={toggleNotificationsPanel}
                onCloseNotificationsPanel={closeNotificationsPanel}
                onNavigateHome={() => navigateToMainView('home')}
                onNavigateToProfile={() => navigateToMainView('profile')}
                onOpenProfileModal={() => setProfileModalOpen(true)}
                onNavigateToSettings={openSettings}
                onSignOut={() => void handleSignOut()}
                loginHref={loginHref}
                faculty={facultyPreference}
                onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
              />

              {session ? (
                <Suspense fallback={null}>
                  <UsosAlarmBanner
                    userId={session.user.id}
                    onNavigateToUsos={() => navigateToMainView('usos')}
                  />
                </Suspense>
              ) : null}

              <main
                id="tresc"
                tabIndex={-1}
                className={`${contentShellClass} ${mainLayoutClass} ${['home', 'komunikaty', 'rejestracje', 'niezbednik', 'poradniki', 'szukaj', 'wydarzenia'].includes(effectiveActiveView) ? 'campus-page' : ''} outline-none`}
              >
                {EVENTS_CONTEXT_VIEWS.has(effectiveActiveView) && session ? (
                  <EventsProvider>{animatedMain}</EventsProvider>
                ) : (
                  animatedMain
                )}
              </main>

              <BottomNav
                activeView={effectiveActiveView}
                onNavigate={navigateToTarget}
              />
            </div>
          </div>
        </div>

        <MobileDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          isAuthenticated={isAuthenticated}
          myProfile={myProfile}
          displayName={displayName}
          activeView={effectiveActiveView}
          unreadCount={unreadCount}
          aulaHasUnread={aulaHasUnread}
          onNavigate={navigateToTarget}
          onSignOut={() => void handleSignOut()}
          loginHref={loginHref}
        />

        {session ? (
          <Suspense fallback={null}>
            <NotificationPopup
              open={notificationsPanelOpen}
              onClose={closeNotificationsPanel}
              notifications={notifications}
              loading={notificationsLoading}
              onMarkRead={markNotificationRead}
              onClearAll={() => void clearAllNotifications()}
              onNavigateToPost={navigateToPostFromNotificationsPanel}
              onNavigateToUser={navigateToUserFromNotificationsPanel}
              anchorRef={notificationsAnchorRef}
            />
          </Suspense>
        ) : null}

        <Suspense fallback={null}>
          <ChatAssistantFab
            hidden={
              isMobileComposeOpen ||
              profileModalOpen ||
              notificationsPanelOpen ||
              mobileDrawerOpen ||
              menuOpen ||
              effectiveActiveView === 'chat' ||
              effectiveActiveView === 'home' ||
              effectiveActiveView === 'aula'
            }
            myProfile={myProfile}
            displayName={displayName}
            isAuthenticated={isAuthenticated}
          />
        </Suspense>
      </>
    </LecturerSubscriptionsProvider>
  )
}

/**
 * AppOnboardingGate — montuje interaktywny tour pierwszaka kiedy
 * `useOnboarding.shouldShow` (brak `onboarding_completed_at` i
 * `onboarding_skipped_at` w profilu).
 */
function AppOnboardingGate({
  userId,
  myProfile,
  onProfilePatch,
}: {
  userId: string
  myProfile: Profile | null
  onProfilePatch: (
    patch: Partial<
      Pick<Profile, 'onboarding_completed_at' | 'onboarding_skipped_at'>
    >,
  ) => void
}) {
  const onboarding = useOnboarding({ userId, myProfile, onProfilePatch })

  if (!onboarding.shouldShow) return null

  return (
    <Suspense fallback={null}>
      <OnboardingTour
        onComplete={() => {
          void onboarding.complete()
        }}
        onSkip={() => {
          void onboarding.skip()
        }}
      />
    </Suspense>
  )
}

export default App
