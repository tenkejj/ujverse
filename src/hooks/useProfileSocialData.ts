import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../lib/appToast'
import { supabase } from '../supabaseClient'

function followActionErrorMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : ''
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

type Params = {
  currentUserId: string
  viewedUserId: string | null
  isOwn: boolean
}

export function useProfileSocialData({ currentUserId, viewedUserId, isOwn }: Params) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [followActionLoading, setFollowActionLoading] = useState(false)
  const [followStatsLoading, setFollowStatsLoading] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const followToggleInFlight = useRef(false)

  const fetchCounts = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!viewedUserId) {
        setFollowersCount(0)
        setFollowingCount(0)
        setIsFollowing(false)
        return
      }
      const silent = opts?.silent ?? false
      if (!silent) setFollowStatsLoading(true)
      const [followersRes, followingRes, isFollowingRes] = await Promise.all([
        supabase
          .from('follows')
          .select('following_id', { count: 'exact', head: true })
          .eq('following_id', viewedUserId),
        supabase
          .from('follows')
          .select('follower_id', { count: 'exact', head: true })
          .eq('follower_id', viewedUserId),
        isOwn
          ? Promise.resolve({ data: null, error: null })
          : supabase
              .from('follows')
              .select('follower_id')
              .eq('follower_id', currentUserId)
              .eq('following_id', viewedUserId)
              .maybeSingle(),
      ])
      setFollowersCount(followersRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)
      setIsFollowing(Boolean(isFollowingRes.data))
      if (!silent) setFollowStatsLoading(false)
    },
    [currentUserId, isOwn, viewedUserId],
  )

  useEffect(() => {
    if (!viewedUserId) return
    void fetchCounts()
  }, [fetchCounts, viewedUserId])

  useEffect(() => {
    if (!viewedUserId) return
    const channel = supabase
      .channel(`profile-follows-${viewedUserId}-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, (payload) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new
        const followerId = String(row?.follower_id ?? '')
        const followingId = String(row?.following_id ?? '')
        if (followingId === viewedUserId) {
          setFollowersCount((prev) =>
            payload.eventType === 'INSERT' ? prev + 1 : Math.max(0, prev - 1),
          )
          if (!isOwn && followerId === currentUserId) {
            setIsFollowing(payload.eventType === 'INSERT')
          }
        }
        if (followerId === viewedUserId) {
          setFollowingCount((prev) =>
            payload.eventType === 'INSERT' ? prev + 1 : Math.max(0, prev - 1),
          )
        }
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentUserId, isOwn, viewedUserId])

  const toggleFollow = useCallback(async () => {
    if (!viewedUserId || isOwn || followToggleInFlight.current) return
    followToggleInFlight.current = true
    setFollowActionLoading(true)
    const previous = isFollowing
    setIsFollowing(!previous)
    setFollowersCount((prev) => Math.max(0, prev + (previous ? -1 : 1)))
    try {
      if (previous) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', viewedUserId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: viewedUserId,
        })
        if (error) throw error
      }
    } catch (error) {
      setIsFollowing(previous)
      setFollowersCount((prev) => Math.max(0, prev + (previous ? 1 : -1)))
      toast.error(followActionErrorMessage(error), { id: 'profile-follow-action' })
    } finally {
      followToggleInFlight.current = false
      setFollowActionLoading(false)
    }
  }, [currentUserId, isFollowing, isOwn, viewedUserId])

  return useMemo(
    () => ({
      isFollowing,
      followActionLoading,
      followStatsLoading,
      followersCount,
      followingCount,
      toggleFollow,
      refreshFollowStats: fetchCounts,
    }),
    [
      fetchCounts,
      followActionLoading,
      followStatsLoading,
      followersCount,
      followingCount,
      isFollowing,
      toggleFollow,
    ],
  )
}
