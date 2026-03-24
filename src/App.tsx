import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { toast } from 'react-hot-toast'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import type { Comment, Post, Profile } from './types'
import Header from './components/Header'
import ProfileModal from './components/ProfileModal'
import FeedView from './components/FeedView'
import ProfileView from './components/ProfileView'
import BottomNav from './components/BottomNav'
import NotificationsView from './components/NotificationsView'
import ComposeBox from './components/ComposeBox'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [activeView, setActiveView] = useState<'feed' | 'profile' | 'notifications'>('feed')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [isMobileComposeOpen, setIsMobileComposeOpen] = useState(false)

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

  const expandedCommentsRef = useRef(expandedComments)
  useEffect(() => { expandedCommentsRef.current = expandedComments }, [expandedComments])

  const postIds = useMemo(
    () => posts.map((p) => p?.id).filter((id): id is string => id !== undefined && id !== null),
    [posts],
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
      .select('id, full_name, avatar_url, bio, major, year_of_study, instagram_url, linkedin_url, banner_url, department')
      .eq('id', userId)
      .single()
    if (data) setMyProfile(data as Profile)
  }, [])

  const fetchLikesForPosts = useCallback(
    async (ids: string[]) => {
      if (!session?.user?.id || ids.length === 0) { setLikesCountByPost({}); setLikedPostIds({}); return }
      const { data } = await supabase.from('likes').select('post_id, user_id').in('post_id', ids)
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
    const { data } = await supabase.from('comments').select('post_id').in('post_id', ids)
    const counts: Record<string, number> = {}
    for (const c of data ?? []) { const k = String(c.post_id); counts[k] = (counts[k] ?? 0) + 1 }
    setCommentsCountByPost(counts)
  }, [])

  const fetchCommentsForPost = useCallback(async (postId: string) => {
    const { data, error } = await supabase
      .from('comments')
      .select('id, post_id, user_id, content, created_at, profiles(id, full_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[fetchCommentsForPost] Błąd zapytania (z jointem profiles):', error)
      const { data: plain, error: plainErr } = await supabase
        .from('comments')
        .select('id, post_id, user_id, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      if (plainErr) {
        console.error('[fetchCommentsForPost] Fallback też się nie powiódł:', plainErr)
        return
      }
      setCommentsByPost((prev) => ({ ...prev, [postId]: (plain ?? []) as unknown as Comment[] }))
      return
    }

    if (data === null) {
      console.warn('[fetchCommentsForPost] data === null dla posta', postId)
      return
    }

    const normalized: Comment[] = data.map((c) => ({
      ...c,
      profiles: Array.isArray(c.profiles)
        ? (c.profiles[0] ?? null)
        : (c.profiles ?? null),
    })) as Comment[]

    setCommentsByPost((prev) => ({ ...prev, [postId]: normalized }))
  }, [])

  const fetchPosts = useCallback(async () => {
    setPostsLoading(true)
    setPostsError(null)
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, department)')
      .order('created_at', { ascending: false })
    if (error) { setPostsError(error.message); setPosts([]); setPostsLoading(false); return }
    const next = (data ?? []) as Post[]
    setPosts(next)
    const ids = next.map((p) => p?.id).filter((id): id is string => id !== undefined)
    await Promise.all([fetchLikesForPosts(ids), fetchCommentsCount(ids)])
    setPostsLoading(false)
  }, [fetchLikesForPosts, fetchCommentsCount])

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    void fetchPosts()
    void fetchMyProfile(session.user.id)
  }, [session, fetchPosts, fetchMyProfile])

  // ── Create post ───────────────────────────────────────────────────────────

  const handleCreatePost = async () => {
    if (createLoading) return
    setCreateError(null)
    const content = createBody.trim()
    if (!content) { setCreateError('Napisz coś zanim opublikujesz.'); return }
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

    const { error } = await supabase.from('posts').insert([{ content, image_url: imageUrl, user_id: userId }])
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
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', session.user.id)
      } else {
        await supabase.from('likes').insert([{ post_id: postId, user_id: session.user.id }])
      }
      setLikeLoadingByPost((p) => ({ ...p, [postId]: false }))
    },
    [session, likeLoadingByPost, likedPostIds],
  )

  // ── Comments ──────────────────────────────────────────────────────────────

  const toggleComments = useCallback(
    async (postId: string) => {
      const next = new Set(expandedComments)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
        await fetchCommentsForPost(postId)
      }
      setExpandedComments(next)
    },
    [expandedComments, fetchCommentsForPost],
  )

  const submitComment = useCallback(
    async (postId: string) => {
      const content = (commentInput[postId] ?? '').trim()
      if (!content || !session?.user?.id || commentSubmitting[postId]) return

      const optimisticComment: Comment = {
        id: Date.now(),
        post_id: postId,
        user_id: session.user.id,
        content,
        created_at: new Date().toISOString(),
        profiles: myProfile,
      }

      setCommentsByPost((p) => ({ ...p, [postId]: [...(p[postId] ?? []), optimisticComment] }))
      setCommentsCountByPost((p) => ({ ...p, [postId]: (p[postId] ?? 0) + 1 }))
      setExpandedComments((prev) => new Set([...prev, postId]))
      setCommentInput((p) => ({ ...p, [postId]: '' }))

      setCommentSubmitting((p) => ({ ...p, [postId]: true }))
      const { error: insertError } = await supabase
        .from('comments')
        .insert([{ post_id: postId, user_id: session.user.id, content }])

      if (!insertError) {
        await fetchCommentsForPost(postId)
      } else {
        console.error('[submitComment] Błąd INSERT:', insertError)
        setCommentsByPost((p) => ({
          ...p,
          [postId]: (p[postId] ?? []).filter((c) => c.id !== optimisticComment.id),
        }))
        setCommentsCountByPost((p) => ({ ...p, [postId]: Math.max(0, (p[postId] ?? 1) - 1) }))
      }
      setCommentSubmitting((p) => ({ ...p, [postId]: false }))
    },
    [commentInput, commentSubmitting, session, myProfile, fetchCommentsForPost],
  )

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeletePost = useCallback(async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) { console.error('[handleDeletePost] Błąd Supabase:', error); return }
    setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)))
    setLikesCountByPost((prev) => { const next = { ...prev }; delete next[postId]; return next })
    setLikedPostIds((prev) => { const next = { ...prev }; delete next[postId]; return next })
    setCommentsCountByPost((prev) => { const next = { ...prev }; delete next[postId]; return next })
    setCommentsByPost((prev) => { const next = { ...prev }; delete next[postId]; return next })
  }, [])

  const handleDeleteComment = useCallback(async (commentId: number, postId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) { console.error('[handleDeleteComment]', error); return }
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId),
    }))
    setCommentsCountByPost((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? 1) - 1),
    }))
  }, [])

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session?.user?.id || postIds.length === 0) return
    const channel = supabase
      .channel('ujverse-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
        void fetchLikesForPosts(postIds)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        const pid = String(payload.new?.post_id)
        const commentAuthorId = String(payload.new?.user_id)
        if (!postIds.includes(pid)) return
        if (commentAuthorId === session?.user?.id) return
        setCommentsCountByPost((p) => ({ ...p, [pid]: (p[pid] ?? 0) + 1 }))
        if (expandedCommentsRef.current.has(pid)) void fetchCommentsForPost(pid)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [session?.user?.id, postIds, fetchLikesForPosts, fetchCommentsForPost])

  useEffect(() => () => { if (heartPopTimeout.current) clearTimeout(heartPopTimeout.current) }, [])

  // ── Auth guard ────────────────────────────────────────────────────────────

  if (!session) return <Auth />

  const displayName = myProfile?.full_name || session.user.email?.split('@')[0] || 'Użytkownik'

  const sharedPostProps = {
    myProfile,
    displayName,
    currentUserId: session.user.id,
    likesCountByPost,
    likedPostIds,
    heartPopPostId,
    commentsCountByPost,
    commentsByPost,
    expandedComments,
    commentInput,
    commentSubmitting,
    onToggleLike: toggleLike,
    onToggleComments: toggleComments,
    onSubmitComment: submitComment,
    onCommentInputChange: (postId: string, value: string) =>
      setCommentInput((p) => ({ ...p, [postId]: value })),
    onDeletePost: handleDeletePost,
    onDeleteComment: handleDeleteComment,
  }

  return (
    <>
      {profileModalOpen && (
        <ProfileModal
          session={session}
          profile={myProfile}
          onClose={() => setProfileModalOpen(false)}
          onSaved={(u) => { setMyProfile(u); void fetchPosts() }}
          onAvatarUpdate={(url) => setMyProfile((prev) => prev ? { ...prev, avatar_url: url } : prev)}
        />
      )}

      <AnimatePresence>
        {isMobileComposeOpen && (
          <motion.div
            key="mobile-compose-overlay"
            className="fixed inset-0 z-50 md:hidden flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="flex-1 bg-black/50"
              onClick={resetCompose}
            />
            <motion.div
              className="bg-white dark:bg-dark-card rounded-t-3xl px-4 pt-3 pb-8 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-gray-700 mx-auto mb-4" />
              <ComposeBox
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

      <div className="min-h-screen bg-slate-100 dark:bg-dark-bg transition-colors duration-200">
        <Header
          myProfile={myProfile}
          displayName={displayName}
          email={session.user.email}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          activeView={activeView}
          onNavigateToFeed={() => setActiveView('feed')}
          onNavigateToProfile={() => setActiveView('profile')}
          onNavigateToNotifications={() => setActiveView('notifications')}
          onOpenProfileModal={() => setProfileModalOpen(true)}
        />

        <main className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-4 space-y-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {activeView === 'feed' && (
                <FeedView
                  {...sharedPostProps}
                  posts={
                    selectedDepartment
                      ? posts.filter((p) => p.profiles?.department === selectedDepartment)
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
                />
              )}

              {activeView === 'profile' && (
                <ProfileView
                  {...sharedPostProps}
                  posts={posts}
                  postsLoading={postsLoading}
                  email={session.user.email}
                  onOpenProfileModal={() => setProfileModalOpen(true)}
                  onBannerUpdate={(url) => setMyProfile((prev) => prev ? { ...prev, banner_url: url } : prev)}
                />
              )}

              {activeView === 'notifications' && (
                <NotificationsView />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <BottomNav
          activeView={activeView}
          setActiveView={setActiveView}
          onOpenCompose={() => {
            setCreateError(null)
            setCreateBody('')
            setCreateImageFile(null)
            setIsMobileComposeOpen(true)
          }}
        />
      </div>
    </>
  )
}

export default App
