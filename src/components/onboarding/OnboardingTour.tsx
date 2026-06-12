/**
 * UJverse — OnboardingTour: interaktywny tour pierwszaka.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Glassmorphism modal z slajdami:
 *   1. Witaj     — logo.png (mask z brand color, jak w Header / AuthShell)
 *   2. Aula      — czat rocznika
 *   3. Dziś      — daily brief
 *   4. AI        — AnimatedBot (lucide Bot z chat/AnimatedBot.tsx)
 *   5. Couponek  — zniżki studenckie
 *   6. Profil    — uzupełnij + zaproś znajomych
 *
 * Design decisions (po user feedback):
 *   • Kolory STONOWANE — paleta zinc + akcent brand-gold/navy.
 *     Brak jaskrawych gradientów violet/fuchsia/emerald/teal/rose;
 *     spójność z resztą aplikacji (AuthShell, Header, ProfileCard).
 *   • Glassmorphism MIĘKKI — bg-white/95 + backdrop-blur-md
 *     (zamiast /80 + blur-2xl). Border zinc-200/70 + ring zinc-200/40.
 *   • CTA "Dalej" — bg navy / brand-gold (jak primary CTA w app),
 *     z animowaną strzałką (translate-x przy hover/tap, bez Infinity loop).
 *   • ZERO infinite loop animations w tle (raportowane laggi) — wszystkie
 *     animacje są one-shot entry (300 ms). Jedyny wyjątek to AnimatedBot
 *     na AI step (sam jeden element, respektuje prefers-reduced-motion).
 *
 * Layout:
 *   - mobile  (<sm): max-w-md, single column
 *   - desktop (sm+): max-w-2xl (~672px), 2 kolumny (hero | tekst)
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
  type LucideIcon,
  MessagesSquare,
  Sunrise,
  Ticket,
  User,
  X,
} from 'lucide-react'
import AnimatedBot from '../chat/AnimatedBot'

type Step = {
  id: string
  /** Hero rendering: 'logo' = /logo.png mask, 'bot' = AnimatedBot, inaczej lucide. */
  visual: LucideIcon | 'logo' | 'bot'
  title: string
  subtitle: string
  body: string
  ctaLabel?: string
  ctaPath?: string
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    visual: 'logo',
    title: 'Witaj w UJverse',
    subtitle: 'Wszystko, czego potrzebujesz na studiach — w jednym miejscu.',
    body:
      'Aula, plan, ogłoszenia, zniżki i AI asystent. Stworzone przez studenta dla studentów UJ. Damy Ci 60 sekund touru, żebyś wiedział co i gdzie.',
  },
  {
    id: 'aula',
    visual: MessagesSquare,
    title: 'Aula — czat Twojego rocznika',
    subtitle: 'Discord i Teams w jednym. Tylko dla Twojej grupy.',
    body:
      'Logując się mailem uczelnianym automatycznie trafiasz do czatu rocznika. Twórzcie sale tematyczne, dzielcie pliki, prowadźcie wspólne notatki, ankietujcie, nagrywajcie głosówki.',
    ctaLabel: 'Otwórz Aulę',
    ctaPath: '/aula',
  },
  {
    id: 'dzis',
    visual: Sunrise,
    title: '„Dziś" — Twój dzień w 5 sekund',
    subtitle: 'Najszybszy sposób, żeby wiedzieć co jutro.',
    body:
      'Twoje zajęcia, zadania, ogłoszenia wykładowców — w jednym widoku. AI tworzy poranny brief z najważniejszych informacji.',
    ctaLabel: 'Zobacz Dziś',
    ctaPath: '/dzis',
  },
  {
    id: 'ai',
    visual: 'bot',
    title: 'AI Asystent — Twój prywatny tutor',
    subtitle: 'Zapytaj o cokolwiek. Pisz lub mów.',
    body:
      '„Co dzisiaj na zajęciach?", „Streść mi tę dyskusję", „Przetłumacz na angielski". AI zna Twój plan, ogłoszenia i wiadomości w Auli. Whisper przepisze Ci głos.',
  },
  {
    id: 'znizki',
    visual: Ticket,
    title: 'Couponek UJ — zniżki studenckie',
    subtitle: 'Krakowska społeczność dzieli się rabatami.',
    body:
      'Restauracje, kina, fitness, książki — wszystko, gdzie z legitymacją UJ płacisz mniej. Dodawaj swoje, oceniaj cudze, oszczędzaj.',
    ctaLabel: 'Sprawdź zniżki',
    ctaPath: '/znizki',
  },
  {
    id: 'profile',
    visual: User,
    title: 'Skompletuj profil',
    subtitle: 'Awatar + bio = znajomi z roku Cię znajdą.',
    body:
      'Twój profil widzą inni studenci. Awatar, krótkie bio, kierunek — to wystarczy, żeby grupowi koledzy mogli dodać Cię na DM.',
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
        className="fixed inset-0 z-[350] flex items-center justify-center bg-zinc-950/55 px-4 py-6 backdrop-blur-sm sm:py-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          /*
            Czysta solidna karta — bez glassmorphism, bez backdrop-blur,
            bez gradient-tintów. Po prostu surface'owy bg + cień.
            Zinc-200 border w light, white/10 w dark — konsystencja z
            BaseCard / Modal w reszcie aplikacji.
          */
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl sm:max-w-2xl dark:border-white/10 dark:bg-zinc-900"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={shouldReduceMotion ? { duration: 0.18 } : { duration: 0.28, ease: [0.32, 0.72, 0.34, 1] }}
        >

          {/* Top bar — progress + skip */}
          <div className="relative flex items-center justify-between gap-3 border-b border-zinc-200/70 px-4 py-3 sm:px-6 dark:border-white/10">
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <motion.span
                  key={s.id}
                  aria-hidden
                  className={[
                    'h-1.5 rounded-full',
                    i === step
                      ? 'w-8 bg-[#1e293b] dark:bg-brand-gold-bright'
                      : i < step
                        ? 'w-2 bg-zinc-400 dark:bg-zinc-500'
                        : 'w-2 bg-zinc-200 dark:bg-white/10',
                  ].join(' ')}
                  layout
                  transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-100/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
            >
              Pomiń
              <X size={13} />
            </button>
          </div>

          {/* Step body */}
          <div className="relative">
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={current.id}
                custom={direction}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction * 24 }
                }
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -direction * 24 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.18 }
                    : { duration: 0.28, ease: [0.32, 0.72, 0.34, 1] }
                }
                className="grid grid-cols-1 items-center gap-6 px-5 pb-6 pt-8 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-10 sm:px-8 sm:pb-8 sm:pt-10"
              >
                {/* HERO column */}
                <div className="relative flex items-center justify-center">
                  <StepHero step={current} reduceMotion={!!shouldReduceMotion} />
                </div>

                {/* TEXT column */}
                <div className="text-center sm:text-left">
                  <motion.h2
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { delay: 0.04, duration: 0.26 }}
                    className="text-2xl font-extrabold leading-tight tracking-tight text-fg-primary sm:text-[26px]"
                  >
                    {current.title}
                  </motion.h2>
                  <motion.p
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { delay: 0.1, duration: 0.26 }}
                    className="mt-1.5 text-[13.5px] font-semibold text-fg-secondary sm:text-sm"
                  >
                    {current.subtitle}
                  </motion.p>
                  <motion.p
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { delay: 0.16, duration: 0.26 }}
                    className="mt-4 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-300"
                  >
                    {current.body}
                  </motion.p>

                  {current.ctaPath && (
                    <motion.button
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={shouldReduceMotion ? undefined : { delay: 0.22, duration: 0.26 }}
                      type="button"
                      onClick={() => current.ctaPath && visit(current.ctaPath)}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                      className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-[#1e293b] shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 sm:w-auto dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:border-white/15 dark:hover:bg-white/[0.07]"
                    >
                      {current.ctaLabel ?? 'Otwórz'}
                      <ArrowRight
                        size={15}
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer nav */}
          <div className="relative flex items-center justify-between gap-2 border-t border-zinc-200/70 px-4 py-3 sm:px-6 dark:border-white/10">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100/70 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              <ChevronLeft size={15} />
              Wstecz
            </button>
            <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {step + 1} / {STEPS.length}
            </span>
            <NextButton
              isLast={isLast}
              onClick={next}
              reduceMotion={!!shouldReduceMotion}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/* -------------------------------------------------------------------- */
/*  Hero (logo / bot / lucide)                                          */
/* -------------------------------------------------------------------- */

function StepHero({ step, reduceMotion }: { step: Step; reduceMotion: boolean }) {
  // Welcome step ma WIĘKSZE logo i pomijamy glass plate (logo świeci samo,
  // nie potrzebuje tła). Reszta kroków: ikona w neutralnym chip'ie ze
  // statyczną tafelką w tle dla głębi.
  if (step.visual === 'logo') {
    return (
      <div className="relative flex h-48 w-full items-center justify-center sm:h-64 lg:h-72">
        <motion.div
          aria-label="UJverse"
          role="img"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
          transition={reduceMotion ? undefined : { duration: 0.42, ease: [0.32, 0.72, 0.34, 1] }}
          className="h-44 w-60 bg-logo-navy transition-colors duration-150 sm:h-56 sm:w-72 lg:h-64 lg:w-80 dark:bg-brand-gold-bright"
          style={{
            maskImage: 'url(/logo.png)',
            WebkitMaskImage: 'url(/logo.png)',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-44 w-full items-center justify-center sm:h-56">
      {/* Neutralna tafelka w tle — daje głębię bez glassmorphismu */}
      <div
        aria-hidden
        className="absolute inset-x-1 inset-y-1 rounded-3xl bg-zinc-50 dark:bg-white/[0.025]"
      />

      {step.visual === 'bot' ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
          transition={reduceMotion ? undefined : { duration: 0.32 }}
          className="relative z-10 flex h-24 w-24 items-center justify-center rounded-3xl border border-zinc-200 bg-white text-[#1e293b] shadow-sm sm:h-28 sm:w-28 dark:border-white/10 dark:bg-zinc-800 dark:text-brand-gold-bright"
        >
          <AnimatedBot size={48} strokeWidth={1.7} intensity="wave" />
        </motion.div>
      ) : (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
          transition={reduceMotion ? undefined : { duration: 0.32 }}
          className="relative z-10 flex h-24 w-24 items-center justify-center rounded-3xl border border-zinc-200 bg-white text-[#1e293b] shadow-sm sm:h-28 sm:w-28 dark:border-white/10 dark:bg-zinc-800 dark:text-brand-gold-bright"
        >
          {(() => {
            const Icon = step.visual as LucideIcon
            return <Icon size={44} strokeWidth={1.7} />
          })()}
        </motion.div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- */
/*  NextButton — primary CTA z micro-animacją strzałki / completion check */
/* -------------------------------------------------------------------- */

/**
 * NextButton — pill CTA z gradient bg + arrow-chip po prawej (mała kropka
 * z ikoną zamiast goła chevron). Brak idle animacji, na hover:
 *   • shine sweep (skewed light bar leci przez przycisk, 500ms)
 *   • arrow-chip translate-x-1 + bg-white/20
 *   • y -1 + shadow rośnie
 * Inspiracja: Linear / Notion CTA.
 */
function NextButton({
  isLast,
  onClick,
  reduceMotion,
}: {
  isLast: boolean
  onClick: () => void
  reduceMotion: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      transition={reduceMotion ? undefined : { type: 'spring', stiffness: 460, damping: 28 }}
      className={[
        'group relative inline-flex items-center gap-2 overflow-hidden rounded-full pl-5 pr-1.5 py-1.5',
        'text-sm font-bold tracking-tight',
        // Light: gradient navy + soft inner highlight przez ring-inset.
        'bg-gradient-to-b from-[#243043] to-[#0f172a] text-white',
        'shadow-[0_6px_18px_-6px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.10)]',
        'hover:shadow-[0_10px_22px_-6px_rgba(15,23,42,0.65),inset_0_1px_0_0_rgba(255,255,255,0.14)]',
        // Dark: gradient gold.
        'dark:from-brand-gold-bright dark:to-brand-gold dark:text-zinc-950',
        'dark:shadow-[0_6px_18px_-6px_rgba(201,162,39,0.55),inset_0_1px_0_0_rgba(255,255,255,0.25)]',
        'dark:hover:shadow-[0_10px_22px_-6px_rgba(232,200,74,0.7),inset_0_1px_0_0_rgba(255,255,255,0.35)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/40 dark:focus-visible:ring-brand-gold-bright/55',
      ].join(' ')}
    >
      {/* Hover-only shine sweep */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-10 h-full w-10 skew-x-[-20deg] bg-white/20 opacity-0 transition-all duration-600 ease-out group-hover:left-[110%] group-hover:opacity-100 dark:bg-white/35"
      />

      {isLast ? (
        <>
          <span className="relative z-10">Gotowe</span>
          <span
            aria-hidden
            className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/25 dark:bg-black/15 dark:group-hover:bg-black/25"
          >
            <Check size={14} strokeWidth={2.8} />
          </span>
        </>
      ) : (
        <>
          <span className="relative z-10">Dalej</span>
          <span
            aria-hidden
            className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-white/25 dark:bg-black/15 dark:group-hover:bg-black/25"
          >
            <ChevronRight size={14} strokeWidth={2.8} />
          </span>
        </>
      )}
    </motion.button>
  )
}
