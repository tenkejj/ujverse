import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from './lib/appToast'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import type { AppNotification, Comment, Post, Profile } from './types'
import Header from './components/Header'
import ProfileModal from './components/ProfileModal'
import FeedView from './components/FeedView'
import EventsView from './components/EventsView'
import { EventsProvider } from './hooks/useEvents'
import ProfilePage from './pages/Profile'
import ResetPassword from './pages/ResetPassword'
import BottomNav from './components/BottomNav'
import NotificationsView from './components/NotificationsView'
import SinglePostView from './components/SinglePostView'
import ComposeBox from './components/ComposeBox'
import SettingsView from './components/SettingsView'
import NotificationPopup from './components/notifications/NotificationPopup'
import { ViewErrorBoundary } from './components/ViewErrorBoundary'
import { canonicalDepartment } from './lib/departments'
import { Analytics } from '@vercel/analytics/react'
import { DataService } from './services/DataService'

type AppShellView =
  | 'feed'
  | 'profile'
  | 'notifications'
  | 'events'
  | 'post'
  | 'userProfile'
  | 'settings'

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

type RouteParseOk = {
  kind: 'ok'
  view: AppShellView
  profileHandle: string | null
  postId: string | null
}

type RouteParseUnknown = { kind: 'unknown' }

/** Single place that maps pathname → shell view + mirrored state (listener + effectiveActiveView). */
function parseAppRoute(normalizedPath: string): RouteParseOk | RouteParseUnknown {
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
    return { kind: 'ok', view: 'notifications', profileHandle: null, postId: null }
  }
  if (normalizedPath === '/') {
    return { kind: 'ok', view: 'feed', profileHandle: null, postId: null }
  }
  return { kind: 'unknown' }
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [activeProfileHandle, setActiveProfileHandle] = useState<string | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [isMobileComposeOpen, setIsMobileComposeOpen] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false)
  const [bellRingTick, setBellRingTick] = useState(0)
  const notificationsAnchorRef = useRef<HTMLButtonElement | null>(null)

  // Posts
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsError, setPostsError] = useState<string | null>(null)

  // Compose
  const [isComposing, setIsComposing] = useState(false)
  const [createBody, setCreateBody] = useState('')
  const [createImageFile, setCreateImageFile] = useState<File | null>(null)
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Likes
  const [likesCountByPost, setLikesCountByPost] = useState<Record<string, number>>({})
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>({})
  const [likeLoadingByPost, setLikeLoadingByPost] = useState<Record<string, boolean>>({})
  const [heartPopPostId, setHeartPopPostId] = useState<string | null>(null)
  const heartPopTimeout = useRef<number | null>(null)

  // Comments
  const [commentsCountByPost, setCommentsCountByPost] = useState<Record<string, number>>({})
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({})
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentInput, setCommentInput] = useState<Record<string, string>>({})
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({})
  const [commentReplyTargetByPost, setCommentReplyTargetByPost] = useState<
    Record<string, { commentId: number; username: string } | null>
  >({})
  const [commentLikeLoadingByPost, setCommentLikeLoadingByPost] = useState<
    Record<string, Record<number, boolean>>
  >({})
  /** true while initial/user-triggered fetch runs; realtime refetches use silent mode (no flag). */
  const [commentsLoadingByPost, setCommentsLoadingByPost] = useState<Record<string, boolean>>({})
  const [profileHandleByUserId, setProfileHandleByUserId] = useState<Record<string, string>>({})

  const expandedCommentsRef = useRef(expandedComments)
  // Set of postIds where the current user just submitted a comment (1.5 s cooldown window)
  const recentlySubmittedRef = useRef<Set<string>>(new Set())
  // Mirror of commentsByPost state — lets realtime closures read current IDs without stale captures
  const commentsByPostRef = useRef(commentsByPost)
  useEffect(() => { expandedCommentsRef.current = expandedComments }, [expandedComments])
  useEffect(() => { commentsByPostRef.current = commentsByPost }, [commentsByPost])

  const sortCommentsForThread = useCallback((items: Comment[]): Comment[] => {
    const withStableOrder = [...items].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
    () => posts.map((p) => p?.id).filter((id): id is string => id !== undefined && id !== null),
    [posts],
  )

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  )
  const normalizedPath = useMemo(() => normalizePathname(location.pathname), [location.pathname])
  const routeProfileHandle = useMemo(() => {
    const h = profileHandleFromPath(normalizedPath)
    return h ? h.toLowerCase() : null
  }, [normalizedPath])
  const routeThreadPostId = useMemo(() => threadPostIdFromPath(normalizedPath), [normalizedPath])
  const routeSnapshot = useMemo(() => parseAppRoute(normalizedPath), [normalizedPath])
  const effectiveActiveView: AppShellView = useMemo(() => {
    if (routeSnapshot.kind === 'unknown') return 'feed'
    return routeSnapshot.view
  }, [routeSnapshot])

  /** Keep navigation-related state aligned with the URL (hybrid shell). */
  useEffect(() => {
    if (isResetPasswordPath(location.pathname)) return
    if (!session) return
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
  }, [normalizedPath, navigate, session])

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
    if (!createImageFile) { setCreateImagePreview(null); return }
    const url = URL.createObjectURL(createImageFile)
    setCreateImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [createImageFile])

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchMyProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, banner_url, bio, department, role, is_banned')
      .eq('id', userId)
      .single()
    if (data) {
      setMyProfile(data as Profile)
      if (data.username) {
        const normalized = String(data.username).trim().toLowerCase()
        if (normalized) {
          setProfileHandleByUserId((prev) =>
            prev[userId] === normalized ? prev : { ...prev, [userId]: normalized },
          )
        }
      }
    }
  }, [])

  const fetchLikesForPosts = useCallback(
    async (ids: string[]) => {
      if (!session?.user?.id || ids.length === 0) { setLikesCountByPost({}); setLikedPostIds({}); return }
      const { data } = await supabase.from('likes').select('post_id, user_id').in('post_id', ids.map(Number))
      const counts: Record<string, number> = {}
      const liked: Record<string, boolean> = {}
      for (const like of data ?? []) {
        const key = String(like.post_id)
        counts[key] = (counts[key] ?? 0) + 1
        if (like.user_id === session.user.id) liked[key] = true
      }
      setLikesCountByPost(counts)
      setLikedPostIds(liked)
    },
    [session],
  )

  const fetchCommentsCount = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const { data } = await supabase.from('comments').select('post_id').in('post_id', ids.map(Number))
    const counts: Record<string, number> = {}
    for (const c of data ?? []) {
      const k = String(c.post_id)
      counts[k] = (counts[k] ?? 0) + 1
    }
    setCommentsCountByPost(counts)
  }, [])

  const fetchCommentsForPost = useCallback(async (postId: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false
    if (!silent) setCommentsLoadingByPost((p) => ({ ...p, [postId]: true }))
    try {
      const commentsQ = await supabase
        .from('comments')
        .select('id, post_id, user_id, content, created_at, parent_id, profiles(id, full_name, username, avatar_url, department)')
        .eq('post_id', Number(postId))
        .order('created_at', { ascending: true })

      if (commentsQ.error) {
        console.error('[fetchCommentsForPost] comments query error:', commentsQ.error)
      }
      if (commentsQ.error) return

      const commentsNormalized: Comment[] = (commentsQ.data ?? []).map((c) => ({
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
      }))

      const commentIds = commentsNormalized
        .map((comment) => Number(comment.id))
        .filter((commentId) => Number.isFinite(commentId) && commentId > 0)

      const { data: likesRows } = commentIds.length
        ? await supabase
            .from('comment_likes')
            .select('comment_id, user_id')
            .in('comment_id', commentIds)
        : { data: [] as Array<{ comment_id: number; user_id: string | null }> }

      const likesCountByComment: Record<number, number> = {}
      const likedByMe: Record<number, boolean> = {}
      for (const row of likesRows ?? []) {
        const commentId = Number(row.comment_id)
        if (!Number.isFinite(commentId) || commentId <= 0) continue
        likesCountByComment[commentId] = (likesCountByComment[commentId] ?? 0) + 1
        if (row.user_id === session?.user?.id) {
          likedByMe[commentId] = true
        }
      }

      const commentsWithLikes: Comment[] = commentsNormalized.map((comment) => ({
        ...comment,
        likes_count: likesCountByComment[comment.id] ?? 0,
        is_liked: Boolean(likedByMe[comment.id]),
      }))

      const normalized = sortCommentsForThread(commentsWithLikes)
      setCommentsByPost((prev) => ({ ...prev, [postId]: normalized }))
    } finally {
      if (!silent) setCommentsLoadingByPost((p) => ({ ...p, [postId]: false }))
    }
  }, [session?.user?.id, sortCommentsForThread])

  const fetchNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    if (!session?.user?.id) return
    const silent = opts?.silent ?? false
    if (!silent) setNotificationsLoading(true)
    const { data, error } = await DataService.listNotificationsForUser(session.user.id)
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
  }, [session])

  const fetchPosts = useCallback(async () => {
    setPostsLoading(true)
    setPostsError(null)
    const { data, error } = await supabase
      .from('posts')
      .select('*, user_id, profiles(id, full_name, username, avatar_url, department, is_banned)')
      .order('created_at', { ascending: false })
    if (error) { setPostsError(error.message); setPosts([]); setPostsLoading(false); return }
    const next = ((data ?? []) as Post[]).filter((p) => p.profiles?.is_banned !== true)
    setPosts(next)
    setProfileHandleByUserId((prev) => {
      let changed = false
      const merged = { ...prev }
      for (const post of next) {
        const userId = post.profiles?.id
        const handle = post.profiles?.username?.trim().toLowerCase()
        if (!userId || !handle || merged[userId] === handle) continue
        merged[userId] = handle
        changed = true
      }
      return changed ? merged : prev
    })
    const ids = next.map((p) => p?.id).filter((id): id is string => id !== undefined)
    await Promise.all([fetchLikesForPosts(ids), fetchCommentsCount(ids)])
    setPostsLoading(false)
  }, [fetchLikesForPosts, fetchCommentsCount])

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') {
        const p = (window.location.pathname || '/').replace(/\/+$/, '') || '/'
        if (p !== '/reset-password') {
          navigate('/reset-password', { replace: true })
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (!session) return
    void fetchPosts()
    void fetchMyProfile(session.user.id)
  }, [session, fetchPosts, fetchMyProfile])

  useEffect(() => {
    if (!session?.user?.id) return
    void fetchNotifications()
    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${session.user.id}`,
      }, () => {
        setBellRingTick((t) => t + 1)
        void fetchNotifications({ silent: true })
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
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
      const { data: uploadData, error: uploadError } = await supabase
        .storage.from('media')
        .upload(`${userId}/${Date.now()}-${safeName}`, createImageFile)
      if (uploadError) {
        setCreateError(uploadError.message)
        toast.error('Błąd przesyłania zdjęcia.')
        setCreateLoading(false)
        return
      }
      imageUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl
    }

    const postContent = content || ''
    const { error } = await supabase
      .from('posts')
      .insert([{ content: postContent, image_url: imageUrl, user_id: userId }])
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
    await fetchPosts()
  }

  const resetCompose = () => {
    setIsComposing(false)
    setCreateBody('')
    setCreateImageFile(null)
    setCreateError(null)
    setIsMobileComposeOpen(false)
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  const navigateToPost = useCallback((postId: string) => {
    navigate(`/thread/${encodeURIComponent(postId)}`)
  }, [navigate])

  const navigateToMainView = useCallback((
    view: AppShellView,
  ) => {
    const p = normalizePathname(location.pathname)
    if (view === 'profile') {
      if (p !== '/profile') navigate('/profile')
      return
    }
    if (view === 'feed') {
      if (p !== '/') navigate('/')
      return
    }
    if (view === 'events') {
      if (p !== '/events') navigate('/events')
      return
    }
    if (view === 'notifications') {
      if (p !== '/notifications') navigate('/notifications')
      return
    }
    if (view === 'settings') {
      if (p !== '/settings') navigate('/settings')
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
  }, [location.pathname, navigate, activeProfileHandle, routeProfileHandle, activePostId])

  const navigateToUser = useCallback(async (userId: string) => {
    const handle = await fetchProfileHandleByUserId(userId)
    if (!handle) return
    navigate(`/profile/${encodeURIComponent(handle)}`)
  }, [fetchProfileHandleByUserId, navigate])

  const navigateToProfileByHandle = useCallback((handle: string) => {
    const normalized = handle.trim().toLowerCase()
    if (!normalized) return
    navigate(`/profile/${encodeURIComponent(normalized)}`)
  }, [navigate])

  const openSettings = useCallback(() => {
    if (normalizePathname(location.pathname) !== '/settings') {
      navigate('/settings')
    }
  }, [location.pathname, navigate])

  const navigateToPostFromNotificationsPanel = useCallback((postId: string) => {
    setNotificationsPanelOpen(false)
    navigate(`/thread/${encodeURIComponent(postId)}`)
  }, [navigate])

  const goBackInHistory = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const navigateToUserFromNotificationsPanel = useCallback(async (userId: string) => {
    setNotificationsPanelOpen(false)
    await navigateToUser(userId)
  }, [navigateToUser])

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
    const { error } = await DataService.clearAllNotificationsForUser(session.user.id)
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

  const openNotificationsPanel = useCallback(() => {
    setMenuOpen(false)
    setNotificationsPanelOpen(true)
    void fetchNotifications()
  }, [fetchNotifications])


  // ── Likes ─────────────────────────────────────────────────────────────────

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!session?.user?.id || likeLoadingByPost[postId]) return
      const alreadyLiked = Boolean(likedPostIds[postId])

      setLikesCountByPost((p) => ({ ...p, [postId]: Math.max(0, (p[postId] ?? 0) + (alreadyLiked ? -1 : 1)) }))
      setLikedPostIds((p) => ({ ...p, [postId]: !alreadyLiked }))

      setHeartPopPostId(postId)
      if (heartPopTimeout.current) clearTimeout(heartPopTimeout.current)
      heartPopTimeout.current = window.setTimeout(() => setHeartPopPostId(null), 450)

      setLikeLoadingByPost((p) => ({ ...p, [postId]: true }))
      if (alreadyLiked) {
        await supabase.from('likes').delete().eq('post_id', Number(postId)).eq('user_id', session.user.id)
      } else {
        await supabase.from('likes').insert([{ post_id: Number(postId), user_id: session.user.id }])
      }
      setLikeLoadingByPost((p) => ({ ...p, [postId]: false }))
    },
    [session, likeLoadingByPost, likedPostIds],
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
                likes_count: Math.max(0, Number(item.likes_count ?? 0) + likeDelta),
              },
        ),
      }))

      const query = supabase.from('comment_likes')
      const { error } = currentlyLiked
        ? await query.delete().eq('comment_id', commentId).eq('user_id', session.user.id)
        : await query.insert({ comment_id: commentId, user_id: session.user.id })

      if (error) {
        setCommentsByPost((prev) => ({
          ...prev,
          [postId]: (prev[postId] ?? []).map((item) =>
            item.id !== comment.id
              ? item
              : {
                  ...item,
                  is_liked: currentlyLiked,
                  likes_count: Math.max(0, Number(item.likes_count ?? 0) - likeDelta),
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
    const usernameRaw = comment.profiles?.username || comment.profiles?.full_name || 'uzytkownik'
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
        [postId]: sortCommentsForThread([...(p[postId] ?? []), optimisticComment]),
      }))
      setCommentsCountByPost((p) => ({ ...p, [postId]: (p[postId] ?? 0) + 1 }))
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
            c.id === optimisticComment.id ? { ...c, id: nextId } : c
          ),
        }))
      } else if (insertError) {
        console.error('[submitComment] Błąd INSERT:', insertError)
        setCommentsByPost((p) => ({
          ...p,
          [postId]: (p[postId] ?? []).filter((c) => c.id !== optimisticComment.id),
        }))
        setCommentsCountByPost((p) => ({ ...p, [postId]: Math.max(0, (p[postId] ?? 1) - 1) }))
        setCommentReplyTargetByPost((prev) => ({ ...prev, [postId]: replyTarget ?? null }))
      }
      setCommentSubmitting((p) => ({ ...p, [postId]: false }))
    },
    [commentInput, commentReplyTargetByPost, commentSubmitting, session, myProfile, sortCommentsForThread],
  )

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeletePost = useCallback(async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', Number(postId))
    if (error) { console.error('[handleDeletePost] Błąd Supabase:', error); return }
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)))
    setLikesCountByPost((prev) => { const next = { ...prev }; delete next[postId]; return next })
    setLikedPostIds((prev) => { const next = { ...prev }; delete next[postId]; return next })
    setCommentsCountByPost((prev) => { const next = { ...prev }; delete next[postId]; return next })
    setCommentsByPost((prev) => { const next = { ...prev }; delete next[postId]; return next })
    setCommentReplyTargetByPost((prev) => { const next = { ...prev }; delete next[postId]; return next })
    setCommentLikeLoadingByPost((prev) => { const next = { ...prev }; delete next[postId]; return next })
  }, [])

  const handleDeleteComment = useCallback(async (commentId: number, postId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) { console.error('[handleDeleteComment]', error); return }
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
      for (const childId of childrenMap.get(current) ?? []) queue.push(childId)
    }
    const removedCount = currentComments.filter((c) => cascadeIds.has(c.id)).length || 1
    setCommentsByPost((prev) => {
      const before = prev[postId] ?? []
      const filtered = before.filter((c) => !cascadeIds.has(c.id))
      return {
        ...prev,
        [postId]: filtered,
      }
    })
    setCommentsCountByPost((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? 1) - removedCount),
    }))
    setCommentReplyTargetByPost((prev) => {
      const target = prev[postId]
      if (!target) return prev
      if (!cascadeIds.has(target.commentId)) return prev
      return { ...prev, [postId]: null }
    })
  }, [])

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session?.user?.id || postIds.length === 0) return
    const channel = supabase
      .channel('ujverse-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
        void fetchLikesForPosts(postIds)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, (payload) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new
        const changedCommentId = Number(row?.comment_id ?? 0)
        const actorId = String(row?.user_id ?? '')
        if (!Number.isFinite(changedCommentId) || changedCommentId <= 0) return
        if (actorId === session?.user?.id) return
        for (const pid of Object.keys(commentsByPostRef.current)) {
          const comments = commentsByPostRef.current[pid] ?? []
          if (!comments.some((comment) => comment.id === changedCommentId)) continue
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
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        const pid = String(payload.new?.post_id)
        const commentAuthorId = String(payload.new?.user_id)
        const incomingId = payload.new?.id
        console.log('[Realtime] comment INSERT received', { pid, commentAuthorId, currentUserId: session?.user?.id, incomingId })

        if (!postIds.includes(pid)) return

        // Guard 1: skip own comment events (should already be covered, but be explicit)
        if (commentAuthorId === session?.user?.id) {
          console.log('[Realtime] skipping own comment event')
          return
        }

        // Guard 2: cooldown — skip if we just submitted to this post (trigger latency buffer)
        if (recentlySubmittedRef.current.has(pid)) {
          console.log('[Realtime] cooldown active, skipping realtime fetch for', pid)
          return
        }

        // Guard 3: de-duplication — skip if this comment ID already exists in local state
        const existing = commentsByPostRef.current[pid] ?? []
        if (incomingId !== undefined && existing.some((c) => String(c.id) === String(incomingId))) {
          console.log('[Realtime] duplicate comment, skipping', incomingId)
          return
        }

        setCommentsCountByPost((p) => ({ ...p, [pid]: (p[pid] ?? 0) + 1 }))
        if (expandedCommentsRef.current.has(pid)) void fetchCommentsForPost(pid, { silent: true })
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [session?.user?.id, postIds, fetchLikesForPosts, fetchCommentsForPost])

  useEffect(() => () => { if (heartPopTimeout.current) clearTimeout(heartPopTimeout.current) }, [])

  // ── Auth guard ────────────────────────────────────────────────────────────

  if (isResetPasswordPath(location.pathname)) {
    return <ResetPassword />
  }

  if (!session) return <Auth />

  const displayName = myProfile?.full_name || session.user.email?.split('@')[0] || 'Użytkownik'
  const viewedHandle = routeProfileHandle ?? activeProfileHandle

  const navActiveView =
    effectiveActiveView === 'post' || effectiveActiveView === 'userProfile'
      ? 'feed'
      : effectiveActiveView === 'settings'
        ? 'profile'
        : effectiveActiveView

  const sharedPostProps = {
    myProfile,
    displayName,
    currentUserId: session.user.id,
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

  const mainViewContent: ReactNode = (() => {
    switch (effectiveActiveView) {
      case 'feed':
        return (
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
            onComposeOpen={() => { setCreateError(null); setIsComposing(true) }}
            onComposeReset={resetCompose}
            onCreatePost={handleCreatePost}
            onNavigateToPost={navigateToPost}
            onNavigateToUser={navigateToUser}
            onNavigateToEvents={() => navigateToMainView('events')}
            onMobileComposeTap={() => {
              setCreateError(null)
              setIsMobileComposeOpen(true)
            }}
          />
        )
      case 'events':
        return <EventsView currentUserId={session.user.id} />
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
            viewedHandle={effectiveActiveView === 'userProfile' ? viewedHandle! : null}
            onNavigateToPost={navigateToPost}
            joinedAtLabel={
              session.user.created_at
                ? new Date(session.user.created_at).toLocaleDateString('pl-PL', {
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
              setMyProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev))
            }
            onBannerUpdate={(url) =>
              setMyProfile((prev) => (prev ? { ...prev, banner_url: url } : prev))
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
      case 'settings':
        return (
          <ViewErrorBoundary onRecover={() => navigateToMainView('feed')}>
            <SettingsView
              email={session.user?.email ?? undefined}
              onBack={goBackInHistory}
            />
          </ViewErrorBoundary>
        )
      default:
        return null
    }
  })()

  return (
    <EventsProvider>
    <>
      <Analytics />
      {profileModalOpen && (
        <ProfileModal
          session={session}
          profile={myProfile}
          onClose={() => setProfileModalOpen(false)}
          onSaved={(u) => { setMyProfile(u); void fetchPosts() }}
          onAvatarUpdate={(url) =>
            setMyProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev))
          }
        />
      )}

      <AnimatePresence>
        {isMobileComposeOpen && (
          <motion.div
            key="mobile-compose-overlay"
            className="fixed inset-0 z-[320] md:hidden flex flex-col justify-end"
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
                onOpen={() => { setCreateError(null) }}
                onReset={resetCompose}
                onSubmit={async () => { await handleCreatePost(); setIsMobileComposeOpen(false) }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen w-full max-w-full bg-zinc-50 dark:bg-bg-app">
        <Header
          myProfile={myProfile}
          displayName={displayName}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          activeView={navActiveView}
          unreadCount={unreadCount}
          bellRingTick={bellRingTick}
          notificationsPanelOpen={notificationsPanelOpen}
          notificationsAnchorRef={notificationsAnchorRef}
          onToggleNotificationsPanel={toggleNotificationsPanel}
          onCloseNotificationsPanel={closeNotificationsPanel}
          onNavigateToUser={navigateToUser}
          onNavigateToPost={navigateToPost}
          onNavigateToFeed={() => navigateToMainView('feed')}
          onNavigateToProfile={() => navigateToMainView('profile')}
          onNavigateToEvents={() => navigateToMainView('events')}
          onOpenProfileModal={() => setProfileModalOpen(true)}
          onNavigateToSettings={openSettings}
          onRefreshPosts={() => void fetchPosts()}
        />

        <main
          className={`mx-auto py-4 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-4 ${
            effectiveActiveView === 'feed' || effectiveActiveView === 'events' || effectiveActiveView === 'profile' || effectiveActiveView === 'userProfile'
              ? 'max-w-7xl px-4 lg:px-6'
              : effectiveActiveView === 'settings'
                ? 'max-w-2xl px-4 space-y-0'
                : 'max-w-2xl space-y-3 px-4'
          } ${effectiveActiveView === 'profile' || effectiveActiveView === 'userProfile' ? 'space-y-4' : ''}`}
        >
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
        </main>

        <BottomNav
          activeView={navActiveView}
          setActiveView={(v) => navigateToMainView(v)}
          unreadCount={unreadCount}
          onOpenNotifications={openNotificationsPanel}
          onOpenCompose={() => {
            setCreateError(null)
            setCreateBody('')
            setCreateImageFile(null)
            setIsMobileComposeOpen(true)
          }}
        />
      </div>

      <NotificationPopup
        open={notificationsPanelOpen}
        onClose={closeNotificationsPanel}
        notifications={notifications}
        loading={notificationsLoading}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markAllRead}
        onClearAll={clearAllNotifications}
        onNavigateToPost={navigateToPostFromNotificationsPanel}
        onNavigateToUser={navigateToUserFromNotificationsPanel}
        anchorRef={notificationsAnchorRef}
      />
    </>
    </EventsProvider>
  )
}

export default App
