/**
 * UJverse — UsosRegistrationCard: karta rejestracji z live countdown.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Compact card pattern dopasowany do `DiscountCard` (BaseCard + theme).
 *
 * Sztuczki:
 *   - `useTick` re-render co 30s (a co 1s gdy < 5 min) — minimalna praca.
 *   - countdown phase steruje kolorem badge'a i CTA.
 *   - `onSubscribe` jest osobno od `onOpenDetail` (przycisk wewnątrz karty).
 */
import { memo, useEffect, useState } from 'react'
import {
  Bell,
  BellOff,
  BookOpen,
  Bot,
  Clock,
  Dumbbell,
  ExternalLink,
  GraduationCap,
  Languages,
  Radio,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { theme } from '../../styles/theme'
import {
  COUNTDOWN_PHASE_TINT,
  REGISTRATION_KIND_META,
  computeCountdown,
  type UsosRegistration,
} from '../../types/usosRegistrations'

type Props = {
  registration: UsosRegistration
  subscribed: boolean
  onOpenDetail: (id: string) => void
  onToggleSubscribe: (id: string) => void
}

const ICON_MAP = {
  BookOpen,
  Languages,
  Dumbbell,
  GraduationCap,
  Sparkles,
  Tag,
} as const

/** Re-render hook: 30s normalnie, 1s gdy zostało <5min do startu/zakończenia. */
function useCountdownTick(opensAt: string, closesAt: string | null): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const schedule = () => {
      const opens = new Date(opensAt).getTime()
      const closes = closesAt ? new Date(closesAt).getTime() : null
      const now = Date.now()
      // wybierz najbliższy z opens/closes który jest w przyszłości
      const future = [opens, closes].filter((t): t is number => typeof t === 'number' && t > now)
      const nearestMs = future.length ? Math.min(...future) - now : Number.POSITIVE_INFINITY
      const interval = nearestMs <= 5 * 60_000 ? 1000 : 30_000
      timer = setTimeout(() => {
        if (cancelled) return
        setTick((t) => t + 1)
        schedule()
      }, interval)
    }
    schedule()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [opensAt, closesAt])
  return tick
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function UsosRegistrationCardImpl({ registration, subscribed, onOpenDetail, onToggleSubscribe }: Props) {
  useCountdownTick(registration.opens_at, registration.closes_at)
  const countdown = computeCountdown(registration.opens_at, registration.closes_at)
  const kindMeta = REGISTRATION_KIND_META[registration.kind]
  const KindIcon = ICON_MAP[kindMeta.icon]

  const audience = registration.audience_label
    ?? [registration.study_program, registration.year ? `${registration.year} rok` : null].filter(Boolean).join(' · ')
    ?? 'Wszyscy'

  return (
    <BaseCard
      variant="default"
      className="group relative flex h-full flex-col gap-2.5 p-4 transition-shadow hover:shadow-md"
    >
      <button
        type="button"
        onClick={() => onOpenDetail(registration.id)}
        className="absolute inset-0 z-0"
        aria-label={`${registration.title} — szczegóły`}
      />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kindMeta.tint}`}>
          <KindIcon size={11} strokeWidth={2.3} />
          {kindMeta.label}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${COUNTDOWN_PHASE_TINT[countdown.phase]}`}
          title={countdown.label}
        >
          <Clock size={10} strokeWidth={2.3} />
          {countdown.compact}
        </span>
      </div>

      <h3 className={`relative z-10 line-clamp-2 text-[15px] font-bold leading-tight ${theme.text.primary}`}>
        {registration.title}
      </h3>

      <p className={`relative z-10 line-clamp-1 text-[12px] font-semibold leading-snug text-brand-gold dark:text-brand-gold-bright`}>
        {audience}
      </p>

      {registration.description && (
        <p className={`relative z-10 line-clamp-2 text-[12px] leading-snug ${theme.text.muted}`}>
          {registration.description}
        </p>
      )}

      <div className={`relative z-10 flex items-center gap-1.5 text-[11.5px] ${theme.text.muted}`}>
        <Clock size={11} className="shrink-0" />
        <span className="tabular-nums">{fmtDateTime(registration.opens_at)}</span>
        {registration.closes_at && (
          <span className="opacity-70">→ {fmtDateTime(registration.closes_at)}</span>
        )}
      </div>

      <div className={`relative z-10 mt-auto flex items-center justify-between gap-2 pt-2 text-[11.5px] ${theme.text.muted}`}>
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1" title="Liczba subskrybentów alarmu">
            <Users size={12} strokeWidth={2.2} />
            <span className="tabular-nums">{registration.subscriber_count}</span>
          </span>
          {registration.source_usos_tura_id ? (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              title={registration.source_label ?? 'Pobrane na żywo z USOSweb'}
            >
              <Radio size={9} strokeWidth={2.6} />
              Live
            </span>
          ) : registration.source_announcement_id ? (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
              title={registration.source_label ?? 'Wyciągnięte przez AI z ogłoszenia wydziałowego'}
            >
              <Bot size={9} strokeWidth={2.6} />
              AI
            </span>
          ) : null}
        </span>

        <div className="flex items-center gap-1.5">
          <a
            href={registration.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/[0.1]"
            title="Otwórz USOSweb"
          >
            <ExternalLink size={11} strokeWidth={2.4} />
            USOS
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSubscribe(registration.id)
            }}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${
              subscribed
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                : 'bg-brand-gold text-white hover:bg-brand-gold/90 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold-bright/90'
            }`}
            title={subscribed ? 'Anuluj alarm' : 'Włącz alarm'}
          >
            {subscribed ? (
              <>
                <BellOff size={12} strokeWidth={2.6} />
                Alarm
              </>
            ) : (
              <>
                <Bell size={12} strokeWidth={2.6} />
                Alarmuj mnie
              </>
            )}
          </button>
        </div>
      </div>
    </BaseCard>
  )
}

export default memo(UsosRegistrationCardImpl)
