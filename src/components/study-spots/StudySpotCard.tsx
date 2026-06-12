/**
 * UJverse — StudySpotCard: karta miejsca do nauki.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Design 1:1 z `EventCard` — `BaseCard` + hero strefa (foto lub gradient-ikona) +
 * sekcja kontent (kind pill + nazwa + adres + stats + footer rating/CTA).
 * Większy padding, lepsza hierarchia typograficzna, hover lift jak w events.
 */
import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Check, MapPin, Star, Users, Volume2, Wifi, Zap } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { theme } from '../../styles/theme'
import {
  STUDY_SPOT_KIND_META,
  formatTimeRemaining,
  type StudySpotMood,
  type StudySpotWithUserState,
} from '../../types/studySpots'

type Props = {
  spot: StudySpotWithUserState
  onOpen: (spot: StudySpotWithUserState) => void
  onCheckIn: (spotId: string, mood: StudySpotMood) => Promise<{ ok: boolean; error: string | null }>
}

const goldMuted = theme.text.goldMuted

/** Mini-pasek statystyki — ikona + cyfra/5. Hidden gdy brak danych. */
function StatChip({
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
      className="inline-flex items-center gap-1 rounded-full border border-zinc-200/70 bg-zinc-50/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
      title={`${label}: ${value}/${max}`}
    >
      <Icon size={11} strokeWidth={2.3} className={goldMuted} aria-hidden />
      {value}/{max}
    </span>
  )
}

export default function StudySpotCard({ spot, onOpen, onCheckIn }: Props) {
  const meta = STUDY_SPOT_KIND_META[spot.kind]
  const KindIcon = meta.icon
  const isCheckedIn = !!spot.my_active_checkin_id
  const [busy, setBusy] = useState(false)
  const coverUrl = spot.photo_urls[0] ?? null

  // Tick co minutę żeby "wygasa za X" się odświeżał (tylko gdy zameldowany).
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

  return (
    <BaseCard
      as="button"
      type="button"
      interactive
      flush
      onClick={() => onOpen(spot)}
      className="relative flex h-full w-full flex-col overflow-hidden text-left"
    >
      {/* ── Hero strefa: foto lub gradient placeholder z ikoną kind ── */}
      {coverUrl ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          <img src={coverUrl} alt={spot.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      ) : (
        <div className={`relative aspect-[16/10] w-full overflow-hidden ${meta.tintClass}`}>
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <KindIcon size={96} strokeWidth={1.4} aria-hidden />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-black/5 dark:via-black/10 dark:to-black/30" />
        </div>
      )}

      {/* ── Floating badges: kind + live + checkin status ── */}
      <div className="pointer-events-none absolute left-3 top-3 z-[3] flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-md ${meta.tintClass}`}>
          <KindIcon size={11} strokeWidth={2.4} />
          {meta.label}
        </span>
        {!spot.is_free && (
          <span className="inline-flex items-center rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 backdrop-blur-md dark:bg-amber-500/30 dark:text-amber-200">
            Płatne
          </span>
        )}
      </div>

      {spot.active_checkins_count > 0 && (
        <span
          className="pointer-events-none absolute right-3 top-3 z-[3] inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 shadow-sm backdrop-blur-md dark:border-emerald-400/55 dark:bg-emerald-400/15 dark:text-emerald-300"
          aria-label={`${spot.active_checkins_count} osób teraz`}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <Users size={11} strokeWidth={2.4} />
          {spot.active_checkins_count}
        </span>
      )}

      {isCheckedIn && (
        <span
          className="pointer-events-none absolute right-3 bottom-3 z-[3] inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-md"
          aria-label="Jesteś zameldowany tutaj"
        >
          <Check size={11} strokeWidth={3} />
          Jesteś tu
        </span>
      )}

      {/* ── Kontent ── */}
      <div className="relative z-[2] flex flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-fg-primary">
            {spot.name}
          </h3>
          <p className="flex items-center gap-1 text-xs text-fg-secondary line-clamp-1">
            <MapPin size={12} strokeWidth={2.2} className={`shrink-0 ${goldMuted}`} aria-hidden />
            {spot.address}
          </p>
        </div>

        {spot.description && (
          <p className="line-clamp-2 text-[12.5px] leading-relaxed text-fg-secondary">
            {spot.description}
          </p>
        )}

        {(spot.wifi_quality != null || spot.silence_level != null || (spot.sockets_count_estimate ?? 0) > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatChip icon={Wifi} value={spot.wifi_quality} label="Wi-Fi" />
            <StatChip icon={Volume2} value={spot.silence_level} label="Cisza" />
            {spot.sockets_count_estimate != null && spot.sockets_count_estimate > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200/70 bg-zinc-50/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                title="Szacunkowa liczba gniazdek"
              >
                <Zap size={11} strokeWidth={2.3} className={goldMuted} aria-hidden />
                {spot.sockets_count_estimate}+
              </span>
            )}
          </div>
        )}

        {/* Footer: rating + check-in CTA */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="inline-flex items-center gap-1 text-xs" title="Średnia ocena">
            <Star
              size={14}
              strokeWidth={2.2}
              className={spot.rating_avg ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'}
              aria-hidden
            />
            {spot.rating_avg ? (
              <>
                <span className="tabular-nums font-bold text-fg-primary">
                  {spot.rating_avg.toFixed(1)}
                </span>
                <span className="tabular-nums text-fg-secondary">({spot.rating_count})</span>
              </>
            ) : (
              <span className="text-fg-secondary">Brak ocen</span>
            )}
          </span>

          <button
            type="button"
            onClick={handleToggleCheckin}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              isCheckedIn
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'border border-zinc-300 bg-white text-zinc-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/15 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:border-emerald-400/50 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
            } ${busy ? 'opacity-60 cursor-wait' : ''}`}
            title={isCheckedIn ? `Wymelduj (zostało ${formatTimeRemaining(spot.my_active_checkin_expires_at ?? new Date().toISOString())})` : 'Zamelduj się tutaj'}
          >
            {isCheckedIn ? (
              <>
                <Check size={12} strokeWidth={2.8} />
                Wymelduj
              </>
            ) : (
              <>
                <Bookmark size={12} strokeWidth={2.6} />
                Jestem tu
              </>
            )}
          </button>
        </div>
      </div>
    </BaseCard>
  )
}
