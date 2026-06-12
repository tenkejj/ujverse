import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, type PanInfo, useReducedMotion } from 'framer-motion'
import {
  ArrowDown,
  FolderOpen,
  GraduationCap,
  Loader2,
  MessagesSquare,
  MoreHorizontal,
  Search,
  Users,
  X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import type { Profile } from '../../types'
import { useMyCohort } from '../../hooks/useMyCohort'
import { useCohortMessages } from '../../hooks/useCohortMessages'
import { useCohortReactions } from '../../hooks/useCohortReactions'
import { useAulaPresence } from '../../hooks/useAulaPresence'
import { useCohortAttachments } from '../../hooks/useCohortAttachments'
import { useCohortPolls } from '../../hooks/useCohortPolls'
import { ChannelNotePanel, ChannelNoteSheet } from './ChannelNotePanel'
import { ChannelTasksPanel, ChannelTasksSheet } from './ChannelTasksPanel'
import {
  useCohortChannels,
  GENERAL_SLUG,
  readLastChannel,
  writeLastChannel,
} from '../../hooks/useCohortChannels'
import { useChannelUnread } from '../../hooks/useChannelUnread'
import { useCohortChannelMutes } from '../../hooks/useCohortChannelMutes'
import { useChannelTyping } from '../../hooks/useChannelTyping'
import { useCohortChannelTaskCounts } from '../../hooks/useCohortChannelTaskCounts'
import {
  CohortService,
  type CohortMemberProfile,
  type CohortMessageWithAuthor,
} from '../../services/CohortService'
import type {
  ChannelKind,
  ChannelMuteMode,
  CohortChannel,
  CohortMessageAttachment,
} from '../../types/database'
import UserAvatar from '../UserAvatar'
import AulaMessageItem from './AulaMessageItem'
import AulaComposer from './AulaComposer'
import AulaOnboardingModal from './AulaOnboardingModal'
import PinnedMessagesStrip from './PinnedMessagesStrip'
import RecentFilesPanel from './RecentFilesPanel'
import AulaSearchModal from './AulaSearchModal'
import ChannelRail from './ChannelRail'
import ChannelHeader from './ChannelHeader'
import ChannelKindPill, { CHANNEL_KIND_META } from './ChannelKindPill'
import CreateChannelModal from './CreateChannelModal'
import AiInsightModal from './AiInsightModal'
import { AulaAiService } from '../../services/ai/AulaAiService'
import type { AulaAiTask } from '../../lib/aulaAiPrompts'
import { toast } from '../../lib/appToast'

type ProfilePatch = Partial<
  Pick<Profile, 'department' | 'study_program' | 'year_started' | 'study_mode'>
>

type Props = {
  currentUserId: string
  myProfile: Profile | null
  onProfilePatch: (patch: ProfilePatch) => void
  /** Wywołane przy wejściu w widok — App używa do reset unread badge w nawigacji. */
  onAulaSeen?: () => void
}

const NEAR_BOTTOM_PX = 80
const DEEP_LINK_CLEAR_MS = 2500
const MAX_LOAD_OLDER_FOR_DEEP_LINK = 5

function MessageSkeletonRow({ widthPct }: { widthPct: number }) {
  return (
    <div className="flex gap-2.5 px-2 py-1.5">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
      <div className="min-w-0 flex-1 space-y-1.5 pt-1">
        <div className="flex items-center gap-2">
          <div className="h-3 w-24 animate-pulse rounded-full bg-black/[0.07] dark:bg-white/[0.09]" />
          <div className="h-2.5 w-10 animate-pulse rounded-full bg-black/[0.05] dark:bg-white/[0.06]" />
        </div>
        <div
          className="h-3 animate-pulse rounded-full bg-black/[0.05] dark:bg-white/[0.06]"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  )
}

function MessageSkeleton() {
  // Sztucznie zróżnicowane szerokości — bardziej naturalne niż 5 identycznych pasków.
  const widths = [62, 88, 45, 73, 55]
  return (
    <div className="space-y-1">
      {widths.map((w, i) => (
        <MessageSkeletonRow key={i} widthPct={w} />
      ))}
    </div>
  )
}

function sortMembersOnlineFirst(
  members: CohortMemberProfile[],
  onlineIds: Set<string>,
): CohortMemberProfile[] {
  return [...members].sort((a, b) => {
    const ao = onlineIds.has(a.id) ? 0 : 1
    const bo = onlineIds.has(b.id) ? 0 : 1
    if (ao !== bo) return ao - bo
    const an = (a.full_name || a.username || '').toLowerCase()
    const bn = (b.full_name || b.username || '').toLowerCase()
    return an.localeCompare(bn)
  })
}

function MembersList({
  members,
  currentUserId,
  onlineIds,
}: {
  members: CohortMemberProfile[]
  currentUserId: string
  onlineIds: Set<string>
}) {
  const sorted = useMemo(() => sortMembersOnlineFirst(members, onlineIds), [members, onlineIds])
  return (
    <div className="space-y-1 px-2 py-2">
      {sorted.map((m) => {
        const isOnline = onlineIds.has(m.id)
        return (
          <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="relative shrink-0">
              <UserAvatar
                profile={m as Profile}
                name={m.full_name || m.username || 'Użytkownik'}
                className="h-7 w-7"
                textSize="text-[11px]"
              />
              {isOnline && (
                <span
                  aria-label="Online"
                  className="pointer-events-none absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-bg-card"
                />
              )}
            </div>
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                isOnline ? 'text-fg-primary' : 'text-fg-primary/70'
              }`}
            >
              {m.full_name || m.username || 'Użytkownik'}
              {m.id === currentUserId ? ' (Ty)' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MembersSheet({
  members,
  currentUserId,
  onClose,
  onlineIds,
  onlineCount,
}: {
  members: CohortMemberProfile[]
  currentUserId: string
  onClose: () => void
  onlineIds: Set<string>
  onlineCount: number
}) {
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverflow = html.style.overflow
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    return () => {
      body.style.overflow = prevBodyOverflow
      html.style.overflow = prevHtmlOverflow
    }
  }, [])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose()
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Członkowie rocznika"
      className="fixed inset-0 z-210 lg:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <motion.div
        className="absolute inset-x-0 bottom-0 z-220 flex max-h-[75vh] flex-col rounded-t-3xl border border-zinc-200 bg-white/95 backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={shouldReduceMotion ? { duration: 0.16 } : { type: 'spring', stiffness: 460, damping: 40, mass: 0.7 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.18}
        onDragEnd={handleDragEnd}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-white/15" />
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 text-[#1e293b] dark:text-brand-gold-bright">
            <Users size={16} />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em]">
              Członkowie ({members.length})
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {onlineCount} online
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <MembersList members={members} currentUserId={currentUserId} onlineIds={onlineIds} />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

export default function AulaView({ currentUserId, myProfile, onProfilePatch, onAulaSeen }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { cohort, loading: cohortLoading, hasMissingProfileFields, refetch } = useMyCohort({
    userId: currentUserId,
    myProfile,
  })

  const cohortId = cohort?.id ?? null

  // Sub-channels state — owner aktywnego kanału, slug↔id resolver.
  const {
    channels,
    archived,
    activeChannelId,
    activeChannel,
    loading: channelsLoading,
    kindFilter,
    availableKinds,
    toggleKindFilter,
    clearKindFilter,
    setActiveChannelId,
    setActiveChannelBySlug,
    resolveChannelIdToSlug,
    createChannel,
    updateChannel,
    archiveChannel,
    unarchiveChannel,
  } = useCohortChannels({ cohortId })

  const {
    messages,
    tree,
    loading,
    hasMore,
    loadingOlder,
    loadOlder,
    sendMessage,
    editMessage,
    deleteMessage,
  } = useCohortMessages({
    cohortId,
    currentUserId,
    myProfile,
    channelId: activeChannelId,
  })

  const [members, setMembers] = useState<CohortMemberProfile[]>([])
  const [replyTarget, setReplyTarget] = useState<{ id: number; authorName: string } | null>(null)
  const [membersSheetOpen, setMembersSheetOpen] = useState(false)
  const [channelsSheetOpen, setChannelsSheetOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(false)
  const taskDeepLinkHandledForRef = useRef<number | null>(null)
  const [recentFilesOpen, setRecentFilesOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<CohortChannel | null>(null)
  /**
   * AI modal config — `null` = closed. `start` to fabryka generatora dla
   * `AiInsightModal` (factory zamiast generatora, żeby retry mogło wywołać
   * fresh stream). Każdy task (summarize / explain / ...) ustawia własną
   * konfigurację przed open.
   */
  const [aiModalConfig, setAiModalConfig] = useState<{
    title: string
    subtitle?: string
    start: () => AsyncGenerator<string, void, void>
    /** Diagnostyka — który task otwarł modal (do telemetry, na razie unused). */
    task: AulaAiTask
  } | null>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showNewBadge, setShowNewBadge] = useState(false)
  const [pinned, setPinned] = useState<CohortMessageWithAuthor[]>([])

  // Reakcje + presence + załączniki
  const { reactionsByMessage, toggleReaction } = useCohortReactions({
    cohortId,
    currentUserId,
  })
  const { onlineIds, onlineCount } = useAulaPresence({
    cohortId,
    currentUserId,
  })
  const { attachmentsByMessage, getSignedUrl } = useCohortAttachments({ cohortId })

  // Polls per cohort — agregat {poll + countsPerOption + votersPerOption + myVoteIndex}
  // per messageId. Cohort-scoped (nie per-channel) bo polls 1:1 z cohort_message;
  // PollDisplay sam decyduje czy renderować na podstawie `pollsByMessage.get(msgId)`.
  const {
    pollsByMessage,
    vote: votePoll,
    closePoll: closePollAction,
  } = useCohortPolls({ cohortId, currentUserId })

  const handleDeleteAttachment = useCallback(
    async (attachment: CohortMessageAttachment) => {
      const { error } = await CohortService.deleteAttachment(
        attachment.id,
        attachment.storage_path,
      )
      if (error) toast.error('Nie udało się usunąć załącznika.')
    },
    [],
  )

  // Mapa userId → display name dla tooltipów ReactionBar.
  const userNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of members) {
      map.set(m.id, m.full_name || m.username || 'Użytkownik')
    }
    return map
  }, [members])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const lastMessageIdRef = useRef<number | null>(null)
  const didInitialScrollRef = useRef(false)
  const isNearBottomRef = useRef(true)
  const deepLinkHandledForRef = useRef<number | null>(null)
  const loadOlderAttemptsRef = useRef(0)

  const highlightId = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('message')
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  }, [location.search])

  const channelSlugFromUrl = useMemo(() => {
    return new URLSearchParams(location.search).get('channel')
  }, [location.search])

  const taskIdFromUrl = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('task')
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  }, [location.search])

  // URL → active channel sync. `?message=<id>` ma priorytet (deep-link
  // resolveuje message → channel → switch w osobnym efekcie poniżej).
  // Brak `?channel=`/`?message=` → fallback do localStorage (last active
  // channel per cohort). Cały resolver dopala się tylko po `channelsLoading`
  // skończy → mamy świeży `channelsBySlug` w hooku.
  const initialSlugAppliedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!cohortId || channelsLoading) return
    if (highlightId != null) return
    if (channelSlugFromUrl != null) {
      setActiveChannelBySlug(channelSlugFromUrl)
      return
    }
    // Tylko RAZ per cohort wykonujemy fallback z localStorage — żeby user,
    // który celowo wyklikał #general (slug nie ląduje w URL), nie był
    // automatycznie przerzucany z powrotem przy każdym re-renderze.
    if (initialSlugAppliedRef.current === cohortId) return
    initialSlugAppliedRef.current = cohortId
    const stored = readLastChannel(cohortId)
    if (stored && stored !== GENERAL_SLUG) {
      setActiveChannelBySlug(stored)
    }
  }, [
    cohortId,
    channelsLoading,
    channelSlugFromUrl,
    highlightId,
    setActiveChannelBySlug,
  ])

  // Reset initial-slug guard przy zmianie cohortu (user wszedł w inny
  // rocznik — chcemy znów odpalić fallback z localStorage).
  useEffect(() => {
    initialSlugAppliedRef.current = null
  }, [cohortId])

  // Per-channel unread tracking (osobny hook, session-scoped). Pusty Set
  // gdy nic nowego — ChannelRail rysuje kropki po prawej.
  const { unreadChannels } = useChannelUnread({
    cohortId,
    currentUserId,
    activeChannelId,
  })

  // Per-channel notification mute prefs — Bell w ChannelHeader otwiera
  // ChannelMuteMenu, ChannelRail rysuje subtelne BellOff/BellMinus per kanał.
  // Trigger SQL też respect mute (źródło prawdy server-side); hook tylko UI.
  const {
    getMuteMode,
    getMutedUntil,
    setMute: setChannelMute,
  } = useCohortChannelMutes({
    cohortId,
    userId: currentUserId,
  })

  // Per-channel typing indicators (ephemeral, Realtime BROADCAST, zero DB).
  // Re-subskrybuje przy każdej zmianie `activeChannelId` — cross-channel
  // typing nie powinno wyciekać. `notifyTyping` jest throttled w hooku (3s),
  // bezpiecznie wołać per keystroke w composerze.
  const currentUserName =
    (myProfile?.full_name || myProfile?.username || '').trim() || null
  const { typingUsers, notifyTyping } = useChannelTyping({
    cohortId,
    channelId: activeChannelId,
    currentUserId,
    currentUserName,
  })

  // Liczba otwartych zadań per sala — badge w ChannelRail/Sheet.
  // Jeden subscribe per cohort (mała tabela, full refetch jest tani).
  const { counts: openTaskCounts } = useCohortChannelTaskCounts({ cohortId })

  // Focus-textarea bump — odpalany TYLKO na explicit user-click w kanał
  // (w `setActiveChannelAndUrl`). NIE bumpujemy przy initial load / deep-
  // link / URL sync — tam scroll/highlight rządzi i kradzież focusu = UX bug.
  const [focusBump, setFocusBump] = useState(0)

  // Active channel → URL sync (push `?channel=<slug>` gdy user kliknie).
  // Robimy `replace` żeby nie spamować history stack. Dodatkowo persistujemy
  // wybór w localStorage (per cohort) + bumpujemy focus na composer.
  const setActiveChannelAndUrl = useCallback(
    (id: number | null) => {
      setActiveChannelId(id)
      const slug = id == null ? GENERAL_SLUG : resolveChannelIdToSlug(id)
      const target =
        slug === GENERAL_SLUG ? '/aula' : `/aula?channel=${encodeURIComponent(slug)}`
      navigate(target, { replace: true })
      setChannelsSheetOpen(false)
      if (cohortId) writeLastChannel(cohortId, slug)
      setFocusBump((n) => n + 1)
    },
    [cohortId, navigate, resolveChannelIdToSlug, setActiveChannelId],
  )

  // Deep-link `?message=<id>` → fetch message, ustaw kanał, potem scroll
  // efekt poniżej zrobi swoje. Robimy ten lookup tylko raz per id.
  const deepLinkChannelResolvedRef = useRef<number | null>(null)
  useEffect(() => {
    if (!cohortId || highlightId == null) return
    if (deepLinkChannelResolvedRef.current === highlightId) return
    deepLinkChannelResolvedRef.current = highlightId
    let cancelled = false
    void CohortService.getMessageById(highlightId).then(({ data }) => {
      if (cancelled || !data) return
      const targetChannel = data.channel_id ?? null
      if (targetChannel !== activeChannelId) {
        setActiveChannelId(targetChannel)
      }
    })
    return () => {
      cancelled = true
    }
    // Celowo NIE zależne od `activeChannelId` — chcemy że ustawić raz, nie
    // co zmiana stanu (uniknięcie loopa).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId, highlightId])

  // Deep-link `?task=<id>` (z NotificationsView) → fetch task → switch
  // channel + otwórz panel zadań. Po obsłudze czyścimy `?task` z URL.
  useEffect(() => {
    if (!cohortId || taskIdFromUrl == null) return
    if (taskDeepLinkHandledForRef.current === taskIdFromUrl) return
    taskDeepLinkHandledForRef.current = taskIdFromUrl

    let cancelled = false
    void (async () => {
      const { data, error } = await CohortService.getTaskById(taskIdFromUrl)
      if (cancelled) return
      if (!error && data) {
        const targetChannel = data.channel_id ?? null
        if (targetChannel !== activeChannelId) setActiveChannelId(targetChannel)
        setTasksOpen(true)
        setNotesOpen(false)
      }
      // Zawsze czyścimy `?task` z URL żeby refresh nie wracał do deep-linka.
      const sp = new URLSearchParams(location.search)
      sp.delete('task')
      const query = sp.toString()
      navigate(`/aula${query ? `?${query}` : ''}`, { replace: true })
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId, taskIdFromUrl])

  // Reset per-channel state przy switch kanału — bez tego:
  //   • `didInitialScrollRef` = true → auto-scroll-to-bottom NIE odpala w
  //     nowym kanale (user widzi top zamiast ostatnich wiadomości);
  //   • `lastMessageIdRef` = id z poprzedniego kanału → fałszywie wykrywa
  //     "nową wiadomość" przy pierwszym fetchu nowego kanału;
  //   • `pinned` pokazuje stale piny aż wróci refetch (flash);
  //   • `showNewBadge`/`replyTarget` zostają z poprzedniego kanału.
  // Effect odpala SIĘ PRZED initial-scroll effect (oba zależą od `messages`),
  // więc `didInitialScrollRef = false` złapie nowy fetch jak świeży.
  useEffect(() => {
    didInitialScrollRef.current = false
    lastMessageIdRef.current = null
    loadOlderAttemptsRef.current = 0
    deepLinkHandledForRef.current = null
    setPinned([])
    setShowNewBadge(false)
    setReplyTarget(null)
  }, [activeChannelId])

  const registerRef = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) {
      messageRefs.current.set(id, el)
    } else {
      messageRefs.current.delete(id)
    }
  }, [])

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({
      block: 'end',
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [])

  // ── Members fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cohortId) {
      setMembers([])
      return
    }
    let cancelled = false
    void CohortService.getMembers(cohortId).then(({ data }) => {
      if (!cancelled) setMembers(data)
    })
    return () => {
      cancelled = true
    }
  }, [cohortId])

  // ── Pinned fetch (per active channel) ──────────────────────────────────────
  // Cap pinów = 10 PER CHANNEL (RPC od migracji 20260613100000); UI musi
  // refetchować przy zmianie `activeChannelId`, inaczej pokazaliśmy by piny
  // z poprzedniego kanału.
  const refetchPinned = useCallback(async () => {
    if (!cohortId) {
      setPinned([])
      return
    }
    const { data } = await CohortService.getPinnedMessages(cohortId, activeChannelId)
    setPinned(data)
  }, [cohortId, activeChannelId])

  useEffect(() => {
    void refetchPinned()
  }, [refetchPinned])

  // Realtime UPDATE na cohort_messages (pin/unpin innego usera) jest mergowany
  // w useCohortMessages → messages się zmienia → refetch pinned (debounced
  // żeby nie spamować przy seriach edycji).
  useEffect(() => {
    if (!cohortId) return
    const t = window.setTimeout(() => {
      void refetchPinned()
    }, 400)
    return () => window.clearTimeout(t)
  }, [messages, cohortId, refetchPinned, activeChannelId])

  const handleTogglePin = useCallback(
    async (id: number) => {
      const { error } = await CohortService.togglePin(id)
      if (error) {
        if (error.message?.includes('pin_limit_reached')) {
          toast.error('Maks. 10 przypiętych w tej sali — odepnij coś najpierw.')
        } else if (error.message?.includes('not_cohort_member')) {
          toast.error('Tylko członkowie rocznika mogą przypinać wiadomości.')
        } else {
          toast.error('Nie udało się zmienić przypięcia.')
        }
        return
      }
      void refetchPinned()
    },
    [refetchPinned],
  )

  const jumpToMessage = useCallback(
    (id: number) => {
      // Reset deep-link ref żeby re-run loop (np. user klika znów to samo id
      // po cleanup → muszą się uruchomić scroll/loadOlder ponownie).
      deepLinkHandledForRef.current = null
      const slug = resolveChannelIdToSlug(activeChannelId)
      const channelParam =
        slug === GENERAL_SLUG ? '' : `&channel=${encodeURIComponent(slug)}`
      const target = `/aula?message=${id}${channelParam}`
      const node = messageRefs.current.get(id)
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      navigate(target, { replace: true })
    },
    [activeChannelId, navigate, resolveChannelIdToSlug],
  )

  // ── Aula "seen" notice — reset unread badge gdy user wejdzie w widok ──────
  useEffect(() => {
    if (!cohortId) return
    onAulaSeen?.()
  }, [cohortId, onAulaSeen])

  // ── Scroll tracking (near-bottom) ─────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      const near = distance <= NEAR_BOTTOM_PX
      isNearBottomRef.current = near
      setIsNearBottom(near)
      if (near) setShowNewBadge(false)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [cohortId, loading])

  // ── Smart auto-scroll przy nowych wiadomościach ───────────────────────────
  useEffect(() => {
    if (loading) return
    const last = messages[messages.length - 1]
    const lastId = last?.id ?? null
    const prevLastId = lastMessageIdRef.current
    lastMessageIdRef.current = lastId

    // Pierwsze załadowanie: scroll na dół tylko jeśli nie ma deep-linku.
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true
      if (highlightId == null) {
        // mikro-opóźnienie żeby DOM zdążył wyrenderować pełną listę
        requestAnimationFrame(() => scrollToBottom(false))
      }
      return
    }

    if (lastId == null || lastId === prevLastId) return

    // Nowa wiadomość: jeśli moja albo jestem przy dole — scrolluj.
    if (last?.user_id === currentUserId || isNearBottomRef.current) {
      scrollToBottom(true)
    } else {
      // Cudza wiadomość, użytkownik czyta starsze — pokaż badge.
      setShowNewBadge(true)
    }
  }, [messages, loading, currentUserId, highlightId, scrollToBottom])

  // Po obsłudze deep-linka czyścimy `?message=` ale ZACHOWUJEMY `?channel=`
  // — user może wrócić do listy notyfikacji i URL dalej wskazuje właściwy
  // kanał.
  const clearMessageParam = useCallback(() => {
    const slug = resolveChannelIdToSlug(activeChannelId)
    const target =
      slug === GENERAL_SLUG ? '/aula' : `/aula?channel=${encodeURIComponent(slug)}`
    navigate(target, { replace: true })
  }, [activeChannelId, navigate, resolveChannelIdToSlug])

  // ── Deep-link ?message=<id> — scroll-to + load-older loop + auto-clear ───
  useEffect(() => {
    if (loading || highlightId == null) return
    if (deepLinkHandledForRef.current === highlightId) return

    const target = messageRefs.current.get(highlightId)
    if (target) {
      deepLinkHandledForRef.current = highlightId
      loadOlderAttemptsRef.current = 0
      // mikro-opóźnienie, żeby ewentualny smart-scroll initial nie nadpisał
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      const timer = window.setTimeout(clearMessageParam, DEEP_LINK_CLEAR_MS)
      return () => window.clearTimeout(timer)
    }

    // Nie znaleziona w aktualnej stronie — spróbuj dociągnąć starsze.
    if (hasMore && !loadingOlder && loadOlderAttemptsRef.current < MAX_LOAD_OLDER_FOR_DEEP_LINK) {
      loadOlderAttemptsRef.current += 1
      void loadOlder()
      return
    }

    // Nie udało się — graceful no-op, ale wyczyść param żeby user nie był uwięziony.
    deepLinkHandledForRef.current = highlightId
    const timer = window.setTimeout(clearMessageParam, DEEP_LINK_CLEAR_MS)
    return () => window.clearTimeout(timer)
  }, [highlightId, loading, messages, hasMore, loadingOlder, loadOlder, clearMessageParam])

  const handleOnboardingSaved = (patch: ProfilePatch) => {
    onProfilePatch(patch)
    void refetch()
  }

  // ── Onboarding gate ───────────────────────────────────────────────────────
  if (hasMissingProfileFields) {
    return (
      <>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <GraduationCap size={40} className="text-[#1e293b]/40 dark:text-brand-gold-bright/40" />
          <h2 className="mt-4 text-xl font-bold text-fg-primary">Aula — czat Twojego rocznika</h2>
          <p className="mt-2 max-w-md text-sm text-fg-secondary">
            Uzupełnij kierunek, rok i tryb studiów, a wpadniesz prosto do czatu swojej grupy.
          </p>
        </div>
        <AulaOnboardingModal
          userId={currentUserId}
          myProfile={myProfile}
          onClose={() => navigate('/')}
          onSaved={handleOnboardingSaved}
        />
      </>
    )
  }

  if (cohortLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#1e293b]/50 dark:text-brand-gold-bright/50" />
      </div>
    )
  }

  const existingSlugs = new Set<string>([
    GENERAL_SLUG,
    ...channels.map((c) => c.slug),
    ...archived.map((c) => c.slug),
  ])

  const isArchivedActive = activeChannel?.archived_at != null
  const canManageActive =
    !!activeChannel && activeChannel.created_by === currentUserId

  const handleSendMessage = async (
    content: string,
    attachments?: Parameters<typeof sendMessage>[2],
    poll?: Parameters<typeof sendMessage>[3],
  ) => {
    if (isArchivedActive) return
    await sendMessage(content, replyTarget?.id ?? null, attachments, poll)
    setReplyTarget(null)
  }

  if (!cohort) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <MessagesSquare size={40} className="text-[#1e293b]/40 dark:text-brand-gold-bright/40" />
        <h2 className="mt-4 text-xl font-bold text-fg-primary">Nie znaleziono rocznika</h2>
        <p className="mt-2 max-w-md text-sm text-fg-secondary">
          Spróbuj odświeżyć stronę. Jeśli problem się powtarza, sprawdź dane studiów w ustawieniach.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-7xl gap-2 px-2 py-2 sm:px-3 sm:py-3 sm:gap-3 md:h-[calc(100dvh-5rem)] md:px-6">
      {/* Channel rail (desktop only — mobile via drawer) */}
      <aside className="hidden w-56 shrink-0 lg:flex">
        <ChannelRail
          channels={channels}
          archived={archived}
          activeChannelId={activeChannelId}
          onSelect={setActiveChannelAndUrl}
          onCreate={() => setCreateChannelOpen(true)}
          unreadChannels={unreadChannels}
          kindFilter={kindFilter}
          availableKinds={availableKinds}
          onToggleKind={toggleKindFilter}
          onClearKindFilter={clearKindFilter}
          getMuteMode={getMuteMode}
          openTaskCounts={openTaskCounts}
          className="w-full"
        />
      </aside>

      {/* Cohort meta + members aside (desktop only) */}
      <aside className="hidden w-60 shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-bg-card/70 xl:flex">
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10">
          <div className="flex items-center gap-2 text-[#1e293b] dark:text-brand-gold-bright">
            <GraduationCap size={18} />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]">Twój rocznik</span>
          </div>
          <h2 className="mt-2 text-sm font-bold leading-snug text-fg-primary">{cohort.study_program}</h2>
          <p className="mt-0.5 text-xs text-fg-secondary">
            Rocznik {cohort.year_started} · {cohort.study_mode}
          </p>
          {cohort.department && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{cohort.department}</p>
          )}
        </div>
        <div className="space-y-1.5 px-4 pt-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.06]"
          >
            <Search size={13} />
            Szukaj w Auli
          </button>
          <button
            type="button"
            onClick={() => setRecentFilesOpen(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.06]"
          >
            <FolderOpen size={13} />
            Pliki rocznika
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pt-3 text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <Users size={14} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              Członkowie ({members.length})
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {onlineCount}
          </span>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          <MembersList members={members} currentUserId={currentUserId} onlineIds={onlineIds} />
        </div>
      </aside>

      {/* Chat */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-bg-card/70">
        {/* Mobile sub-header — kompaktowy: channel pill + members + overflow menu */}
        <MobileAulaSubHeader
          activeChannel={activeChannel}
          membersCount={members.length}
          onlineCount={onlineCount}
          onOpenChannels={() => setChannelsSheetOpen(true)}
          onOpenMembers={() => setMembersSheetOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenFiles={() => setRecentFilesOpen(true)}
        />

        {/* Channel header — #name + opis + gear (creator) */}
        <ChannelHeader
          channel={activeChannel}
          canManage={canManageActive}
          onEdit={() => {
            if (activeChannel) setEditingChannel(activeChannel)
          }}
          onArchive={() => {
            if (activeChannel) void archiveChannel(activeChannel.id)
          }}
          onUnarchive={() => {
            if (activeChannel) void unarchiveChannel(activeChannel.id)
          }}
          muteMode={getMuteMode(activeChannelId)}
          mutedUntil={getMutedUntil(activeChannelId)}
          onChangeMute={(mode, snoozeHours) => {
            void setChannelMute(activeChannelId, mode, snoozeHours)
          }}
          typingUsers={typingUsers}
          notesOpen={notesOpen}
          onToggleNotes={() => {
            setNotesOpen((v) => !v)
            if (!notesOpen) setTasksOpen(false)
          }}
          tasksOpen={tasksOpen}
          onToggleTasks={() => {
            setTasksOpen((v) => !v)
            if (!tasksOpen) setNotesOpen(false)
          }}
          onSummarizeAi={() => {
            // Snapshot ostatnich do ~30 wiadomości aktywnej sali, top-level i
            // odpowiedzi razem, w kolejności chronologicznej. Pomijamy
            // wiadomości usunięte (deleted_at != null) i puste contenty (np.
            // sam załącznik) — model nic z nich nie wyciśnie.
            const channelLabel = activeChannel?.name ?? 'Sala główna'
            const kindLabel = activeChannel?.kind
              ? (CHANNEL_KIND_META[activeChannel.kind]?.long ?? null)
              : null

            const transcript = messages
              .filter((m) => !m.deleted_at && m.content && m.content.trim().length > 0)
              .slice(-30)
              .map((m) => ({
                authorName:
                  userNames.get(m.user_id) || m.profiles?.full_name || m.profiles?.username || 'Użytkownik',
                content: m.content,
                timestamp: m.created_at,
              }))

            if (transcript.length === 0) {
              toast('Brak wiadomości do streszczenia w tej sali.')
              return
            }

            setAiModalConfig({
              task: 'summarize_channel',
              title: 'Streszczenie sali',
              subtitle: kindLabel
                ? `${kindLabel} • ${channelLabel} • ostatnie ${transcript.length} wiadomości`
                : `${channelLabel} • ostatnie ${transcript.length} wiadomości`,
              start: () =>
                AulaAiService.summarizeChannel({
                  channelName: channelLabel,
                  channelKindLabel: kindLabel,
                  messages: transcript,
                }),
            })
          }}
        />

        <PinnedMessagesStrip pinned={pinned} onJump={jumpToMessage} />

        <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {hasMore && (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                onClick={() => void loadOlder()}
                disabled={loadingOlder}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                {loadingOlder ? 'Ładuję…' : 'Wczytaj starsze'}
              </button>
            </div>
          )}

          {loading ? (
            <MessageSkeleton />
          ) : tree.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessagesSquare size={36} className="text-[#1e293b]/30 dark:text-brand-gold-bright/30" />
              {activeChannelId != null ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-fg-primary">
                    Cisza w sali {activeChannel?.name ?? 'sub-channel'}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-fg-secondary">
                    Pierwszy napisz wiadomość w tej sali.
                  </p>
                </>
              ) : members.length <= 1 ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-fg-primary">
                    Jesteś jedyną osobą w swoim roczniku
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-fg-secondary">
                    Powiedz znajomym o UJverse i Auli — gdy dołączą, czat ruszy sam z siebie.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-semibold text-fg-primary">Twój rocznik jest pusty</p>
                  <p className="mt-1 text-sm text-fg-secondary">Bądź pierwszy — napisz cześć!</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {tree.map((node) => (
                <AulaMessageItem
                  key={node.id}
                  node={node}
                  currentUserId={currentUserId}
                  highlightId={highlightId}
                  registerRef={registerRef}
                  onReply={(id, authorName) => setReplyTarget({ id, authorName })}
                  onEdit={editMessage}
                  onDelete={deleteMessage}
                  reactionsByMessage={reactionsByMessage}
                  onToggleReaction={toggleReaction}
                  userNames={userNames}
                  onTogglePin={handleTogglePin}
                  onlineIds={onlineIds}
                  attachmentsByMessage={attachmentsByMessage}
                  getSignedUrl={getSignedUrl}
                  onDeleteAttachment={handleDeleteAttachment}
                  pollsByMessage={pollsByMessage}
                  onVotePoll={votePoll}
                  onClosePoll={closePollAction}
                  onAiAction={(action, payload) => {
                    // Truncated preview do subtitle — żeby user wiedział, co
                    // konkretnie idzie do AI (nie więcej niż 90 znaków, jeden
                    // wiersz). Pełna treść leci do API; tu tylko UX-owy hint.
                    const previewSrc = payload.text.replace(/\s+/g, ' ').trim()
                    const preview =
                      previewSrc.length > 90 ? previewSrc.slice(0, 90) + '…' : previewSrc

                    const channelLabel = activeChannel?.name ?? 'Sala główna'

                    if (action === 'explain') {
                      setAiModalConfig({
                        task: 'explain_message',
                        title: `Wyjaśnienie wiadomości od ${payload.authorName}`,
                        subtitle: preview,
                        start: () =>
                          AulaAiService.explainText({
                            text: payload.text,
                            channelName: channelLabel,
                          }),
                      })
                      return
                    }
                    if (action === 'simplify') {
                      setAiModalConfig({
                        task: 'simplify_message',
                        title: `Streszczenie wiadomości od ${payload.authorName}`,
                        subtitle: preview,
                        start: () =>
                          AulaAiService.simplifyText({
                            text: payload.text,
                            channelName: channelLabel,
                          }),
                      })
                      return
                    }
                    // translate (default EN — MVP; przyszłość: lang picker w menu)
                    setAiModalConfig({
                      task: 'translate_message',
                      title: `Tłumaczenie wiadomości od ${payload.authorName}`,
                      subtitle: preview,
                      start: () =>
                        AulaAiService.translateText({
                          text: payload.text,
                          targetLang: 'en',
                        }),
                    })
                  }}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Floating "nowe wiadomości" badge */}
        {showNewBadge && !isNearBottom && (
          <button
            type="button"
            onClick={() => {
              setShowNewBadge(false)
              scrollToBottom(true)
            }}
            className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] px-3 py-1.5 text-xs font-bold text-white shadow-lg transition-transform hover:scale-[1.03] dark:bg-brand-gold dark:text-black"
            aria-label="Przewiń do nowych wiadomości"
          >
            <ArrowDown size={13} />
            Nowe wiadomości
          </button>
        )}

        <AulaComposer
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          members={members}
          currentUserId={currentUserId}
          cohortId={cohortId}
          channelName={activeChannel?.name}
          disabled={isArchivedActive}
          archivedNotice={
            isArchivedActive
              ? 'Ta sala jest zarchiwizowana — wysyłanie zablokowane.'
              : null
          }
          focusKey={focusBump}
          onSend={handleSendMessage}
          onTyping={notifyTyping}
        />
      </section>

      {/* Desktop right panel — wspólne notatki per sala (toggle z ChannelHeader,
          mutex z tasksOpen) */}
      {notesOpen && cohortId && (
        <ChannelNotePanel
          cohortId={cohortId}
          channelId={activeChannelId}
          channelName={activeChannel?.name ?? 'Sala główna'}
          currentUserId={currentUserId}
          userNames={userNames}
          onClose={() => setNotesOpen(false)}
        />
      )}

      {/* Desktop right panel — zadania / deadliney per sala (mutex z notesOpen) */}
      {tasksOpen && cohortId && (
        <ChannelTasksPanel
          cohortId={cohortId}
          channelId={activeChannelId}
          channelName={activeChannel?.name ?? 'Sala główna'}
          currentUserId={currentUserId}
          userNames={userNames}
          onClose={() => setTasksOpen(false)}
        />
      )}

      <AnimatePresence>
        {notesOpen && cohortId && (
          <ChannelNoteSheet
            key="note-sheet"
            cohortId={cohortId}
            channelId={activeChannelId}
            channelName={activeChannel?.name ?? 'Sala główna'}
            currentUserId={currentUserId}
            userNames={userNames}
            onClose={() => setNotesOpen(false)}
          />
        )}
        {tasksOpen && cohortId && (
          <ChannelTasksSheet
            key="tasks-sheet"
            cohortId={cohortId}
            channelId={activeChannelId}
            channelName={activeChannel?.name ?? 'Sala główna'}
            currentUserId={currentUserId}
            userNames={userNames}
            onClose={() => setTasksOpen(false)}
          />
        )}
        {membersSheetOpen && (
          <MembersSheet
            members={members}
            currentUserId={currentUserId}
            onClose={() => setMembersSheetOpen(false)}
            onlineIds={onlineIds}
            onlineCount={onlineCount}
          />
        )}
        {channelsSheetOpen && (
          <ChannelsSheet
            channels={channels}
            archived={archived}
            activeChannelId={activeChannelId}
            onSelect={setActiveChannelAndUrl}
            onCreate={() => {
              setChannelsSheetOpen(false)
              setCreateChannelOpen(true)
            }}
            onClose={() => setChannelsSheetOpen(false)}
            unreadChannels={unreadChannels}
            kindFilter={kindFilter}
            availableKinds={availableKinds}
            onToggleKind={toggleKindFilter}
            onClearKindFilter={clearKindFilter}
            getMuteMode={getMuteMode}
            openTaskCounts={openTaskCounts}
          />
        )}
        {recentFilesOpen && cohortId && (
          <RecentFilesPanel
            cohortId={cohortId}
            onClose={() => setRecentFilesOpen(false)}
          />
        )}
        {searchOpen && cohortId && (
          <AulaSearchModal
            cohortId={cohortId}
            activeChannelId={activeChannelId}
            activeChannelName={activeChannel?.name ?? null}
            activeChannelKind={activeChannel?.kind ?? null}
            onJump={jumpToMessage}
            onClose={() => setSearchOpen(false)}
          />
        )}
        {createChannelOpen && cohortId && (
          <CreateChannelModal
            existingSlugs={existingSlugs}
            onClose={() => setCreateChannelOpen(false)}
            onSubmit={async ({ slug, name, description, kind }) => {
              const created = await createChannel({
                userId: currentUserId,
                slug,
                name,
                description,
                kind,
              })
              if (created) {
                // Push slug do URL żeby state był reproducible.
                navigate(`/aula?channel=${encodeURIComponent(created.slug)}`, {
                  replace: true,
                })
              }
            }}
          />
        )}
        {editingChannel && (
          <CreateChannelModal
            mode="edit"
            existingSlugs={existingSlugs}
            initialSlug={editingChannel.slug}
            initialName={editingChannel.name}
            initialDescription={editingChannel.description}
            initialKind={editingChannel.kind}
            onClose={() => setEditingChannel(null)}
            onSubmit={async ({ name, description, kind }) => {
              await updateChannel(editingChannel.id, { name, description, kind })
            }}
          />
        )}

        {aiModalConfig && (
          <AiInsightModal
            key={aiModalConfig.task + ':' + (aiModalConfig.subtitle ?? '')}
            title={aiModalConfig.title}
            subtitle={aiModalConfig.subtitle}
            start={aiModalConfig.start}
            onClose={() => setAiModalConfig(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Mobile (`lg-`) sub-header dla Auli — kompaktowy 1-row pasek nad chatem.
 *
 * Po lewej: channel selector (pill z `ChannelKindPill` + nazwa, trigger drawer).
 * W środku: `flex-1` spacer.
 * Po prawej: members chip (count + dot online, trigger members sheet)
 *           + overflow menu `MoreHorizontal` z search / files.
 *
 * Cel: zmniejszyć liczbę widocznych "klikadeł" z 4 do 2 (+ ukryta lista pod
 * overflow). Buttony niższe (h-8) z mniejszym padding, żeby zostawić więcej
 * miejsca na właściwy chat na mobile 360×640.
 */
function MobileAulaSubHeader({
  activeChannel,
  membersCount,
  onlineCount,
  onOpenChannels,
  onOpenMembers,
  onOpenSearch,
  onOpenFiles,
}: {
  activeChannel: CohortChannel | null
  membersCount: number
  onlineCount: number
  onOpenChannels: () => void
  onOpenMembers: () => void
  onOpenSearch: () => void
  onOpenFiles: () => void
}) {
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!overflowOpen) return
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [overflowOpen])

  return (
    <div className="flex items-center gap-1.5 border-b border-zinc-200 px-2 py-1.5 dark:border-white/10 lg:hidden">
      <button
        type="button"
        onClick={onOpenChannels}
        className="inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-1 text-[12.5px] font-semibold text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
        aria-label="Otwórz listę sal"
      >
        {activeChannel ? (
          <ChannelKindPill kind={activeChannel.kind} size="sm" />
        ) : (
          <GraduationCap size={13} className="text-[#1e293b]/70 dark:text-brand-gold-bright/80" />
        )}
        <span className="max-w-[10rem] truncate">{activeChannel?.name ?? 'Sala główna'}</span>
      </button>
      <div className="min-w-0 flex-1" />
      <button
        type="button"
        onClick={onOpenMembers}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 px-2 py-1 text-[12px] font-semibold text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
        aria-label={`Pokaż członków rocznika — ${membersCount} osób, ${onlineCount} online`}
      >
        <Users size={12} />
        <span className="tabular-nums">{membersCount}</span>
        {onlineCount > 0 && (
          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        )}
      </button>
      <div ref={overflowRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOverflowOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={overflowOpen}
          aria-label="Więcej akcji"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          <MoreHorizontal size={14} />
        </button>
        {overflowOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-bg-card"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOverflowOpen(false)
                onOpenSearch()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
            >
              <Search size={14} />
              Szukaj w Auli
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOverflowOpen(false)
                onOpenFiles()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
            >
              <FolderOpen size={14} />
              Pliki rocznika
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ChannelsSheet({
  channels,
  archived,
  activeChannelId,
  onSelect,
  onCreate,
  onClose,
  unreadChannels,
  kindFilter,
  availableKinds,
  onToggleKind,
  onClearKindFilter,
  getMuteMode,
  openTaskCounts,
}: {
  channels: CohortChannel[]
  archived: CohortChannel[]
  activeChannelId: number | null
  onSelect: (id: number | null) => void
  onCreate: () => void
  onClose: () => void
  unreadChannels?: ReadonlySet<number | null>
  kindFilter?: ReadonlySet<ChannelKind>
  availableKinds?: ReadonlySet<ChannelKind>
  onToggleKind?: (kind: ChannelKind) => void
  onClearKindFilter?: () => void
  getMuteMode?: (channelId: number | null) => ChannelMuteMode
  openTaskCounts?: ReadonlyMap<number | null, number>
}) {
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverflow = html.style.overflow
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    return () => {
      body.style.overflow = prevBodyOverflow
      html.style.overflow = prevHtmlOverflow
    }
  }, [])

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x < -60 || info.velocity.x < -400) onClose()
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Kanały rocznika"
      className="fixed inset-0 z-210 lg:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <motion.div
        className="absolute inset-y-0 left-0 z-220 flex w-72 max-w-[85vw] flex-col border-r border-zinc-200 bg-white/95 backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={
          shouldReduceMotion
            ? { duration: 0.16 }
            : { type: 'spring', stiffness: 460, damping: 40, mass: 0.7 }
        }
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#1e293b] dark:text-brand-gold-bright">
            Sale
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ChannelRail
            channels={channels}
            archived={archived}
            activeChannelId={activeChannelId}
            onSelect={(id) => {
              onSelect(id)
              onClose()
            }}
            onCreate={onCreate}
            unreadChannels={unreadChannels}
            kindFilter={kindFilter}
            availableKinds={availableKinds}
            onToggleKind={onToggleKind}
            onClearKindFilter={onClearKindFilter}
            getMuteMode={getMuteMode}
            openTaskCounts={openTaskCounts}
            className="h-full rounded-none border-0 bg-transparent"
          />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
