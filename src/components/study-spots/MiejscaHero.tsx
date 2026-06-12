/**
 * UJverse — MiejscaHero: spotlight najlepszego miejsca do nauki na top widoku.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * 1:1 z `EventsHero` (same klasy `EVENTS_HUB.hero`):
 *   - md+: split 3:2 — lewa kolumna foto/gradient z ikoną kind, prawa meta + CTA.
 *   - sm:  pojedyncza kolumna.
 *
 * Wybór hero: best of (`active_checkins_count` > 0 + `rating_avg` najlepszy)
 * → fallback najlepiej oceniony → fallback alfabetycznie. Logika w `MiejscaNaukiView`.
 */
import { ArrowRight, MapPin, Sparkles, Star, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { EVENTS_HUB } from '../../styles/mobile-theme'
import { theme } from '../../styles/theme'
import {
  STUDY_SPOT_KIND_META,
  type StudySpotWithUserState,
} from '../../types/studySpots'

type Props = {
  spot: StudySpotWithUserState
  onOpen: (spot: StudySpotWithUserState) => void
}

const H = EVENTS_HUB.hero

export default function MiejscaHero({ spot, onOpen }: Props) {
  const meta = STUDY_SPOT_KIND_META[spot.kind]
  const KindIcon = meta.icon
  const cover = spot.photo_urls[0] ?? null
  const hasLive = spot.active_checkins_count > 0

  return (
    <motion.section
      variants={EVENTS_HUB.motion.fadeUp}
      className={H.cardClass}
      aria-label="Polecane miejsce do nauki"
    >
      <div className={H.gridClass}>
        {cover ? (
          <div className={H.posterWrapClass}>
            <img src={cover} alt={spot.name} className={H.posterImgClass} />
            <div className={H.posterShadeClass} aria-hidden />
            <span className={H.eyebrowFloatClass}>
              <Sparkles size={12} strokeWidth={2.5} aria-hidden />
              Polecane teraz
            </span>
          </div>
        ) : (
          <div className={`${H.posterFallbackClass} ${meta.tintClass}`}>
            <span className={H.eyebrowFloatClass}>
              <Sparkles size={12} strokeWidth={2.5} aria-hidden />
              Polecane teraz
            </span>
            <div className="relative z-[1] flex flex-col items-center gap-2 px-6 text-center opacity-90">
              <KindIcon size={84} strokeWidth={1.4} aria-hidden />
              <span className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme.text.goldMuted}`}>
                {meta.label}
              </span>
            </div>
          </div>
        )}

        <div className={H.metaWrapClass}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.tintClass}`}>
              <KindIcon size={11} strokeWidth={2.4} />
              {meta.label}
            </span>
            {hasLive && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-400/55 dark:bg-emerald-400/15 dark:text-emerald-300">
                <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Live · {spot.active_checkins_count}
              </span>
            )}
            {!spot.is_free && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                Płatne
              </span>
            )}
          </div>

          <h2 className={H.titleClass}>{spot.name}</h2>

          <p className={H.metaRowClass}>
            <MapPin size={16} strokeWidth={2} className={H.metaIconClass} aria-hidden />
            <span className="min-w-0 truncate">{spot.address}</span>
          </p>

          {spot.rating_avg != null && (
            <p className={H.metaRowClass}>
              <Star size={16} strokeWidth={2} className="shrink-0 fill-amber-400 text-amber-400" aria-hidden />
              <span>
                <span className="font-bold tabular-nums">{spot.rating_avg.toFixed(1)}</span>{' '}
                <span className="tabular-nums">({spot.rating_count} ocen)</span>
              </span>
            </p>
          )}

          {hasLive && (
            <p className={H.metaRowClass}>
              <Users size={16} strokeWidth={2} className={H.metaIconClass} aria-hidden />
              <span>
                <span className="font-bold tabular-nums">{spot.active_checkins_count}</span>{' '}
                {spot.active_checkins_count === 1 ? 'osoba teraz' : 'osób teraz'} się tu uczy
              </span>
            </p>
          )}

          {spot.description && (
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 line-clamp-3">
              {spot.description}
            </p>
          )}

          <div className={H.actionsRowClass}>
            <button
              type="button"
              onClick={() => onOpen(spot)}
              className={`${theme.button.primary} px-5 py-2.5 text-sm`}
            >
              Zobacz szczegóły
              <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
            </button>
            {spot.google_maps_url && (
              <a
                href={spot.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`${theme.button.outline} px-4 py-2.5 text-sm`}
              >
                Pokaż na mapie
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
