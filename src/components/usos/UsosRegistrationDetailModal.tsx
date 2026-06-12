/**
 * UJverse — UsosRegistrationDetailModal: szczegóły rejestracji + subscribe + tips.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Bell,
  BellOff,
  BookOpen,
  Bot,
  Clock,
  Dumbbell,
  ExternalLink,
  GraduationCap,
  Info,
  Languages,
  LightbulbIcon,
  Radio,
  Sparkles,
  Tag,
  Users,
  X,
} from 'lucide-react'
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
  onClose: () => void
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

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function UsosRegistrationDetailModal({ registration, subscribed, onClose, onToggleSubscribe }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  // useEffect uses tick to trigger re-render but the value isn't directly consumed
  void tick

  const countdown = computeCountdown(registration.opens_at, registration.closes_at)
  const kindMeta = REGISTRATION_KIND_META[registration.kind]
  const KindIcon = ICON_MAP[kindMeta.icon]

  const audience = registration.audience_label
    ?? [registration.study_program, registration.year ? `${registration.year} rok` : null].filter(Boolean).join(' · ')
    ?? 'Wszyscy studenci'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={registration.title}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl dark:bg-bg-app"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${kindMeta.tint}`}>
                <KindIcon size={11} strokeWidth={2.3} />
                {kindMeta.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${COUNTDOWN_PHASE_TINT[countdown.phase]}`}
              >
                <Clock size={10} strokeWidth={2.3} />
                {countdown.label}
              </span>
            </div>
            <h2 className={`text-xl font-extrabold leading-tight ${theme.text.primary}`}>
              {registration.title}
            </h2>
            <p className={`text-[12.5px] font-semibold text-brand-gold dark:text-brand-gold-bright`}>
              {audience}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full p-1.5 ${theme.text.muted} hover:bg-zinc-100 dark:hover:bg-white/10`}
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Countdown big */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className={`text-[10.5px] font-semibold uppercase tracking-wide ${theme.text.muted}`}>Otwarcie</p>
              <p className={`mt-1 text-[14px] font-bold tabular-nums ${theme.text.primary}`}>
                {fmtDateTime(registration.opens_at)}
              </p>
              <p className={`mt-0.5 text-[11.5px] ${theme.text.muted}`}>{countdown.compact}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className={`text-[10.5px] font-semibold uppercase tracking-wide ${theme.text.muted}`}>Zamknięcie</p>
              <p className={`mt-1 text-[14px] font-bold tabular-nums ${theme.text.primary}`}>
                {registration.closes_at ? fmtDateTime(registration.closes_at) : '—'}
              </p>
              {registration.closes_at && (
                <p className={`mt-0.5 text-[11.5px] ${theme.text.muted}`}>
                  Zarejestruj się przed!
                </p>
              )}
            </div>
          </div>

          {registration.description && (
            <div className="rounded-2xl bg-zinc-50/70 px-4 py-3 dark:bg-white/[0.03]">
              <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.text.muted}`}>
                <Info size={11} strokeWidth={2.4} /> Szczegóły
              </p>
              <p className={`mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed ${theme.text.primary}`}>
                {registration.description}
              </p>
            </div>
          )}

          {/* Tips */}
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              <LightbulbIcon size={11} strokeWidth={2.4} /> Tipy do rejestracji USOS
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[12.5px] text-amber-900 dark:text-amber-100">
              <li>Otwórz USOSweb 5 min przed startem i bądź zalogowany/a.</li>
              <li>Ustaw zegar na <span className="font-semibold tabular-nums">{countdown.phase === 'closed' ? 'czas startu' : new Date(registration.opens_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span> co do sekundy.</li>
              <li>Najpopularniejsze ćwiczenia/lab topnieją w &lt; 60 sek — kliknij od razu.</li>
              <li>Miej backup wyborów (2-3 alternatywne grupy).</li>
            </ul>
          </div>

          {/* Stats */}
          <div className={`flex flex-wrap items-center gap-4 text-[12px] ${theme.text.muted}`}>
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} strokeWidth={2.3} />
              <span className="tabular-nums">{registration.subscriber_count}</span> osób ma alarm
            </span>
            {registration.source_usos_tura_id ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                title="Wpis pobierany codziennie LIVE z USOSweb"
              >
                <Radio size={12} strokeWidth={2.4} />
                {registration.source_label ?? 'Live · USOSweb'}
              </span>
            ) : registration.source_announcement_id ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-[11.5px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                title="Wpis wygenerowany przez AI z oryginalnego ogłoszenia wydziałowego"
              >
                <Bot size={12} strokeWidth={2.4} />
                {registration.source_label ?? 'AI · ogłoszenie wydziału'}
              </span>
            ) : null}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-bg-app">
          <div className="flex flex-wrap gap-2">
            <a
              href={registration.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1.5 text-[12.5px] font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.1]"
            >
              <ExternalLink size={13} strokeWidth={2.3} />
              USOSweb
            </a>
            {registration.info_url && (
              <a
                href={registration.info_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1.5 text-[12.5px] font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.1]"
              >
                <Info size={13} strokeWidth={2.3} />
                Opis przedmiotów
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => onToggleSubscribe(registration.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-semibold shadow-sm transition-colors ${
              subscribed
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30'
                : 'bg-brand-gold text-white hover:bg-brand-gold/90 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold-bright/90'
            }`}
          >
            {subscribed ? (
              <>
                <BellOff size={13} strokeWidth={2.4} />
                Wyłącz alarm
              </>
            ) : (
              <>
                <Bell size={13} strokeWidth={2.4} />
                Alarmuj mnie
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
