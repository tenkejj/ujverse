/**
 * UJverse — ActiveCheckinsList: kto teraz uczy się w danym miejscu.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Renderuje listę aktywnych check-inów + avatary/nazwiska + mood emoji.
 * Pobiera dane przez RPC `get_active_checkins_with_profiles(p_spot_id)` na
 * mount + ticka co 30s żeby świeże ekspiracje wypadły z listy.
 */
import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import UserAvatar from '../UserAvatar'
import { StudySpotsService } from '../../services/StudySpotsService'
import {
  MOOD_META,
  type ActiveCheckinWithProfile,
} from '../../types/studySpots'

type Props = {
  spotId: string
  expectedCount: number
  onNavigateToProfile?: (username: string) => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'przed chwilą'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const remM = min % 60
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`
}

export default function ActiveCheckinsList({
  spotId,
  expectedCount,
  onNavigateToProfile,
}: Props) {
  const [list, setList] = useState<ActiveCheckinWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const { data } = await StudySpotsService.getActiveCheckinsWithProfiles(spotId)
    setList(data)
    setLoading(false)
  }, [spotId])

  useEffect(() => {
    setLoading(true)
    void refetch()
    const interval = setInterval(() => void refetch(), 30_000)
    return () => clearInterval(interval)
  }, [refetch])

  if (!loading && list.length === 0 && expectedCount === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-4 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <Users size={20} className="mx-auto mb-1.5 text-zinc-400" strokeWidth={1.8} aria-hidden />
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
          Nikt teraz nie jest tu zameldowany — bądź pierwszy
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        <Users size={11} strokeWidth={2.4} aria-hidden />
        Kto teraz tu jest
        {!loading && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            {list.length}
          </span>
        )}
      </h3>

      {loading ? (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-9 w-32 animate-pulse rounded-full bg-black/[0.05] dark:bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {list.map((c) => {
            const m = MOOD_META[c.mood]
            const display = c.full_name ?? c.username ?? 'Anonim'
            const Wrapper = c.username && onNavigateToProfile ? 'button' : 'div'
            return (
              <li key={c.checkin_id}>
                <Wrapper
                  type={Wrapper === 'button' ? 'button' : undefined}
                  onClick={
                    Wrapper === 'button' && c.username && onNavigateToProfile
                      ? () => onNavigateToProfile(c.username!)
                      : undefined
                  }
                  className={`group inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/80 py-1 pr-3 pl-1 text-[12px] backdrop-blur-md transition-colors dark:border-white/10 dark:bg-white/[0.04] ${
                    Wrapper === 'button'
                      ? 'cursor-pointer hover:border-emerald-400/60 hover:bg-emerald-50/60 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-500/10'
                      : ''
                  }`}
                  title={`${display} · ${m.label} · od ${timeAgo(c.checked_in_at)}`}
                >
                  <UserAvatar
                    profile={{
                      id: c.user_id,
                      full_name: display,
                      avatar_url: c.avatar_url,
                      username: c.username,
                    }}
                    name={display}
                    className="h-6 w-6"
                    textSize="text-[10px]"
                  />
                  <span className="max-w-[120px] truncate font-semibold text-zinc-800 dark:text-zinc-200">
                    {display}
                  </span>
                  <span className="text-[14px] leading-none" aria-hidden>
                    {m.emoji}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {timeAgo(c.checked_in_at)}
                  </span>
                </Wrapper>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
