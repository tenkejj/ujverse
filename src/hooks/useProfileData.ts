import { useEffect, useMemo, useState } from 'react'
import { getDeptAccent } from '../lib/departments'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'

type UseProfileDataParams = {
  userId: string
  initialProfile?: Profile | null
}

type UseProfileDataResult = {
  profile: Profile | null
  accentColor: string
  loading: boolean
}

export function useProfileData({ userId, initialProfile = null }: UseProfileDataParams): UseProfileDataResult {
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialProfile?.id === userId) {
      setProfile(initialProfile)
      setLoading(false)
      return
    }
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, banner_url, bio, department, created_at, role, is_banned')
          .eq('id', userId)
          .maybeSingle()

        if (cancelled) return
        setProfile((data as Profile | null) ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, initialProfile])

  const accentColor = useMemo(() => getDeptAccent(profile?.department).hex, [profile?.department])

  return { profile, accentColor, loading }
}
