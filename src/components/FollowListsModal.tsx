import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { toast } from '../lib/appToast'
import type { Profile } from '../types'
import { supabase } from '../supabaseClient'
import UserAvatar from './UserAvatar'

export type FollowModalTab = 'followers' | 'following'

type Props = {
  open: boolean
  onClose: () => void
  profileUserId: string
  currentUserId: string
  initialTab: FollowModalTab
  onCountsChange?: (opts?: { silent?: boolean }) => void
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
    .select('follower:profiles!follows_follower_id_fkey(id, full_name, avatar_url)')
    .eq('following_id', uid)
  if (!q1.error && q1.data) return normalizeJoined(q1.data, 'follower')
  const q2 = await supabase.from('follows').select('follower_id').eq('following_id', uid)
  if (q2.error || !q2.data?.length) return []
  const ids = [...new Set(q2.data.map((r) => r.follower_id).filter(Boolean))] as string[]
  const { data: profs, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', ids)
  if (error || !profs) return []
  const order = new Map(ids.map((id, i) => [id, i]))
  return [...profs].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

async function fetchFollowingProfiles(uid: string): Promise<Profile[]> {
  const q1 = await supabase
    .from('follows')
    .select('following:profiles!follows_following_id_fkey(id, full_name, avatar_url)')
    .eq('follower_id', uid)
  if (!q1.error && q1.data) return normalizeJoined(q1.data, 'following')
  const q2 = await supabase.from('follows').select('following_id').eq('follower_id', uid)
  if (q2.error || !q2.data?.length) return []
  const ids = [...new Set(q2.data.map((r) => r.following_id).filter(Boolean))] as string[]
  const { data: profs, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
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

  const list = activeTab === 'followers' ? followers : following

  if (!open) return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.2 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-lists-title"
        className="flex max-h-[min(85vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/55 shadow-2xl shadow-black/40 dark:bg-black/45"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{
          opacity: isClosing ? 0 : 1,
          y: isClosing ? 10 : 0,
          scale: isClosing ? 0.98 : 1,
        }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <h2 id="follow-lists-title" className="text-base font-bold text-white">
            {activeTab === 'followers' ? 'Obserwujący' : 'Obserwowani'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Zamknij"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="flex border-b border-white/5 px-2 pt-1">
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
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.label}
                {isActive ? (
                  <motion.span
                    layoutId="followModalTab"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand-gold"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-14">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
            </div>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              {activeTab === 'followers' ? 'Brak obserwujących.' : 'Nikt nie jest obserwowany.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {list.map((p) => {
                const name = p.full_name?.trim() || 'Użytkownik'
                const isSelf = p.id === currentUserId
                const amFollowing = iFollow.has(p.id)
                const busy = Boolean(rowLoading[p.id])
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
                  >
                    <UserAvatar profile={p} name={name} className="h-10 w-10" textSize="text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{name}</p>
                    </div>
                    {isSelf ? (
                      <span className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-400">
                        Ty
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRowFollowToggle(p.id)}
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          amFollowing
                            ? 'border-white/25 text-white hover:border-red-400/50 hover:text-red-400/90'
                            : 'border-brand-gold/50 bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25'
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
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
