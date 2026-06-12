/**
 * UJverse — StudySpotCard: karta miejsca do nauki.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Check, ExternalLink, Star, Users, Volume2, Wifi, Zap } from 'lucide-react'
import { theme } from '../../styles/theme'
import {
  STUDY_SPOT_KIND_META,
  formatTimeRemaining,
  timeRemainingMs,
  type StudySpotMood,
  type StudySpotWithUserState,
} from '../../types/studySpots'

type Props = {
  spot: StudySpotWithUserState
  onOpen: (spot: StudySpotWithUserState) => void
  onCheckIn: (spotId: string, mood: StudySpotMood) => Promise<{ ok: boolean; error: string | null }>
}

function StatBadge({
  icon: Icon,
  value,
  label,
  max = 5,
}: {
  icon: typeof Wifi
  value: number | null
  label: string
  max?: number
}) {
  if (value == null) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300`}
      title={`${label}: ${value}/${max}`}
    >
      <Icon size={10} strokeWidth={2.3} />
      {value}/{max}
    </span>
  )
}

export default function StudySpotCard({ spot, onOpen, onCheckIn }: Props) {
  const meta = STUDY_SPOT_KIND_META[spot.kind]
  const KindIcon = meta.icon
  const isCheckedIn = !!spot.my_active_checkin_id
  const [busy, setBusy] = useState(false)

  // Re-render co minutę żeby "wygasa za X" się odświeżał
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isCheckedIn) return
    const interval = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [isCheckedIn])

  const handleToggleCheckin = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (busy) return
      setBusy(true)
      try {
        await onCheckIn(spot.id, 'focus')
      } finally {
        setBusy(false)
      }
    },
    [busy, spot.id, onCheckIn],
  )

  const remainingMs = spot.my_active_checkin_expires_at
    ? timeRemainingMs(spot.my_active_checkin_expires_at)
    : 0

  return (
    <article
      onClick={() => onOpen(spot)}
      className={`group relative flex flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white/85 p-3.5 text-left backdrop-blur-xl backdrop-saturate-150 transition-all hover:-translate-y-0.5 hover:border-[#1e293b]/25 hover:bg-white hover:shadow-lg dark:border-white/10 dark:bg-zinc-950/45 dark:hover:border-brand-gold-bright/30 dark:hover:bg-zinc-900/60 cursor-pointer`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${meta.tintClass}`}>
              <KindIcon size={10} strokeWidth={2.3} />
              {meta.label}
            </span>
            {!spot.is_free && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                Płatne
              </span>
            )}
            {spot.active_checkins_count > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Users size={9} strokeWidth={2.6} />
                {spot.active_checkins_count}
              </span>
            )}
          </div>
          <h3 className={`line-clamp-2 text-[14px] font-bold leading-snug ${theme.text.primary}`}>
            {spot.name}
          </h3>
          <p className={`line-clamp-1 text-[11.5px] ${theme.text.muted}`}>
            {spot.address}
          </p>
        </div>
      </div>

      {/* Description (optional, line-clamped) */}
      {spot.description && (
        <p className={`line-clamp-2 text-[12px] leading-snug ${theme.text.muted}`}>
          {spot.description}
        </p>
      )}

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatBadge icon={Wifi} value={spot.wifi_quality} label="Wi-Fi" />
        <StatBadge icon={Volume2} value={spot.silence_level} label="Cisza" />
        {spot.sockets_count_estimate != null && spot.sockets_count_estimate > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300"
            title="Szacunkowa liczba gniazdek"
          >
            <Zap size={10} strokeWidth={2.3} />
            {spot.sockets_count_estimate}+
          </span>
        )}
      </div>

      {/* Footer: rating + check-in CTA */}
      <div className={`mt-auto flex items-center justify-between gap-2 pt-1 text-[11.5px] ${theme.text.muted}`}>
        <span className="inline-flex items-center gap-1" title="Średnia ocena">
          <Star size={12} strokeWidth={2.2} className={spot.rating_avg ? 'fill-amber-400 text-amber-400' : ''} />
          {spot.rating_avg ? (
            <>
              <span className="tabular-nums font-semibold text-zinc-700 dark:text-zinc-200">
                {spot.rating_avg.toFixed(1)}
              </span>
              <span className="tabular-nums text-zinc-400">({spot.rating_count})</span>
            </>
          ) : (
            <span className="text-zinc-400">brak</span>
          )}
        </span>

        <button
          type="button"
          onClick={handleToggleCheckin}
          disabled={busy}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
            isCheckedIn
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'border border-zinc-200 bg-white text-zinc-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300'
          } ${busy ? 'opacity-60 cursor-wait' : ''}`}
          title={isCheckedIn ? `Wymelduj (zostało ${formatTimeRemaining(spot.my_active_checkin_expires_at ?? new Date().toISOString())})` : 'Zamelduj się tutaj'}
        >
          {isCheckedIn ? (
            <>
              <Check size={11} strokeWidth={2.6} />
              Jestem tu
            </>
          ) : (
            <>
              <Bookmark size={11} strokeWidth={2.6} />
              Jestem tu
            </>
          )}
        </button>
      </div>

      {/* Sub-line jeśli zameldowany: ile pozostało */}
      {isCheckedIn && remainingMs > 0 && (
        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 tabular-nums">
          ⏳ auto-wymeldowanie za {formatTimeRemaining(spot.my_active_checkin_expires_at!)}
        </p>
      )}

      {spot.google_maps_url && (
        <a
          href={spot.google_maps_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200"
          aria-label="Otwórz w Google Maps"
        >
          <ExternalLink size={12} strokeWidth={2.3} />
        </a>
      )}
    </article>
  )
}
