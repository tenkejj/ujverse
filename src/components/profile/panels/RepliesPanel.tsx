import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Heart, Image as ImageIcon, MessageCircle, MoreHorizontal, X } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { formatXNumber } from '../../../lib/formatXNumber'
import { supabase } from '../../../supabaseClient'
import { toast } from '../../../lib/appToast'
import EmptyState from '../../EmptyState'
import type { Profile } from '../../../types'
import type { TablesInsert } from '../../../types/database'
import { useProfileData } from '../../../hooks/useProfileData'

type ThreadAuthor = {
  display_name: string
  handle: string | null
  avatar_url: string | null
}

type ThreadStats = {
  likes_count: number
  comments_count: number
  views_count: number
  reposts_count: number
}

type ThreadInteractions = {
  has_liked: boolean
  has_reposted: boolean
}

type ThreadNode = {
  id: string
  created_at: string
  content: string | null
  media_url?: string | null
  media_urls?: string[] | null
  attachments?: unknown[] | null
  author: ThreadAuthor
  stats: ThreadStats
  user_interactions: ThreadInteractions
}

export type ReplyThread = {
  id: number
  post_id: string
  post: ThreadNode
  reply: ThreadNode
}

type Props = {
  replies: ReplyThread[]
  loading: boolean
  isOwn: boolean
  currentUserId: string
  currentUserProfile?: Profile | null
  onNavigateToPost?: (postId: string) => void
}

type EngPatch = {
  likes_count?: number
  comments_count?: number
  has_liked?: boolean
}

type NestedReply = {
  id: number
  content: string | null
  media_url?: string | null
  created_at: string
  user_id: string
  author: ThreadAuthor
}

type NestedReplyRow = {
  id: number
  content: string | null
  media_url?: string | null
  created_at: string
  user_id: string
  profiles?: {
    full_name?: string | null
    username?: string | null
    avatar_url?: string | null
  } | { full_name?: string | null; username?: string | null; avatar_url?: string | null }[] | null
}

type PostLikeInsert = TablesInsert<'likes'>
type CommentLikeInsert = TablesInsert<'comment_likes'>
type CommentReplyInsert = TablesInsert<'comment_replies'>

type SelectedReplyMedia = {
  file: File
  previewUrl: string
  fileName: string
}

type LikeTarget =
  | {
      kind: 'post'
      id: string
      fallbackLiked: boolean
      fallbackCount: number
    }
  | {
      kind: 'comment'
      id: string
      fallbackLiked: boolean
      fallbackCount: number
    }

type ActiveReplyTarget = {
  threadRowId: number
  threadCommentId: string
  targetType: 'post' | 'reply' | 'nested'
  targetId: string
  targetHandle: string | null
  targetKey: string
}

type ThreadRenderItem =
  | { kind: 'post'; id: string }
  | { kind: 'reply'; id: string }
  | { kind: 'nested'; id: string; nested: NestedReply }
  | { kind: 'composer'; id: string; threadCommentId: string; draftKey: string }

const REPLY_DRAFTS_STORAGE_KEY = 'ujverse.repliesPanel.draftsByTarget.v1'

export default function RepliesPanel({
  replies,
  loading,
  isOwn,
  currentUserId,
  currentUserProfile,
  onNavigateToPost,
}: Props) {
  const navigate = useNavigate()
  const [postPatch, setPostPatch] = useState<Record<string, EngPatch>>({})
  const [replyPatch, setReplyPatch] = useState<Record<string, EngPatch>>({})
  const [postLikePending, setPostLikePending] = useState<Record<string, boolean>>({})
  const [replyLikePending, setReplyLikePending] = useState<Record<string, boolean>>({})
  const [draftsByTarget, setDraftsByTarget] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem(REPLY_DRAFTS_STORAGE_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as unknown
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
    } catch {
      return {}
    }
  })
  const [selectedMediaByComment, setSelectedMediaByComment] = useState<
    Record<string, SelectedReplyMedia | null>
  >({})
  const [replySubmittingByComment, setReplySubmittingByComment] = useState<Record<string, boolean>>({})
  const [activeReplyTarget, setActiveReplyTarget] = useState<ActiveReplyTarget | null>(null)
  const [threadRepliesByComment, setThreadRepliesByComment] = useState<Record<string, NestedReply[]>>({})
  const activeThreadCommentIdRef = useRef<string | null>(null)

  const postIdSetRef = useRef<Set<string>>(new Set())
  const commentIdSetRef = useRef<Set<string>>(new Set())
  const refreshDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const mediaInputByCommentRef = useRef<Record<string, HTMLInputElement | null>>({})
  const composerTextareaByCommentRef = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const { profile: composerProfile, loading: composerProfileLoading } = useProfileData({
    userId: currentUserId,
    initialProfile: currentUserProfile ?? null,
  })
  const composerUserId = composerProfile?.id ?? null
  const composerAvatar = composerProfile?.avatar_url ?? null
  const composerHandle = composerProfile?.username?.trim().replace(/^@+/, '') || null
  const composerDisplayName = composerProfile?.full_name?.trim() || (composerHandle ? `@${composerHandle}` : 'Ty')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(REPLY_DRAFTS_STORAGE_KEY, JSON.stringify(draftsByTarget))
    } catch {
      /* noop */
    }
  }, [draftsByTarget])

  const deleteDraftEntry = useCallback((draftKey: string) => {
    setDraftsByTarget((prev) => {
      if (!(draftKey in prev)) return prev
      const next = { ...prev }
      delete next[draftKey]
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(REPLY_DRAFTS_STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* noop */
        }
      }
      return next
    })
  }, [])

  const focusComposerInput = useCallback((threadCommentId: string) => {
    const focusNow = () => {
      const el = composerTextareaByCommentRef.current[threadCommentId]
      if (!el) return false
      el.focus({ preventScroll: true })
      return true
    }
    if (focusNow()) return
    window.setTimeout(() => {
      if (focusNow()) return
      window.setTimeout(() => {
        focusNow()
      }, 120)
    }, 0)
  }, [])

  useEffect(() => {
    postIdSetRef.current = new Set(replies.map((r) => r.post_id))
    commentIdSetRef.current = new Set(replies.map((r) => String(r.reply.id)))
  }, [replies])

  useEffect(() => {
    const activeThreadCommentId = activeReplyTarget?.threadCommentId ?? null
    activeThreadCommentIdRef.current = activeThreadCommentId
    setThreadRepliesByComment((prev) => {
      if (!activeThreadCommentId) return {}
      if (!(activeThreadCommentId in prev)) return {}
      const activeReplies = prev[activeThreadCommentId] ?? []
      return { [activeThreadCommentId]: activeReplies }
    })
  }, [activeReplyTarget?.threadCommentId])

  const navigateToPost = (postId: string) => {
    if (onNavigateToPost) {
      onNavigateToPost(postId)
      return
    }
    navigate(`/post/${postId}`)
  }

  const avatarBase =
    'rounded-full shrink-0 relative border border-zinc-200 bg-zinc-100 object-cover object-center dark:border-white/10 dark:bg-zinc-900'

  const renderAvatar = (
    avatarUrl: string | null | undefined,
    fallback: string,
    sizeClass: 'w-10 h-10' | 'w-8 h-8' = 'w-10 h-10',
  ) => {
    const first = fallback.trim().charAt(0).toUpperCase() || '?'
    return avatarUrl ? (
      <img src={avatarUrl} alt={fallback} className={`${avatarBase} ${sizeClass}`} loading="lazy" />
    ) : (
      <div
        className={`${avatarBase} ${sizeClass} flex items-center justify-center text-sm font-bold text-(--profile-accent)`}
      >
        {first}
      </div>
    )
  }

  const toMediaUrls = (value: unknown): string[] => {
    if (!value) return []
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return []
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed) as unknown
          return toMediaUrls(parsed)
        } catch {
          return [trimmed]
        }
      }
      return [trimmed]
    }
    if (Array.isArray(value)) {
      return value
        .flatMap((item) => {
          if (!item) return []
          if (typeof item === 'string') return [item]
          if (typeof item === 'object') {
            const candidate =
              (item as { url?: unknown; src?: unknown; path?: unknown }).url ??
              (item as { url?: unknown; src?: unknown; path?: unknown }).src ??
              (item as { url?: unknown; src?: unknown; path?: unknown }).path
            return typeof candidate === 'string' ? [candidate] : []
          }
          return []
        })
        .map((url) => url.trim())
        .filter(Boolean)
    }
    return []
  }

  const mediaForRow = (row: {
    image_url?: unknown
    media_urls?: unknown
    attachments?: unknown
  }): string[] => {
    const merged = [
      ...toMediaUrls(row.image_url),
      ...toMediaUrls(row.media_urls),
      ...toMediaUrls(row.attachments),
    ]
    return Array.from(new Set(merged))
  }

  const displayHandle = (value: string | null | undefined) => {
    const h = value?.trim()
    if (!h) return null
    return h.replace(/^@+/, '')
  }

  const formatRelativeTimestamp = (value: string | null | undefined) => {
    if (!value) return '1m'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '1m'
    const strict = formatDistanceToNowStrict(date, { addSuffix: false })
    const [amountRaw, unitRaw] = strict.split(' ')
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount)) return '1m'
    const unit = unitRaw.toLowerCase()
    if (unit.startsWith('second')) return '1m'
    if (unit.startsWith('minute')) return `${amount}m`
    if (unit.startsWith('hour')) return `${amount}h`
    if (unit.startsWith('day')) return `${amount}d`
    if (unit.startsWith('month')) return `${amount}mo`
    if (unit.startsWith('year')) return `${amount}y`
    return '1m'
  }

  const normalizeProfileHandle = useCallback(
    (value: string | null | undefined) => value?.trim().replace(/^@+/, '') || null,
    [],
  )

  const toThreadAuthor = useCallback(
    (
      profile: { full_name?: string | null; username?: string | null; avatar_url?: string | null } | null | undefined,
      userId: string | null | undefined,
    ): ThreadAuthor => {
      const handle = normalizeProfileHandle(profile?.username)
      const displayName = profile?.full_name?.trim() || handle || (userId?.trim().slice(0, 8) ?? '')
      return {
        display_name: displayName,
        handle,
        avatar_url: profile?.avatar_url ?? null,
      }
    },
    [normalizeProfileHandle],
  )

  const sortNestedReplies = useCallback((items: NestedReply[]) => {
    return [...items].sort((a, b) => {
      const aMs = new Date(a.created_at).getTime()
      const bMs = new Date(b.created_at).getTime()
      if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return 0
      return aMs - bMs
    })
  }, [])

  const fetchThreadReplies = useCallback(async (commentId: string) => {
    const commentNum = Number(commentId)
    if (!Number.isFinite(commentNum)) return
    const shouldStoreForThread = () => activeThreadCommentIdRef.current === commentId

    const { data, error } = await supabase
      .from('comment_replies')
      .select(
        'id, parent_comment_id, post_id, user_id, content, media_url, created_at, profiles:user_id(id, full_name, username, avatar_url)',
      )
      .eq('parent_comment_id', commentNum)
      .order('created_at', { ascending: true })

    if (error) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('comment_replies')
        .select('id, parent_comment_id, post_id, user_id, content, media_url, created_at')
        .eq('parent_comment_id', commentNum)
        .order('created_at', { ascending: true })
      if (fallbackError) return
      const fallbackRows = ((fallback ?? []) as unknown as NestedReplyRow[]).filter((item) => Boolean(item.user_id))
      const profileIds = Array.from(new Set(fallbackRows.map((item) => item.user_id).filter(Boolean)))
      let profilesById: Record<string, { full_name?: string | null; username?: string | null; avatar_url?: string | null }> =
        {}

      if (profileIds.length) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', profileIds)
        profilesById = Object.fromEntries(
          (profileRows ?? []).map((profile) => [
            String(profile.id),
            {
              full_name: profile.full_name,
              username: profile.username,
              avatar_url: profile.avatar_url,
            },
          ]),
        )
      }

      const normalizedFallback = sortNestedReplies(fallbackRows.map((item) => ({
        id: item.id,
        content: item.content,
        media_url: item.media_url ?? null,
        created_at: item.created_at,
        user_id: item.user_id,
        author: toThreadAuthor(profilesById[item.user_id] ?? null, item.user_id),
      })))
      if (!shouldStoreForThread()) return
      setThreadRepliesByComment((prev) => ({ ...prev, [commentId]: normalizedFallback }))
      return
    }

    const normalized = sortNestedReplies(((data ?? []) as unknown as NestedReplyRow[]).map((item) => {
      const joined = Array.isArray(item.profiles) ? (item.profiles[0] ?? null) : (item.profiles ?? null)
      return {
        id: item.id,
        content: item.content,
        media_url: item.media_url ?? null,
        created_at: item.created_at,
        user_id: item.user_id,
        author: toThreadAuthor(joined, item.user_id),
      }
    }))
    if (!shouldStoreForThread()) return
    setThreadRepliesByComment((prev) => ({ ...prev, [commentId]: normalized }))
  }, [sortNestedReplies, toThreadAuthor])

  const handleToggleLike = useCallback(
    async (target: LikeTarget, userId: string) => {
      if (!userId) return
      const numericId = Number(target.id)
      if (!Number.isFinite(numericId)) return

      const isPost = target.kind === 'post'
      const pending = isPost ? postLikePending[target.id] : replyLikePending[target.id]
      if (pending) return

      const optimisticLiked = !target.fallbackLiked
      const optimisticCount = Math.max(
        0,
        target.fallbackLiked ? target.fallbackCount - 1 : target.fallbackCount + 1,
      )

      if (isPost) {
        setPostPatch((prev) => ({
          ...prev,
          [target.id]: {
            ...prev[target.id],
            has_liked: optimisticLiked,
            likes_count: optimisticCount,
          },
        }))
        setPostLikePending((prev) => ({ ...prev, [target.id]: true }))
      } else {
        setReplyPatch((prev) => ({
          ...prev,
          [target.id]: {
            ...prev[target.id],
            has_liked: optimisticLiked,
            likes_count: optimisticCount,
          },
        }))
        setReplyLikePending((prev) => ({ ...prev, [target.id]: true }))
      }

      try {
        if (isPost) {
          const { data: existing, error: selErr } = await supabase
            .from('likes')
            .select('post_id')
            .eq('post_id', numericId)
            .eq('user_id', userId)
            .maybeSingle()

          if (selErr) throw selErr

          if (existing) {
            const { error } = await supabase
              .from('likes')
              .delete()
              .eq('post_id', numericId)
              .eq('user_id', userId)
            if (error) throw error
          } else {
            const { error } = await supabase
              .from('likes')
              .insert([{ post_id: numericId, user_id: userId } satisfies PostLikeInsert])
            if (error) throw error
          }
        } else {
          const { data: existing, error: selErr } = await supabase
            .from('comment_likes')
            .select('comment_id')
            .eq('comment_id', numericId)
            .eq('user_id', userId)
            .maybeSingle()

          if (selErr) throw selErr

          if (existing) {
            const { error } = await supabase
              .from('comment_likes')
              .delete()
              .eq('comment_id', numericId)
              .eq('user_id', userId)
            if (error) throw error
          } else {
            const { error } = await supabase
              .from('comment_likes')
              .insert([{ comment_id: numericId, user_id: userId } satisfies CommentLikeInsert])
            if (error) throw error
          }
        }
      } catch {
        if (isPost) {
          setPostPatch((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              has_liked: target.fallbackLiked,
              likes_count: target.fallbackCount,
            },
          }))
        } else {
          setReplyPatch((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              has_liked: target.fallbackLiked,
              likes_count: target.fallbackCount,
            },
          }))
        }
        toast.error(
          isPost
            ? 'Nie udało się zaktualizować polubień wpisu.'
            : 'Nie udało się zaktualizować polubień odpowiedzi.',
        )
      } finally {
        if (isPost) {
          setPostLikePending((prev) => ({ ...prev, [target.id]: false }))
        } else {
          setReplyLikePending((prev) => ({ ...prev, [target.id]: false }))
        }
      }
    },
    [postLikePending, replyLikePending],
  )

  const refreshPostEngagement = useCallback(
    async (postId: string) => {
      const n = Number(postId)
      if (!Number.isFinite(n)) return

      const [likesQ, commentsQ, myLikeQ] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', n),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', n),
        supabase
          .from('likes')
          .select('post_id')
          .eq('post_id', n)
          .eq('user_id', currentUserId)
          .maybeSingle(),
      ])

      if (likesQ.error || commentsQ.error) {
        if (likesQ.error) console.error('[RepliesPanel] refreshPost likes', likesQ.error)
        if (commentsQ.error) console.error('[RepliesPanel] refreshPost comments', commentsQ.error)
        return
      }

      setPostPatch((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          likes_count: likesQ.count ?? 0,
          comments_count: commentsQ.count ?? 0,
          has_liked: Boolean(myLikeQ.data),
        },
      }))
    },
    [currentUserId],
  )

  const refreshCommentEngagement = useCallback(
    async (commentId: string) => {
      const n = Number(commentId)
      if (!Number.isFinite(n)) return

      const [likesQ, myLikeQ] = await Promise.all([
        supabase
          .from('comment_likes')
          .select('*', { count: 'exact', head: true })
          .eq('comment_id', n),
        supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('comment_id', n)
          .eq('user_id', currentUserId)
          .maybeSingle(),
      ])

      if (likesQ.error) {
        if (String(likesQ.error.message).includes('relation') || String(likesQ.error.code) === '42P01') {
          return
        }
        console.error('[RepliesPanel] refreshComment', likesQ.error)
        return
      }

      setReplyPatch((prev) => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          likes_count: likesQ.count ?? 0,
          has_liked: Boolean(myLikeQ.data),
        },
      }))
    },
    [currentUserId],
  )

  const schedulePostRefresh = useCallback(
    (postId: string) => {
      const t = refreshDebounce.current[postId]
      if (t) clearTimeout(t)
      refreshDebounce.current[postId] = setTimeout(() => {
        void refreshPostEngagement(postId)
        delete refreshDebounce.current[postId]
      }, 50)
    },
    [refreshPostEngagement],
  )

  const scheduleCommentRefresh = useCallback(
    (commentId: string) => {
      const t = refreshDebounce.current[`c-${commentId}`]
      if (t) clearTimeout(t)
      refreshDebounce.current[`c-${commentId}`] = setTimeout(() => {
        void refreshCommentEngagement(commentId)
        delete refreshDebounce.current[`c-${commentId}`]
      }, 50)
    },
    [refreshCommentEngagement],
  )

  const postIdsKey = useMemo(
    () => Array.from(new Set(replies.map((r) => r.post_id).filter(Boolean))).sort().join(','),
    [replies],
  )
  const commentIdsKey = useMemo(
    () => Array.from(new Set(replies.map((r) => String(r.reply.id)).filter(Boolean)))
      .sort()
      .join(','),
    [replies],
  )

  useEffect(() => {
    if (!postIdsKey) return
    for (const pid of postIdsKey.split(',')) {
      if (pid) void refreshPostEngagement(pid)
    }
  }, [postIdsKey, refreshPostEngagement])

  useEffect(() => {
    if (!commentIdsKey) return
    for (const cid of commentIdsKey.split(',')) {
      if (cid) void refreshCommentEngagement(cid)
    }
  }, [commentIdsKey, refreshCommentEngagement])

  useEffect(() => {
    if (!replies.length) return

    const ch = supabase
      .channel('replies-panel-likes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, (payload) => {
        const pid = String(
          (payload.new as { post_id?: number } | null)?.post_id ??
            (payload.old as { post_id?: number } | null)?.post_id ??
            '',
        )
        if (!pid || !postIdSetRef.current.has(pid)) return
        schedulePostRefresh(pid)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
        const pid = String(
          (payload.new as { post_id?: number } | null)?.post_id ??
            (payload.old as { post_id?: number } | null)?.post_id ??
            '',
        )
        if (!pid || !postIdSetRef.current.has(pid)) return
        schedulePostRefresh(pid)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, (payload) => {
        const cid = String(
          (payload.new as { comment_id?: number } | null)?.comment_id ??
            (payload.old as { comment_id?: number } | null)?.comment_id ??
            '',
        )
        if (!cid || !commentIdSetRef.current.has(cid)) return
        scheduleCommentRefresh(cid)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_replies' }, (payload) => {
        const cid = String(
          (payload.new as { parent_comment_id?: number } | null)?.parent_comment_id ??
            (payload.old as { parent_comment_id?: number } | null)?.parent_comment_id ??
            '',
        )
        if (!cid || !commentIdSetRef.current.has(cid)) return
        scheduleCommentRefresh(cid)
        void fetchThreadReplies(cid)
      })
      .subscribe()
    const refreshDebounceSnapshot = refreshDebounce.current

    return () => {
      for (const k of Object.keys(refreshDebounceSnapshot)) {
        if (refreshDebounceSnapshot[k]) clearTimeout(refreshDebounceSnapshot[k])
      }
      void supabase.removeChannel(ch)
    }
  }, [replies.length, postIdsKey, commentIdsKey, schedulePostRefresh, scheduleCommentRefresh, fetchThreadReplies])

  const onOpenCommentUi = (
    e: React.MouseEvent,
    row: ReplyThread,
    target: Omit<ActiveReplyTarget, 'threadCommentId' | 'threadRowId'>,
  ) => {
    e.stopPropagation()
    const commentId = String(row.reply.id)
    const isSameTarget =
      activeReplyTarget?.threadRowId === row.id &&
      activeReplyTarget?.threadCommentId === commentId &&
      activeReplyTarget.targetKey === target.targetKey
    if (isSameTarget) {
      activeThreadCommentIdRef.current = null
      setActiveReplyTarget(null)
      return
    }
    activeThreadCommentIdRef.current = commentId
    setActiveReplyTarget({
      threadRowId: row.id,
      threadCommentId: commentId,
      targetType: target.targetType,
      targetId: target.targetId,
      targetHandle: target.targetHandle,
      targetKey: target.targetKey,
    })
    focusComposerInput(commentId)
    void fetchThreadReplies(commentId)
  }

  const handleCreateNestedReply = useCallback(
    async (row: ReplyThread, threadCommentId: string, draftKey: string) => {
      if (!composerUserId || !composerProfile) {
        toast.error('Zaloguj się, aby dodać odpowiedź.')
        return
      }
      const commentId = threadCommentId
      const postId = String(row.post_id ?? '').trim()
      const activeParentId =
        activeReplyTarget?.threadRowId === row.id &&
        activeReplyTarget.threadCommentId === threadCommentId
          ? Number(activeReplyTarget.targetId)
          : Number(commentId)
      const parentCommentId = Number.isFinite(activeParentId) ? activeParentId : Number(commentId)
      const rawDraft = draftsByTarget[draftKey] ?? ''
      const content = rawDraft.trim()
      const selectedMedia = selectedMediaByComment[commentId] ?? null

      if (replySubmittingByComment[commentId]) return
      if (!content && !selectedMedia) return
      if (!Number.isFinite(parentCommentId)) return

      const optimisticId = Date.now()
      const optimisticPreview = selectedMedia?.previewUrl ?? null
      const optimisticReply: NestedReply = {
        id: optimisticId,
        content: content || null,
        media_url: optimisticPreview,
        created_at: new Date().toISOString(),
        user_id: composerUserId,
        author: {
          display_name:
            composerProfile?.full_name?.trim() ||
            composerProfile?.username?.trim() ||
            currentUserProfile?.full_name?.trim() ||
            currentUserProfile?.username?.trim() ||
            composerUserId.slice(0, 8),
          handle: normalizeProfileHandle(composerProfile?.username ?? currentUserProfile?.username ?? null),
          avatar_url: composerAvatar,
        },
      }

      setThreadRepliesByComment((prev) => ({
        ...prev,
        [commentId]: sortNestedReplies([...(prev[commentId] ?? []), optimisticReply]),
      }))
      setReplyPatch((prev) => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          comments_count: Math.max(0, (prev[commentId]?.comments_count ?? row.reply.stats.comments_count) + 1),
        },
      }))
      setSelectedMediaByComment((prev) => ({ ...prev, [commentId]: null }))
      setReplySubmittingByComment((prev) => ({ ...prev, [commentId]: true }))

      const rollback = () => {
        setThreadRepliesByComment((prev) => ({
          ...prev,
          [commentId]: (prev[commentId] ?? []).filter((item) => item.id !== optimisticId),
        }))
        setReplyPatch((prev) => ({
          ...prev,
          [commentId]: {
            ...prev[commentId],
            comments_count: Math.max(0, (prev[commentId]?.comments_count ?? row.reply.stats.comments_count) - 1),
          },
        }))
        setDraftsByTarget((prev) => ({ ...prev, [draftKey]: rawDraft }))
        if (selectedMedia) {
          setSelectedMediaByComment((prev) => ({ ...prev, [commentId]: selectedMedia }))
        }
      }

      let uploadedMediaUrl: string | null = null
      if (selectedMedia) {
        const safeName = selectedMedia.fileName.replace(/[^\w.-]/g, '_')
        const uploadPath = `comment_replies/${composerUserId}/${Date.now()}-${safeName}`
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('media')
          .upload(uploadPath, selectedMedia.file, {
            contentType: selectedMedia.file.type || 'image/jpeg',
            upsert: false,
          })

        if (uploadError || !uploadData?.path) {
          rollback()
          setReplySubmittingByComment((prev) => ({ ...prev, [commentId]: false }))
          toast.error('Nie udało się przesłać obrazu.')
          return
        }

        uploadedMediaUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl
      }

      const { data, error } = await supabase
        .from('comment_replies')
        .insert([
          {
            parent_comment_id: parentCommentId,
            post_id: postId,
            user_id: composerUserId,
            content: content || null,
            media_url: uploadedMediaUrl,
          } satisfies CommentReplyInsert,
        ])
        .select('id')
        .single()

      if (error) {
        rollback()
        toast.error('Nie udało się dodać odpowiedzi.')
      } else if (data?.id != null) {
        deleteDraftEntry(draftKey)
        setThreadRepliesByComment((prev) => ({
          ...prev,
          [commentId]: sortNestedReplies(
            (prev[commentId] ?? []).map((item) =>
              item.id === optimisticId
                ? { ...item, id: Number(data.id), media_url: uploadedMediaUrl ?? item.media_url }
                : item,
            ),
          ),
        }))
        if (optimisticPreview) {
          try {
            URL.revokeObjectURL(optimisticPreview)
          } catch {
            /* noop */
          }
        }
      }

      setReplySubmittingByComment((prev) => ({ ...prev, [commentId]: false }))
    },
    [
      composerUserId,
      composerProfile,
      composerAvatar,
      currentUserProfile,
      activeReplyTarget,
      normalizeProfileHandle,
      draftsByTarget,
      deleteDraftEntry,
      replySubmittingByComment,
      selectedMediaByComment,
      sortNestedReplies,
    ],
  )

  const onTogglePostLike = (e: React.MouseEvent, row: ReplyThread) => {
    e.stopPropagation()
    if (!currentUserId) {
      toast.error('Zaloguj się, aby polubić wpis.')
      return
    }
    const postId = row.post_id
    const p = postPatch[postId]
    const wasLikedBefore = p?.has_liked ?? row.post.user_interactions.has_liked
    const prevCountBefore = p?.likes_count ?? row.post.stats.likes_count
    void handleToggleLike(
      { kind: 'post', id: postId, fallbackLiked: wasLikedBefore, fallbackCount: prevCountBefore },
      currentUserId,
    )
  }

  const onToggleReplyLike = (e: React.MouseEvent, row: ReplyThread) => {
    e.stopPropagation()
    if (!currentUserId) {
      toast.error('Zaloguj się, aby polubić odpowiedź.')
      return
    }
    const commentId = String(row.reply.id)
    const p = replyPatch[commentId]
    const wasLikedBefore = p?.has_liked ?? row.reply.user_interactions.has_liked
    const prevCountBefore = p?.likes_count ?? row.reply.stats.likes_count
    void handleToggleLike(
      { kind: 'comment', id: commentId, fallbackLiked: wasLikedBefore, fallbackCount: prevCountBefore },
      currentUserId,
    )
  }

  const selectReplyMedia = (commentId: string, file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Wybierz plik obrazu.')
      return
    }

    setSelectedMediaByComment((prev) => {
      const previous = prev[commentId]
      if (previous?.previewUrl) {
        try {
          URL.revokeObjectURL(previous.previewUrl)
        } catch {
          /* noop */
        }
      }
      return {
        ...prev,
        [commentId]: {
          file,
          previewUrl: URL.createObjectURL(file),
          fileName: file.name,
        },
      }
    })
  }

  const clearSelectedMedia = useCallback((commentId: string) => {
    setSelectedMediaByComment((prev) => {
      const previous = prev[commentId]
      if (previous?.previewUrl) {
        try {
          URL.revokeObjectURL(previous.previewUrl)
        } catch {
          /* noop */
        }
      }
      return { ...prev, [commentId]: null }
    })
  }, [])

  useEffect(() => {
    return () => {
      const snapshot = selectedMediaByComment
      for (const key of Object.keys(snapshot)) {
        const url = snapshot[key]?.previewUrl
        if (url) {
          try {
            URL.revokeObjectURL(url)
          } catch {
            /* noop */
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderMedia = (media: string[]) => {
    if (!media.length) return null
    if (media.length === 1) {
      return (
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden mt-3">
          <img
            src={media[0]}
            alt=""
            loading="lazy"
            className="w-full max-h-[420px] object-contain"
          />
        </div>
      )
    }

    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {media.slice(0, 4).map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden"
          >
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-40 w-full object-cover"
            />
          </div>
        ))}
      </div>
    )
  }

  type CommentItemProps = {
    showActions?: boolean
    replyToLabel?: React.ReactNode
    commentsActive?: boolean
    authorDisplay: string
    handleLabel: string | null
    timestamp: string
    profileHref: string | null
    avatarUrl: string | null
    avatarFallback: string
    content: string | null
    media: string[]
    commentsCount: number
    likesCount: number
    isLiked: boolean
    likeDisabled?: boolean
    onCommentClick: (e: React.MouseEvent) => void
    onLikeClick: (e: React.MouseEvent) => void
    trailing?: React.ReactNode
    railBottom?: boolean
  }

  const CommentItem = ({
    showActions = true,
    authorDisplay,
    handleLabel,
    timestamp,
    profileHref,
    avatarUrl,
    avatarFallback,
    content,
    media,
    commentsCount,
    likesCount,
    isLiked,
    likeDisabled,
    onCommentClick,
    onLikeClick,
    trailing,
    replyToLabel,
    commentsActive = false,
    railBottom = false,
  }: CommentItemProps) => {
    return (
      <div className="grid grid-cols-[48px_1fr] gap-x-3 w-full">
        <div className="relative flex items-start justify-center">
          {railBottom ? (
            <span className="pointer-events-none absolute left-1/2 top-10 -bottom-3 w-[2px] -translate-x-1/2 bg-zinc-200 dark:bg-zinc-800" />
          ) : null}
          {profileHref ? (
            <Link
              to={profileHref}
              className="relative z-10 inline-flex w-10 h-10 rounded-full shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {renderAvatar(avatarUrl, avatarFallback, 'w-10 h-10')}
            </Link>
          ) : (
            <div className="relative z-10">{renderAvatar(avatarUrl, avatarFallback, 'w-10 h-10')}</div>
          )}
        </div>
        <div className="min-w-0 flex flex-col space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[15px] flex items-center min-w-0 overflow-hidden">
              {profileHref ? (
                <Link
                  to={profileHref}
                  className="font-bold text-zinc-900 dark:text-zinc-100 hover:underline truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {authorDisplay}
                </Link>
              ) : (
                <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{authorDisplay}</p>
              )}
              {handleLabel ? (
                <span className="text-zinc-500 dark:text-zinc-400 ml-1 truncate">{handleLabel}</span>
              ) : null}
              <span className="text-zinc-500 dark:text-zinc-400 ml-1">·</span>
              <span className="text-zinc-500 dark:text-zinc-400 ml-1">{timestamp}</span>
            </div>
            <button
              type="button"
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="Więcej opcji"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
          {replyToLabel ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{replyToLabel}</p>
          ) : null}
          {content ? (
            <p className="whitespace-pre-line text-[15px] text-zinc-900 dark:text-zinc-100 leading-normal">
              {content}
            </p>
          ) : null}
          {renderMedia(media)}
          {showActions ? (
            <div className="flex items-center gap-x-10 mt-3 text-zinc-500 dark:text-zinc-400 text-[13px]">
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 transition-colors ${
                  commentsActive
                    ? 'text-brand-gold-bright'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-brand-gold-bright/90'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  onCommentClick(e)
                }}
                aria-label="Komentarze"
              >
                <MessageCircle size={18} />
                <span className={commentsActive ? 'text-brand-gold-bright' : undefined}>
                  {formatXNumber(commentsCount)}
                </span>
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 transition-colors ${
                  isLiked
                    ? 'text-brand-gold-bright'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-brand-gold-bright/90'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  onLikeClick(e)
                }}
                aria-label="Polubienia"
                disabled={likeDisabled}
              >
                <Heart size={18} className={isLiked ? 'fill-current' : undefined} />
                <span className={isLiked ? 'text-brand-gold-bright' : undefined}>
                  {formatXNumber(likesCount)}
                </span>
              </button>
            </div>
          ) : null}
          {trailing}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-(--profile-accent) border-t-transparent" />
      </div>
    )
  }

  if (replies.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Brak odpowiedzi"
        subtitle={
          isOwn
            ? 'Komentarze przy wpisach innych osób pojawią się tutaj.'
            : 'Ten użytkownik nie dodał jeszcze komentarzy.'
        }
      />
    )
  }

  return (
    <ul className="space-y-3">
      {replies.map((row) => {
        const replyContent = row.reply.content?.trim() || '(brak treści komentarza)'
        const preview = row.post.content?.trim() || '(wpis usunięty lub niedostępny)'
        const originalMedia = mediaForRow({
          image_url: row.post.media_url,
          media_urls: row.post.media_urls,
          attachments: row.post.attachments,
        })
        const replyMedia = mediaForRow({
          image_url: row.reply.media_url,
          media_urls: row.reply.media_urls,
          attachments: row.reply.attachments,
        })
        const postIdKey = row.post_id
        const postEng = postPatch[postIdKey]
        const replyIdKey = String(row.reply.id)
        const replyEng = replyPatch[replyIdKey]
        const postCommentsCount = postEng?.comments_count ?? row.post.stats.comments_count
        const postLikesCount = postEng?.likes_count ?? row.post.stats.likes_count
        const postIsLiked = postEng?.has_liked ?? row.post.user_interactions.has_liked
        const replyCommentsCount = replyEng?.comments_count ?? row.reply.stats.comments_count
        const replyLikesCount = replyEng?.likes_count ?? row.reply.stats.likes_count
        const replyIsLiked = replyEng?.has_liked ?? row.reply.user_interactions.has_liked
        const postAuthorDisplay = row.post.author.display_name
        const postHandleLabel = displayHandle(row.post.author.handle)
        const replyAuthorDisplay = row.reply.author.display_name
        const replyHandleLabel = displayHandle(row.reply.author.handle)
        const postTimestamp = formatRelativeTimestamp(row.post.created_at)
        const replyTimestamp = formatRelativeTimestamp(row.reply.created_at)
        const threadPostId = row.post.id || row.post_id
        const postHandleForUrl = row.post.author.handle?.trim().replace(/^@+/, '') ?? ''
        const replyHandleForUrl = row.reply.author.handle?.trim().replace(/^@+/, '') ?? ''
        const originalProfileHref = postHandleForUrl ? `/profile/${postHandleForUrl}` : null
        const replyProfileHref = replyHandleForUrl ? `/profile/${replyHandleForUrl}` : null
        const renderReplyToLabel = (targetHandle: string | null) => {
          if (!targetHandle) return null
          return (
            <>
              W odpowiedzi do{' '}
              <Link
                to={`/profile/${targetHandle}`}
                className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                @{targetHandle}
              </Link>
            </>
          )
        }
        const replyToParent = renderReplyToLabel(postHandleLabel)
        const replyToReply = renderReplyToLabel(replyHandleLabel) ?? replyToParent
        const isThreadActive =
          activeReplyTarget?.threadRowId === row.id &&
          activeReplyTarget?.threadCommentId === replyIdKey
        const nestedReplies = isThreadActive
          ? sortNestedReplies(threadRepliesByComment[replyIdKey] ?? [])
          : []
        const selectedMedia = selectedMediaByComment[replyIdKey] ?? null
        const isSubmitting = Boolean(replySubmittingByComment[replyIdKey])
        const handleCardClick = () => {
          if (!threadPostId) return
          navigateToPost(String(threadPostId))
        }
        const rowClass = 'px-4 py-3 hover:bg-zinc-100/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer'
        const composerClass = 'px-4 py-3'

        const baseItems: ThreadRenderItem[] = [
          { kind: 'post', id: `t-${replyIdKey}-post` },
          { kind: 'reply', id: `t-${replyIdKey}-reply` },
          ...nestedReplies.map((nested) => ({
            kind: 'nested' as const,
            id: `t-${replyIdKey}-nested-${nested.id}`,
            nested,
          })),
        ]
        const activeDraftKey =
          isThreadActive && activeReplyTarget ? `${replyIdKey}:${activeReplyTarget.targetKey}` : null
        const visibleItems: ThreadRenderItem[] = isThreadActive
          ? [
              ...baseItems,
              {
                kind: 'composer',
                id: `t-${replyIdKey}-composer`,
                threadCommentId: replyIdKey,
                draftKey: activeDraftKey ?? `${replyIdKey}:t-${replyIdKey}-reply`,
              },
            ]
          : baseItems
        const hasNextItem = (index: number) => index < visibleItems.length - 1

        return (
          <motion.li
            key={`t-${replyIdKey}-thread`}
            className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02] overflow-hidden"
            layout
            transition={{ layout: { duration: 0.22, ease: 'easeOut' } }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visibleItems.map((item, index) => {
              if (item.kind === 'post') {
                const commentsActive = isThreadActive && activeReplyTarget?.targetKey === item.id
                return (
                  <div key={item.id} className={rowClass} onClick={handleCardClick}>
                    <CommentItem
                      authorDisplay={postAuthorDisplay}
                      handleLabel={postHandleLabel ? `@${postHandleLabel}` : null}
                      timestamp={postTimestamp}
                      profileHref={originalProfileHref}
                      avatarUrl={row.post.author.avatar_url}
                      avatarFallback={row.post.author.handle || postAuthorDisplay}
                      content={preview}
                      media={originalMedia}
                      commentsCount={postCommentsCount}
                      likesCount={postLikesCount}
                      isLiked={postIsLiked}
                      commentsActive={commentsActive}
                      likeDisabled={postLikePending[postIdKey]}
                      onCommentClick={(e) =>
                        onOpenCommentUi(e, row, {
                          targetType: 'post',
                          targetKey: item.id,
                          targetId: replyIdKey,
                          targetHandle: postHandleLabel,
                        })
                      }
                      onLikeClick={(e) => onTogglePostLike(e, row)}
                      railBottom={hasNextItem(index)}
                    />
                  </div>
                )
              }

              if (item.kind === 'reply') {
                const commentsActive = isThreadActive && activeReplyTarget?.targetKey === item.id
                return (
                  <div key={item.id} className={rowClass} onClick={handleCardClick}>
                    <CommentItem
                      authorDisplay={replyAuthorDisplay}
                      handleLabel={replyHandleLabel ? `@${replyHandleLabel}` : null}
                      replyToLabel={replyToParent}
                      timestamp={replyTimestamp}
                      profileHref={replyProfileHref}
                      avatarUrl={row.reply.author.avatar_url}
                      avatarFallback={row.reply.author.handle || row.reply.author.display_name}
                      content={replyContent}
                      media={replyMedia}
                      commentsCount={replyCommentsCount}
                      likesCount={replyLikesCount}
                      isLiked={replyIsLiked}
                      commentsActive={commentsActive}
                      likeDisabled={replyLikePending[replyIdKey]}
                      onCommentClick={(e) =>
                        onOpenCommentUi(e, row, {
                          targetType: 'reply',
                          targetKey: item.id,
                          targetId: replyIdKey,
                          targetHandle: replyHandleLabel,
                        })
                      }
                      onLikeClick={(e) => onToggleReplyLike(e, row)}
                      railBottom={hasNextItem(index)}
                    />
                  </div>
                )
              }

              if (item.kind === 'nested') {
                const nested = item.nested
                const nestedAuthor = nested.author.display_name
                const nestedHandle = displayHandle(nested.author.handle)
                const nestedProfileHref = nestedHandle ? `/profile/${nestedHandle}` : null
                const nestedMedia = nested.media_url ? [nested.media_url] : []
                const commentsActive = isThreadActive && activeReplyTarget?.targetKey === item.id
                return (
                  <div key={item.id} className={rowClass} onClick={handleCardClick}>
                    <CommentItem
                      authorDisplay={nestedAuthor}
                      handleLabel={nestedHandle ? `@${nestedHandle}` : null}
                      replyToLabel={replyToReply}
                      timestamp={formatRelativeTimestamp(nested.created_at)}
                      profileHref={nestedProfileHref}
                      avatarUrl={nested.author.avatar_url}
                      avatarFallback={nested.author.handle || nestedAuthor}
                      content={nested.content}
                      media={nestedMedia}
                      commentsCount={0}
                      likesCount={0}
                      isLiked={false}
                      commentsActive={commentsActive}
                      onCommentClick={(e) =>
                        onOpenCommentUi(e, row, {
                          targetType: 'nested',
                          targetKey: item.id,
                          targetId: String(nested.id),
                          targetHandle: nestedHandle,
                        })
                      }
                      onLikeClick={(e) => e.stopPropagation()}
                      railBottom={hasNextItem(index)}
                    />
                  </div>
                )
              }

                const inputValue = draftsByTarget[item.draftKey] ?? ''
                const sendDisabled = isSubmitting || (!inputValue.trim() && !selectedMedia)
                return (
                <motion.div
                  key={item.id}
                  className={composerClass}
                  onClick={(e) => e.stopPropagation()}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <div className="grid grid-cols-[48px_1fr] gap-x-3 w-full">
                    <div className="relative flex items-start justify-center">
                      {hasNextItem(index) ? (
                        <span className="pointer-events-none absolute left-1/2 top-10 -bottom-3 w-[2px] -translate-x-1/2 bg-zinc-200 dark:bg-zinc-800" />
                      ) : null}
                      {composerProfileLoading ? (
                        <div
                          className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-white/10 animate-pulse"
                          aria-hidden
                        />
                      ) : composerHandle ? (
                        <Link
                          to={`/profile/${composerHandle}`}
                          className="inline-flex w-10 h-10 rounded-full shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderAvatar(composerAvatar, composerHandle, 'w-10 h-10')}
                        </Link>
                      ) : (
                        renderAvatar(composerAvatar, composerDisplayName, 'w-10 h-10')
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col">
                      {isThreadActive && activeReplyTarget?.targetHandle ? (
                        <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">
                          W odpowiedzi do @{activeReplyTarget.targetHandle}
                        </p>
                      ) : null}
                      <textarea
                        ref={(node) => {
                          composerTextareaByCommentRef.current[item.threadCommentId] = node
                        }}
                        value={inputValue}
                        onChange={(e) => {
                          setDraftsByTarget((prev) => ({
                            ...prev,
                            [item.draftKey]: e.target.value,
                          }))
                        }}
                        onInput={(e) => {
                          const el = e.currentTarget
                          el.style.height = 'auto'
                          el.style.height = `${Math.min(el.scrollHeight, 144)}px`
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation()
                          if (
                            e.key === 'Enter' &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault()
                            void handleCreateNestedReply(row, item.threadCommentId, item.draftKey)
                          }
                        }}
                        rows={1}
                        placeholder="Opublikuj swoją odpowiedź"
                        className="w-full resize-none overflow-hidden bg-transparent text-[15px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none"
                      />

                      {selectedMedia ? (
                        <div className="mt-2 relative w-[72px] h-[72px] rounded-lg border border-zinc-200 dark:border-white/10 overflow-hidden">
                          <img
                            src={selectedMedia.previewUrl}
                            alt={selectedMedia.fileName || 'Załączony obraz'}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              clearSelectedMedia(item.threadCommentId)
                            }}
                            className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900/70 dark:bg-black/70 text-zinc-100 dark:text-white hover:bg-zinc-900/90 dark:hover:bg-black/90"
                            aria-label="Usuń obraz"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : null}

                      <div className="mt-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            mediaInputByCommentRef.current[item.threadCommentId]?.click()
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-gold-bright transition-colors hover:bg-brand-gold-bright/10"
                          aria-label="Dodaj obraz"
                        >
                          <ImageIcon size={18} />
                        </button>
                        <input
                          ref={(node) => {
                            mediaInputByCommentRef.current[item.threadCommentId] = node
                          }}
                          type="file"
                          accept="image/*"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation()
                            selectReplyMedia(item.threadCommentId, e.target.files?.[0] ?? null)
                            e.currentTarget.value = ''
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleCreateNestedReply(row, item.threadCommentId, item.draftKey)
                          }}
                          disabled={sendDisabled}
                          className="inline-flex h-9 items-center justify-center rounded-full bg-brand-gold-bright px-4 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                        >
                          Odpowiedz
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
            </AnimatePresence>
          </motion.li>
        )
      })}
    </ul>
  )
}
