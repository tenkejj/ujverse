import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { toast } from '../lib/appToast'
import type { Profile } from '../types'
import { supabase } from '../supabaseClient'
import UserAvatar from './UserAvatar'
import { PROFILE_MOBILE } from '../styles/mobile-theme'

export type FollowModalTab = 'followers' | 'following'

type Props = {
  open: boolean
  onClose: () => void
  profileUserId: string
  currentUserId: string
  initialTab: FollowModalTab
  onCountsChange?: (opts?: { silent?: boolean }) => void
  onNavigateToProfileHandle?: (handle: string) => void
}

function followActionErrorMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  const msg =
    err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : ''
  const t = `${code} ${msg}`.toLowerCase()
  if (
    code === '42P01' ||
    (t.includes('follows') && t.includes('does not exist')) ||
    t.includes('schema cache') ||
    t.includes('could not find the table')
  ) {
    return 'Brak tabeli obserwacji w bazie. Wklej migrację SQL w panelu Supabase (SQL Editor).'
  }
  return 'Nie udało się zaktualizować obserwacji. Spróbuj ponownie.'
}

function normalizeJoined(rows: unknown, key: 'follower' | 'following'): Profile[] {
  if (!Array.isArray(rows)) return []
  const out: Profile[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const p = (row as Record<string, unknown>)[key]
    const prof = Array.isArray(p) ? p[0] : p
    if (prof && typeof prof === 'object' && 'id' in prof) {
      out.push(prof as Profile)
    }
  }
  return out
}

async function fetchFollowersProfiles(uid: string): Promise<Profile[]> {
  const q1 = await supabase
    .from('follows')
    .select('follower:profiles!follows_follower_id_fkey(id, full_name, username, avatar_url)')
    .eq('following_id', uid)
  if (!q1.error && q1.data) return normalizeJoined(q1.data, 'follower')
  const q2 = await supabase.from('follows').select('follower_id').eq('following_id', uid)
  if (q2.error || !q2.data?.length) return []
  const ids = [...new Set(q2.data.map((r) => r.follower_id).filter(Boolean))] as string[]
  const { data: profs, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', ids)
  if (error || !profs) return []
  const order = new Map(ids.map((id, i) => [id, i]))
  return [...profs].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

async function fetchFollowingProfiles(uid: string): Promise<Profile[]> {
  const q1 = await supabase
    .from('follows')
    .select('following:profiles!follows_following_id_fkey(id, full_name, username, avatar_url)')
    .eq('follower_id', uid)
  if (!q1.error && q1.data) return normalizeJoined(q1.data, 'following')
  const q2 = await supabase.from('follows').select('following_id').eq('follower_id', uid)
  if (q2.error || !q2.data?.length) return []
  const ids = [...new Set(q2.data.map((r) => r.following_id).filter(Boolean))] as string[]
  const { data: profs, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', ids)
  if (error || !profs) return []
  const order = new Map(ids.map((id, i) => [id, i]))
  return [...profs].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

async function fetchMyFollowingSet(viewerId: string, candidateIds: string[]): Promise<Set<string>> {
  const ids = candidateIds.filter((id) => id && id !== viewerId)
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', viewerId)
    .in('following_id', ids)
  if (error || !data) return new Set()
  return new Set(data.map((r) => r.following_id))
}

export default function FollowListsModal({
  open,
  onClose,
  profileUserId,
  currentUserId,
  initialTab,
  onCountsChange,
  onNavigateToProfileHandle,
}: Props) {
  const [isClosing, setIsClosing] = useState(false)
  const [activeTab, setActiveTab] = useState<FollowModalTab>(initialTab)
  const [followers, setFollowers] = useState<Profile[]>([])
  const [following, setFollowing] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [iFollow, setIFollow] = useState<Set<string>>(() => new Set())
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({})
  const rowToggleBusy = useRef<Set<string>>(new Set())

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  const loadAll = useCallback(async () => {
    if (!profileUserId) return
    setLoading(true)
    try {
      const [fol, wing] = await Promise.all([
        fetchFollowersProfiles(profileUserId),
        fetchFollowingProfiles(profileUserId),
      ])
      setFollowers(fol)
      setFollowing(wing)
      const mergedIds = [...new Set([...fol, ...wing].map((p) => p.id))]
      const followSet = await fetchMyFollowingSet(currentUserId, mergedIds)
      setIFollow(followSet)
    } finally {
      setLoading(false)
    }
  }, [profileUserId, currentUserId])

  useEffect(() => {
    if (!open) return
    setActiveTab(initialTab)
    void loadAll()
  }, [open, initialTab, loadAll])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  const handleRowFollowToggle = async (targetUserId: string) => {
    if (!targetUserId || targetUserId === currentUserId) return
    if (rowToggleBusy.current.has(targetUserId)) return
    rowToggleBusy.current.add(targetUserId)
    setRowLoading((p) => ({ ...p, [targetUserId]: true }))
    const now = iFollow.has(targetUserId)
    try {
      if (now) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId)
        if (error) throw error
        setIFollow((prev) => {
          const next = new Set(prev)
          next.delete(targetUserId)
          return next
        })
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: targetUserId,
        })
        if (error) throw error
        setIFollow((prev) => new Set(prev).add(targetUserId))
      }
      onCountsChange?.({ silent: true })
    } catch (e) {
      console.error(e)
      toast.error(followActionErrorMessage(e), { id: 'follow-list-action' })
    } finally {
      rowToggleBusy.current.delete(targetUserId)
      setRowLoading((p) => ({ ...p, [targetUserId]: false }))
    }
  }

  const handleUserRowClick = (profile: Profile) => {
    const handle = profile.username?.trim().toLowerCase()
    if (!handle || !onNavigateToProfileHandle) return
    handleClose()
    onNavigateToProfileHandle(handle)
  }

  const list = activeTab === 'followers' ? followers : following
  const listMotion = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.02,
      },
    },
  } as const
  const rowMotion = {
    hidden: { opacity: 0, y: 12, scale: 0.985 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring' as const, stiffness: 380, damping: 30, mass: 0.7 },
    },
    exit: { opacity: 0, y: 8, scale: 0.99, transition: { duration: 0.16 } },
  } as const

  if (!open) return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-app/70 p-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-lists-title"
        className={`flex max-h-[min(85vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl ${PROFILE_MOBILE.card.glassLight} ${PROFILE_MOBILE.card.glassDark} backdrop-blur-2xl`}
        initial={{ opacity: 0, y: 28, scale: 0.96, rotateX: 8 }}
        animate={{
          opacity: isClosing ? 0 : 1,
          y: isClosing ? 18 : 0,
          scale: isClosing ? 0.975 : 1,
          rotateX: isClosing ? 5 : 0,
        }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, mass: 0.85 }}
        onClick={(e) => e.stopPropagation()}
        style={{ transformOrigin: 'center top' }}
      >
        <div className="flex items-center justify-between border-b border-border-app/70 px-4 py-3">
          <h2 id="follow-lists-title" className="text-base font-bold text-fg-primary">
            {activeTab === 'followers' ? 'Obserwujący' : 'Obserwowani'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Zamknij"
            className="rounded-full p-2 text-fg-secondary transition-colors hover:bg-bg-app/35 hover:text-fg-primary"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="flex border-b border-border-app/70 px-2 pt-1">
          {(
            [
              { id: 'followers' as const, label: 'Obserwujący' },
              { id: 'following' as const, label: 'Obserwowani' },
            ] as const
          ).map((t) => {
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(t.id)}
                className={`relative flex-1 px-3 py-2.5 text-center text-sm font-semibold transition-colors ${
                  isActive ? 'text-fg-primary' : 'text-fg-secondary hover:text-fg-primary'
                }`}
              >
                {t.label}
                {isActive ? (
                  <motion.span
                    layoutId="followModalTab"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#1e293b] dark:bg-brand-gold-bright"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-14">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1e293b] border-t-transparent dark:border-brand-gold-bright" />
            </div>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-sm text-fg-secondary">
              {activeTab === 'followers' ? 'Brak obserwujących.' : 'Nikt nie jest obserwowany.'}
            </p>
          ) : (
            <motion.ul
              key={activeTab}
              variants={listMotion}
              initial="hidden"
              animate="show"
              className="space-y-1"
            >
              {list.map((p) => {
                const name = p.full_name?.trim() || 'Użytkownik'
                const isSelf = p.id === currentUserId
                const amFollowing = iFollow.has(p.id)
                const busy = Boolean(rowLoading[p.id])
                return (
                  <motion.li
                    key={p.id}
                    variants={rowMotion}
                    whileHover={{ y: -1, scale: 1.004 }}
                    whileTap={{ scale: 0.992 }}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-bg-app/25"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleUserRowClick(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleUserRowClick(p)
                      }
                    }}
                  >
                    <UserAvatar profile={p} name={name} className="h-10 w-10" textSize="text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg-primary">{name}</p>
                      {p.username ? (
                        <p className="truncate text-xs text-fg-secondary">@{p.username}</p>
                      ) : null}
                    </div>
                    {isSelf ? (
                      <span className="shrink-0 rounded-full border border-border-app/70 px-3 py-1 text-xs font-medium text-fg-secondary">
                        Ty
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleRowFollowToggle(p.id)
                        }}
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          amFollowing
                            ? 'border-border-app text-fg-primary hover:border-[#1e293b]/55 dark:hover:border-brand-gold-bright/55'
                            : 'border-[#1e293b]/50 bg-[#1e293b]/12 text-[#1e293b] hover:bg-[#1e293b]/18 dark:border-brand-gold-bright/50 dark:bg-brand-gold-bright/12 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/18'
                        }`}
                      >
                        {busy ? (
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : amFollowing ? (
                          'Obserwujesz'
                        ) : (
                          'Obserwuj'
                        )}
                      </button>
                    )}
                  </motion.li>
                )
              })}
            </motion.ul>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
