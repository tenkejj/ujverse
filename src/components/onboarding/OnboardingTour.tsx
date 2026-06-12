/**
 * UJverse — OnboardingTour: interaktywny tour pierwszaka.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Glassmorphism modal z slajdami przedstawiającymi kluczowe sekcje:
 *   1. Witaj                  — branding + greeting
 *   2. Aula                   — czat rocznika (z fake-message preview)
 *   3. Dziś                   — daily brief
 *   4. AI Asystent            — `AnimatedBot` z `chat/AnimatedBot.tsx`
 *   5. Couponek UJ            — zniżki studenckie (z mock-card preview)
 *   6. Profil                 — uzupełnij + zaproś
 *
 * Layout:
 *   - mobile  (<sm): `max-w-md`, padding gęstszy
 *   - desktop (sm+): `max-w-2xl` (≈672 px) — sporo miejsca na ikonę-hero,
 *     dwukolumnowy layout (hero po lewej, treść po prawej)
 *
 * Animacje:
 *   - 2 unoszące się "blob" w tle (różne osie + opóźnienia)
 *   - ikona-hero floating loop (y: -6→6, scale 1→1.04)
 *   - tekst per-step entry: y+opacity z opóźnieniem (stagger)
 *   - per-step `interactive` mock preview (Aula/Couponek), animowany
 *
 * Po ukończeniu: `onComplete()` ustawia `profiles.onboarding_completed_at`.
 * "Pomiń" → `onboarding_skipped_at`.
 */
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Heart,
  type LucideIcon,
  MessagesSquare,
  Sparkles,
  Sunrise,
  Ticket,
  User,
  X,
} from 'lucide-react'
import AnimatedBot from '../chat/AnimatedBot'

type Step = {
  id: string
  icon: LucideIcon | 'bot'
  /** Tailwind `from-…to-…` dla gradient pierścienia ikony. */
  iconGradient: string
  /** Tailwind `from-…/X via-…/Y to-…/Z` dla blob tła (subtelny). */
  bgBlob: string
  title: string
  subtitle: string
  body: string
  ctaLabel?: string
  ctaPath?: string
  /** Komponent demo wyświetlany w kolumnie hero (mock kart/messageów). */
  preview: 'logo' | 'aula' | 'dzis' | 'ai' | 'znizki' | 'profile'
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    icon: GraduationCap,
    iconGradient: 'from-indigo-500 to-violet-600',
    bgBlob: 'from-indigo-400/30 via-violet-400/20 to-fuchsia-400/30',
    title: 'Witaj w UJverse',
    subtitle: 'Wszystko, czego potrzebujesz na studiach — w jednym miejscu.',
    body:
      'Aula, plan, ogłoszenia, zniżki i AI asystent. Stworzone przez studenta dla studentów UJ. Damy Ci 60 sekund touru, żebyś wiedział co i gdzie.',
    preview: 'logo',
  },
  {
    id: 'aula',
    icon: MessagesSquare,
    iconGradient: 'from-emerald-500 to-teal-600',
    bgBlob: 'from-emerald-400/25 via-teal-400/20 to-cyan-400/25',
    title: 'Aula — czat Twojego rocznika',
    subtitle: 'Discord i Teams w jednym. Tylko dla Twojej grupy.',
    body:
      'Logując się mailem uczelnianym automatycznie trafiasz do czatu rocznika. Twórzcie sale tematyczne, dzielcie pliki, prowadźcie wspólne notatki, ankietujcie, nagrywajcie głosówki.',
    ctaLabel: 'Otwórz Aulę',
    ctaPath: '/aula',
    preview: 'aula',
  },
  {
    id: 'dzis',
    icon: Sunrise,
    iconGradient: 'from-amber-500 to-orange-500',
    bgBlob: 'from-amber-400/30 via-orange-400/20 to-rose-400/25',
    title: '„Dziś" — Twój dzień w 5 sekund',
    subtitle: 'Najszybszy sposób, żeby wiedzieć co jutro.',
    body:
      'Twoje zajęcia, zadania, ogłoszenia wykładowców — w jednym widoku. AI tworzy poranny brief z najważniejszych informacji.',
    ctaLabel: 'Zobacz Dziś',
    ctaPath: '/dzis',
    preview: 'dzis',
  },
  {
    id: 'ai',
    icon: 'bot',
    iconGradient: 'from-violet-500 to-fuchsia-600',
    bgBlob: 'from-violet-400/30 via-fuchsia-400/20 to-pink-400/25',
    title: 'AI Asystent — Twój prywatny tutor',
    subtitle: 'Zapytaj o cokolwiek. Pisz lub mów.',
    body:
      '„Co dzisiaj na zajęciach?", „Streść mi tę dyskusję", „Przetłumacz na angielski". AI zna Twój plan, ogłoszenia i wiadomości w Auli. Whisper przepisze Ci głos.',
    preview: 'ai',
  },
  {
    id: 'znizki',
    icon: Ticket,
    iconGradient: 'from-rose-500 to-pink-600',
    bgBlob: 'from-rose-400/25 via-pink-400/20 to-fuchsia-400/25',
    title: 'Couponek UJ — zniżki studenckie',
    subtitle: 'Krakowska społeczność dzieli się rabatami.',
    body:
      'Restauracje, kina, fitness, książki — wszystko, gdzie z legitymacją UJ płacisz mniej. Dodawaj swoje, oceniaj cudze, oszczędzaj.',
    ctaLabel: 'Sprawdź zniżki',
    ctaPath: '/znizki',
    preview: 'znizki',
  },
  {
    id: 'profile',
    icon: User,
    iconGradient: 'from-sky-500 to-cyan-600',
    bgBlob: 'from-sky-400/25 via-cyan-400/20 to-teal-400/25',
    title: 'Skompletuj profil',
    subtitle: 'Awatar + bio = znajomi z roku Cię znajdą.',
    body:
      'Twój profil widzą inni studenci. Awatar, krótkie bio, kierunek — to wystarczy, żeby grupowi koledzy mogli dodać Cię na DM.',
    preview: 'profile',
  },
]

type Props = {
  onComplete: () => void
  onSkip: () => void
}

export default function OnboardingTour({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const shouldReduceMotion = useReducedMotion()
  const navigate = useNavigate()

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  const next = () => {
    if (isLast) {
      onComplete()
    } else {
      setDirection(1)
      setStep((s) => Math.min(STEPS.length - 1, s + 1))
    }
  }
  const prev = () => {
    setDirection(-1)
    setStep((s) => Math.max(0, s - 1))
  }
  const visit = (path: string) => {
    navigate(path)
    onComplete()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Wprowadzenie do UJverse"
        className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md sm:py-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0.15 } : { duration: 0.25 }}
      >
        <motion.div
          /* GLASSMORPHISM SHELL — bg białe z półprzezroczystością, gruby blur,
             subtelne border + inner highlight przez ring. */
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/40 bg-white/80 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-white/60 backdrop-blur-2xl sm:max-w-2xl dark:border-white/10 dark:bg-zinc-900/70 dark:ring-white/10"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.95 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          transition={shouldReduceMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 320, damping: 30 }}
        >
          {/* Decoratory tła — 2 unoszące się blob'y per step (gradient zmienia się przez current.bgBlob) */}
          <FloatingBlobs gradient={current.bgBlob} reduceMotion={!!shouldReduceMotion} />

          {/* Top bar — progress + skip */}
          <div className="relative flex items-center justify-between gap-3 border-b border-white/40 px-4 py-3 sm:px-6 dark:border-white/10">
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <motion.span
                  key={s.id}
                  aria-hidden
                  className={[
                    'h-1.5 rounded-full',
                    i === step
                      ? 'w-8 bg-gradient-to-r from-violet-500 to-fuchsia-500 dark:from-violet-400 dark:to-fuchsia-400'
                      : i < step
                        ? 'w-2 bg-violet-300 dark:bg-violet-500/60'
                        : 'w-2 bg-zinc-300/60 dark:bg-white/15',
                  ].join(' ')}
                  layout
                  transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 28 }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-zinc-500 transition-colors hover:bg-black/[0.05] hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100"
            >
              Pomiń
              <X size={13} />
            </button>
          </div>

          {/* Step body — 1 col mobile, 2 col od sm */}
          <div className="relative">
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={current.id}
                custom={direction}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction * 32 }
                }
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -direction * 32 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.18 }
                    : { type: 'spring', stiffness: 280, damping: 30 }
                }
                className="grid grid-cols-1 items-center gap-6 px-5 pb-6 pt-7 sm:grid-cols-[260px_minmax(0,1fr)] sm:gap-8 sm:px-8 sm:pb-8 sm:pt-10"
              >
                {/* HERO column — ikona + preview */}
                <div className="relative flex items-center justify-center">
                  <StepHero step={current} reduceMotion={!!shouldReduceMotion} />
                </div>

                {/* TEXT column */}
                <div className="text-center sm:text-left">
                  <motion.h2
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? { duration: 0.18 } : { delay: 0.05, duration: 0.32 }}
                    className="text-2xl font-extrabold leading-tight tracking-tight text-fg-primary sm:text-[26px]"
                  >
                    {current.title}
                  </motion.h2>
                  <motion.p
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? { duration: 0.2 } : { delay: 0.12, duration: 0.32 }}
                    className="mt-1.5 text-[13.5px] font-semibold text-fg-secondary sm:text-sm"
                  >
                    {current.subtitle}
                  </motion.p>
                  <motion.p
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? { duration: 0.22 } : { delay: 0.18, duration: 0.32 }}
                    className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-300"
                  >
                    {current.body}
                  </motion.p>

                  {current.ctaPath && (
                    <motion.button
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      transition={shouldReduceMotion ? { duration: 0.22 } : { delay: 0.24, duration: 0.32 }}
                      type="button"
                      onClick={() => current.ctaPath && visit(current.ctaPath)}
                      className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${current.iconGradient} px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition-transform hover:scale-[1.02] sm:w-auto`}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                    >
                      {current.ctaLabel ?? 'Otwórz'}
                      <ArrowRight size={15} />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer nav */}
          <div className="relative flex items-center justify-between gap-2 border-t border-white/40 px-4 py-3 sm:px-6 dark:border-white/10">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-white/[0.08]"
            >
              <ChevronLeft size={15} />
              Wstecz
            </button>
            <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {step + 1} / {STEPS.length}
            </span>
            <motion.button
              type="button"
              onClick={next}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1e293b] px-4 py-2 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.03] dark:bg-brand-gold dark:text-black"
            >
              {isLast ? (
                <>
                  <Check size={15} />
                  Gotowe
                </>
              ) : (
                <>
                  Dalej
                  <ChevronRight size={15} />
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/* -------------------------------------------------------------------- */
/*  Sub-components                                                       */
/* -------------------------------------------------------------------- */

function FloatingBlobs({ gradient, reduceMotion }: { gradient: string; reduceMotion: boolean }) {
  return (
    <>
      <motion.div
        aria-hidden
        className={`pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br ${gradient} blur-3xl`}
        animate={
          reduceMotion
            ? undefined
            : { y: [0, 14, 0], x: [0, -10, 0], scale: [1, 1.05, 1] }
        }
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className={`pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-gradient-to-br ${gradient} opacity-70 blur-3xl`}
        animate={
          reduceMotion
            ? undefined
            : { y: [0, -16, 0], x: [0, 12, 0], scale: [1, 1.06, 1] }
        }
        transition={{ duration: 11, delay: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  )
}

function StepHero({ step, reduceMotion }: { step: Step; reduceMotion: boolean }) {
  return (
    <div className="relative flex h-44 w-full items-center justify-center sm:h-56">
      {/* Glass plate behind hero */}
      <div
        aria-hidden
        className="absolute inset-x-2 inset-y-2 rounded-3xl border border-white/50 bg-white/40 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]"
      />

      {/* Floating big icon */}
      <motion.div
        className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br ${step.iconGradient} text-white shadow-[0_15px_35px_-12px_rgba(99,102,241,0.55)] ring-2 ring-white/40 sm:h-28 sm:w-28`}
        animate={
          reduceMotion
            ? undefined
            : { y: [-6, 6, -6], rotate: [-1.5, 1.5, -1.5] }
        }
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {step.icon === 'bot' ? (
          <AnimatedBot size={48} strokeWidth={1.7} intensity="wave" />
        ) : (
          <step.icon size={44} strokeWidth={1.7} />
        )}
      </motion.div>

      {/* Per-step mini preview (mock cards) — overlay nad ikoną */}
      <PreviewMock kind={step.preview} reduceMotion={reduceMotion} />
    </div>
  )
}

/**
 * Mock-up overlay per step — pływające karty/wiadomości/bańki które
 * sugerują jak wygląda dana sekcja. Wszystko 100% client-side, zero fetch.
 */
function PreviewMock({ kind, reduceMotion }: { kind: Step['preview']; reduceMotion: boolean }) {
  if (kind === 'logo') {
    return (
      <>
        <FloatBadge text="UJ" className="-left-2 top-2 sm:left-0" delay={0.3} reduceMotion={reduceMotion} />
        <FloatBadge text="🎓" className="-right-2 bottom-3 sm:right-0" delay={0.6} reduceMotion={reduceMotion} />
      </>
    )
  }
  if (kind === 'aula') {
    return (
      <>
        <FloatBubble className="-left-3 top-3 sm:-left-1" delay={0.3} reduceMotion={reduceMotion}>
          <span className="font-semibold">Anna</span> rzuciła pytanie o egzamin
        </FloatBubble>
        <FloatBubble className="-right-2 bottom-2 sm:right-0" delay={0.6} reduceMotion={reduceMotion} variant="me">
          Materiały są w 📌 przypiętej notatce
        </FloatBubble>
      </>
    )
  }
  if (kind === 'dzis') {
    return (
      <>
        <FloatPill className="-left-1 top-2 sm:left-0" delay={0.3} reduceMotion={reduceMotion} icon="🕘">
          09:45 · Analiza matematyczna
        </FloatPill>
        <FloatPill className="-right-1 bottom-2 sm:right-0" delay={0.6} reduceMotion={reduceMotion} icon="📋">
          1 zadanie do oddania
        </FloatPill>
      </>
    )
  }
  if (kind === 'ai') {
    return (
      <>
        <FloatBubble className="-left-3 top-3 sm:-left-1" delay={0.3} reduceMotion={reduceMotion}>
          <Sparkles size={11} className="-mt-0.5 mr-1 inline" />
          „Streść mi ten kanał"
        </FloatBubble>
        <FloatBubble className="-right-2 bottom-1 sm:right-0" delay={0.55} reduceMotion={reduceMotion} variant="ai">
          5 wykładowców, 3 deadliny…
        </FloatBubble>
      </>
    )
  }
  if (kind === 'znizki') {
    return (
      <>
        <FloatPill className="-left-2 top-3 sm:-left-1" delay={0.3} reduceMotion={reduceMotion} icon="☕">
          -20% w Cafe Camelot
        </FloatPill>
        <FloatPill className="-right-2 bottom-2 sm:right-0" delay={0.6} reduceMotion={reduceMotion} icon="🎬">
          Kino studyjne -50%
        </FloatPill>
      </>
    )
  }
  // profile
  return (
    <>
      <FloatBadge text="@franek" className="-left-3 top-2 sm:-left-1" delay={0.3} reduceMotion={reduceMotion} />
      <FloatPill className="-right-3 bottom-3 sm:-right-1" delay={0.55} reduceMotion={reduceMotion} icon={<Heart size={11} className="text-rose-500" />}>
        3 znajomych z roku
      </FloatPill>
    </>
  )
}

/* ─ Floating UI primitives (glassmorphism mini-elements) ────────────────── */

function FloatBadge({
  text,
  className,
  delay,
  reduceMotion,
}: {
  text: string
  className: string
  delay: number
  reduceMotion: boolean
}) {
  return (
    <motion.span
      className={`absolute z-20 inline-flex items-center rounded-full border border-white/60 bg-white/80 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-100 ${className}`}
      initial={{ opacity: 0, y: 14, scale: 0.85 }}
      animate={
        reduceMotion
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 1, y: [0, -6, 0], scale: 1 }
      }
      transition={
        reduceMotion
          ? { delay, duration: 0.25 }
          : { delay, y: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.4 }, scale: { duration: 0.4 } }
      }
    >
      {text}
    </motion.span>
  )
}

function FloatBubble({
  children,
  className,
  delay,
  reduceMotion,
  variant = 'them',
}: {
  children: React.ReactNode
  className: string
  delay: number
  reduceMotion: boolean
  variant?: 'them' | 'me' | 'ai'
}) {
  const tone =
    variant === 'me'
      ? 'bg-gradient-to-br from-emerald-500/90 to-teal-600/90 text-white border-white/30'
      : variant === 'ai'
        ? 'bg-gradient-to-br from-violet-500/90 to-fuchsia-600/90 text-white border-white/30'
        : 'bg-white/85 text-zinc-800 border-white/60 dark:bg-zinc-800/80 dark:text-zinc-100 dark:border-white/10'
  return (
    <motion.div
      className={`absolute z-20 max-w-[180px] rounded-2xl border px-3 py-1.5 text-[11.5px] leading-snug shadow-lg backdrop-blur-md ${tone} ${className}`}
      initial={{ opacity: 0, y: 16, scale: 0.9 }}
      animate={
        reduceMotion
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 1, y: [0, -5, 0], scale: 1 }
      }
      transition={
        reduceMotion
          ? { delay, duration: 0.25 }
          : { delay, y: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.4 }, scale: { duration: 0.4 } }
      }
    >
      {children}
    </motion.div>
  )
}

function FloatPill({
  children,
  className,
  delay,
  reduceMotion,
  icon,
}: {
  children: React.ReactNode
  className: string
  delay: number
  reduceMotion: boolean
  icon?: React.ReactNode
}) {
  return (
    <motion.span
      className={`absolute z-20 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/85 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-800 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-100 ${className}`}
      initial={{ opacity: 0, y: 16, scale: 0.85 }}
      animate={
        reduceMotion
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 1, y: [0, -5, 0], scale: 1 }
      }
      transition={
        reduceMotion
          ? { delay, duration: 0.25 }
          : { delay, y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.4 }, scale: { duration: 0.4 } }
      }
    >
      {icon ? <span className="-ml-0.5">{icon}</span> : null}
      {children}
    </motion.span>
  )
}
