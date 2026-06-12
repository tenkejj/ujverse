/**
 * UJverse — StudySpotDetailModal: szczegóły miejsca + rating form.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  Clock3,
  ExternalLink,
  MapPin,
  Star,
  Users,
  Volume2,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { theme } from '../../styles/theme'
import {
  MOOD_META,
  STUDY_SPOT_KIND_META,
  STUDY_SPOT_MOODS,
  formatTimeRemaining,
  type StudySpotMood,
  type StudySpotWithUserState,
} from '../../types/studySpots'
import ActiveCheckinsList from './ActiveCheckinsList'
import StudySpotPhotos from './StudySpotPhotos'

type Props = {
  spot: StudySpotWithUserState | null
  currentUserId: string | null
  onClose: () => void
  onCheckIn: (
    spotId: string,
    mood: StudySpotMood,
  ) => Promise<{ ok: boolean; error: string | null }>
  onSubmitRating: (
    spotId: string,
    overall: number,
    extra?: { comment?: string | null },
  ) => Promise<{ ok: boolean; error: string | null }>
  onUploadPhoto: (
    spotId: string,
    file: File,
  ) => Promise<{ publicUrl: string | null; error: string | null }>
  onRemovePhoto: (
    spotId: string,
    photoUrl: string,
  ) => Promise<{ error: string | null }>
  onNavigateToProfile?: (username: string) => void
}

function StarPicker({
  value,
  onChange,
  size = 22,
}: {
  value: number
  onChange: (v: number) => void
  size?: number
}) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Ocena gwiazdkowa">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            role="radio"
            aria-checked={active}
            aria-label={`${n} gwiazd${n === 1 ? 'ka' : n < 5 ? 'ki' : 'ek'}`}
            className="rounded-full p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
          >
            <Star
              size={size}
              strokeWidth={2}
              className={
                active
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-zinc-300 dark:text-white/20'
              }
            />
          </button>
        )
      })}
    </div>
  )
}

export default function StudySpotDetailModal({
  spot,
  currentUserId,
  onClose,
  onCheckIn,
  onSubmitRating,
  onUploadPhoto,
  onRemovePhoto,
  onNavigateToProfile,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [selectedMood, setSelectedMood] = useState<StudySpotMood>('focus')
  const [ratingValue, setRatingValue] = useState<number>(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSaved, setRatingSaved] = useState(false)

  useEffect(() => {
    if (spot) {
      setRatingValue(spot.my_rating ?? 0)
      setRatingComment('')
      setRatingSaved(false)
      setSelectedMood((spot.my_active_checkin_mood as StudySpotMood) ?? 'focus')
    }
  }, [spot])

  const handleToggleCheckin = useCallback(async () => {
    if (!spot || busy) return
    setBusy(true)
    try {
      await onCheckIn(spot.id, selectedMood)
    } finally {
      setBusy(false)
    }
  }, [spot, busy, onCheckIn, selectedMood])

  const handleSaveRating = useCallback(async () => {
    if (!spot || ratingValue === 0 || busy) return
    setBusy(true)
    try {
      const result = await onSubmitRating(spot.id, ratingValue, {
        comment: ratingComment.trim() || null,
      })
      if (result.ok) {
        setRatingSaved(true)
        setTimeout(() => setRatingSaved(false), 1800)
      }
    } finally {
      setBusy(false)
    }
  }, [spot, ratingValue, ratingComment, busy, onSubmitRating])

  return (
    <AnimatePresence>
      {spot && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:rounded-3xl dark:bg-zinc-950"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200/70 px-5 py-4 dark:border-white/10">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const meta = STUDY_SPOT_KIND_META[spot.kind]
                    const KindIcon = meta.icon
                    return (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.tintClass}`}>
                        <KindIcon size={11} strokeWidth={2.3} />
                        {meta.label}
                      </span>
                    )
                  })()}
                  {!spot.is_free && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      Płatne · {spot.price_hint ?? '—'}
                    </span>
                  )}
                </div>
                <h2 className={`text-xl font-bold ${theme.text.primary}`}>{spot.name}</h2>
                <p className={`flex items-center gap-1.5 text-[12.5px] ${theme.text.muted}`}>
                  <MapPin size={13} strokeWidth={2.2} />
                  {spot.address}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                aria-label="Zamknij"
              >
                <X size={20} strokeWidth={2.2} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5">
                {/* Stats */}
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300">
                    <Users size={12} strokeWidth={2.3} />
                    <span className="tabular-nums font-semibold">{spot.active_checkins_count}</span> uczy się teraz
                  </span>
                  {spot.rating_avg && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      <Star size={12} strokeWidth={2.3} className="fill-amber-500 text-amber-500" />
                      <span className="tabular-nums font-bold">{spot.rating_avg.toFixed(1)}</span>
                      <span className="tabular-nums text-amber-700/70 dark:text-amber-400/70">({spot.rating_count})</span>
                    </span>
                  )}
                  {spot.hours_text && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300">
                      <Clock3 size={12} strokeWidth={2.3} />
                      {spot.hours_text}
                    </span>
                  )}
                </div>

                {/* Description */}
                {spot.description && (
                  <p className={`text-[13.5px] leading-relaxed ${theme.text.primary}`}>
                    {spot.description}
                  </p>
                )}

                {/* Kategorie */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {spot.wifi_quality != null && (
                    <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-white/[0.04]">
                      <Wifi size={16} strokeWidth={2} className="text-sky-600 dark:text-sky-400" />
                      <div className="flex flex-col">
                        <span className={`text-[10px] uppercase tracking-wide ${theme.text.muted}`}>Wi-Fi</span>
                        <span className="text-[13px] font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
                          {spot.wifi_quality}/5
                        </span>
                      </div>
                    </div>
                  )}
                  {spot.silence_level != null && (
                    <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-white/[0.04]">
                      <Volume2 size={16} strokeWidth={2} className="text-violet-600 dark:text-violet-400" />
                      <div className="flex flex-col">
                        <span className={`text-[10px] uppercase tracking-wide ${theme.text.muted}`}>Cisza</span>
                        <span className="text-[13px] font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
                          {spot.silence_level}/5
                        </span>
                      </div>
                    </div>
                  )}
                  {spot.sockets_count_estimate != null && (
                    <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-white/[0.04]">
                      <Zap size={16} strokeWidth={2} className="text-amber-600 dark:text-amber-400" />
                      <div className="flex flex-col">
                        <span className={`text-[10px] uppercase tracking-wide ${theme.text.muted}`}>Gniazdka</span>
                        <span className="text-[13px] font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
                          {spot.sockets_count_estimate}+
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {spot.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {spot.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-white/[0.04] dark:text-zinc-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Check-in section */}
                <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                  <h3 className="mb-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    {spot.my_active_checkin_id ? '✅ Jesteś tu' : 'Zamelduj się'}
                  </h3>
                  <p className={`mb-3 text-[12px] ${theme.text.muted}`}>
                    {spot.my_active_checkin_id
                      ? `Automatyczne wymeldowanie za ${formatTimeRemaining(spot.my_active_checkin_expires_at!)}.`
                      : 'Daj znać że jesteś tutaj — inni studenci zobaczą "live presence".'}
                  </p>

                  {!spot.my_active_checkin_id && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {STUDY_SPOT_MOODS.map((mood) => {
                        const m = MOOD_META[mood]
                        const active = selectedMood === mood
                        return (
                          <button
                            key={mood}
                            type="button"
                            onClick={() => setSelectedMood(mood)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                              active
                                ? m.tintClass + ' ring-2 ring-emerald-400'
                                : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]'
                            }`}
                          >
                            <span>{m.emoji}</span>
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleCheckin}
                    disabled={busy}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-bold uppercase tracking-wide transition-colors ${
                      spot.my_active_checkin_id
                        ? 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1]'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'
                    } ${busy ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    {spot.my_active_checkin_id ? 'Wymelduj' : 'Zamelduj się'}
                  </button>
                </div>

                {/* Rating */}
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
                  <h3 className="mb-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                    {spot.my_rating ? 'Twoja ocena' : 'Oceń to miejsce'}
                  </h3>
                  <p className={`mb-3 text-[12px] ${theme.text.muted}`}>
                    Pomagasz innym studentom znaleźć fajne miejsca do nauki.
                  </p>

                  <StarPicker value={ratingValue} onChange={setRatingValue} />

                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Komentarz (opcjonalnie) — np. 'cicho rano, głośno po południu, dużo gniazdek'"
                    maxLength={500}
                    rows={2}
                    className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12.5px] text-zinc-700 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-200"
                  />

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleSaveRating}
                      disabled={ratingValue === 0 || busy}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-amber-500 px-4 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {ratingSaved ? (
                        <>
                          <Check size={12} strokeWidth={2.6} />
                          Zapisano
                        </>
                      ) : spot.my_rating ? (
                        'Zaktualizuj'
                      ) : (
                        'Zapisz'
                      )}
                    </button>
                    <span className={`text-[10.5px] tabular-nums ${theme.text.muted}`}>
                      {ratingComment.length}/500
                    </span>
                  </div>
                </div>

                {/* Active check-ins (kto teraz tutaj jest) */}
                <ActiveCheckinsList
                  spotId={spot.id}
                  expectedCount={spot.active_checkins_count}
                  onNavigateToProfile={onNavigateToProfile}
                />

                {/* Photos: gallery + uploader */}
                <StudySpotPhotos
                  spotId={spot.id}
                  photos={spot.photo_urls}
                  canUpload={!!currentUserId}
                  onUpload={(file) => onUploadPhoto(spot.id, file)}
                  onRemove={(url) => onRemovePhoto(spot.id, url)}
                />

                {/* External links */}
                {(spot.google_maps_url || spot.website_url) && (
                  <div className="flex flex-wrap gap-2">
                    {spot.google_maps_url && (
                      <a
                        href={spot.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 hover:border-blue-400 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                      >
                        <MapPin size={12} strokeWidth={2.3} />
                        Google Maps
                        <ExternalLink size={10} strokeWidth={2.3} />
                      </a>
                    )}
                    {spot.website_url && (
                      <a
                        href={spot.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 hover:border-blue-400 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                      >
                        Strona
                        <ExternalLink size={10} strokeWidth={2.3} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
