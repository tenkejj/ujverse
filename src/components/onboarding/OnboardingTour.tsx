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
    body: 'Damy Ci 60 sekund touru, żebyś wiedział co i gdzie.',
  },
  {
    id: 'aula',
    visual: MessagesSquare,
    title: 'Aula',
    subtitle: 'Czat Twojego rocznika. Discord i Teams w jednym.',
    body: 'Sale tematyczne, pliki, wspólne notatki, ankiety, głosówki — dla całej grupy.',
    ctaLabel: 'Otwórz Aulę',
    ctaPath: '/aula',
  },
  {
    id: 'dzis',
    visual: Sunrise,
    title: 'Dziś',
    subtitle: 'Twój dzień w 5 sekund.',
    body: 'Zajęcia, zadania, ogłoszenia wykładowców i poranny AI brief — w jednym widoku.',
    ctaLabel: 'Zobacz Dziś',
    ctaPath: '/dzis',
  },
  {
    id: 'ai',
    visual: 'bot',
    title: 'AI Asystent',
    subtitle: 'Twój prywatny tutor. Pisz lub mów.',
    body: 'Zna Twój plan, ogłoszenia i Aulę. „Streść mi ten kanał", „Co dzisiaj?" — odpowie.',
  },
  {
    id: 'znizki',
    visual: Ticket,
    title: 'Couponek UJ',
    subtitle: 'Krakowska społeczność dzieli się rabatami.',
    body: 'Restauracje, kina, fitness, książki — wszystko, gdzie z legitymacją UJ płacisz mniej.',
    ctaLabel: 'Sprawdź zniżki',
    ctaPath: '/znizki',
  },
  {
    id: 'profile',
    visual: User,
    title: 'Skompletuj profil',
    subtitle: 'Żeby znajomi z roku Cię znaleźli.',
    body: 'Awatar, krótkie bio, kierunek. To wystarczy.',
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
            Borderless surface — tylko bg + zaokrąglenie + cień. Brak
            border karty, brak divider'ów. Sekcje rozdziela sam padding.
            Dark border zostaje (przy ciemnym backdropie potrzebne dla
            edge-definition), light: czysto bez krawędzi.
          */
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-w-2xl dark:border dark:border-white/10 dark:bg-bg-card"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={shouldReduceMotion ? { duration: 0.18 } : { duration: 0.28, ease: [0.32, 0.72, 0.34, 1] }}
        >

          {/* Top bar — progress + skip. BRAK border-b — sekcje rozdziela padding. */}
          <div className="relative flex items-center justify-between gap-3 px-4 pt-3 sm:px-6 sm:pt-4">
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

          {/*
            Step body.
            ── Animacje:
              • container: cross-fade z directional slide (24px) — krótkie
                duration (0.22s) z easing [0.4, 0, 0.2, 1] (material standard)
              • text stagger: każdy element fade-in z y:8 + lekkie opóźnienia
                (h2 → subtitle → body → CTA) — daje wrażenie "build up"
              • hero entry (w StepHero): spring scale+rotate
              • staggerChildren przez framer-motion variants — czystsze niż
                ręczne delay'e
          */}
          <div className="relative">
            <AnimatePresence custom={direction} mode="wait" initial={false}>
              <motion.div
                key={current.id}
                custom={direction}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction * 20 }
                }
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -direction * 20 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.18 }
                    : { duration: 0.32, ease: [0.4, 0, 0.2, 1] }
                }
                className="grid grid-cols-1 items-center gap-6 px-5 pb-6 pt-7 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-10 sm:px-8 sm:pb-8 sm:pt-9"
              >
                {/* HERO column */}
                <div className="relative flex items-center justify-center">
                  <StepHero step={current} reduceMotion={!!shouldReduceMotion} />
                </div>

                {/* TEXT column — staggered children */}
                <motion.div
                  className="text-center sm:text-left"
                  initial={shouldReduceMotion ? undefined : 'hidden'}
                  animate={shouldReduceMotion ? undefined : 'visible'}
                  variants={
                    shouldReduceMotion
                      ? undefined
                      : {
                          hidden: {},
                          visible: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
                        }
                  }
                >
                  <motion.h2
                    variants={
                      shouldReduceMotion
                        ? undefined
                        : {
                            hidden: { opacity: 0, y: 12 },
                            visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
                          }
                    }
                    className="text-[28px] font-extrabold leading-tight tracking-tight text-fg-primary sm:text-3xl"
                  >
                    {current.title}
                  </motion.h2>
                  <motion.p
                    variants={
                      shouldReduceMotion
                        ? undefined
                        : {
                            hidden: { opacity: 0, y: 10 },
                            visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } },
                          }
                    }
                    /*
                      Subtitle — akcent brand (navy w light, gold w dark),
                      zamiast zimnego slate-400 z fg-secondary. Spójne z
                      AuthShell / Header / primary CTA appki.
                    */
                    className="mt-2 text-base font-semibold text-[#1e293b]/85 dark:text-brand-gold-bright"
                  >
                    {current.subtitle}
                  </motion.p>
                  <motion.p
                    variants={
                      shouldReduceMotion
                        ? undefined
                        : {
                            hidden: { opacity: 0, y: 8 },
                            visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 30 } },
                          }
                    }
                    /*
                      Body — neutralny biały zamiast zinc-300 (lekko niebieskawy
                      w dark). Trzyma się ciepłej palety navy/gold appki.
                    */
                    className="mt-4 text-[15.5px] leading-relaxed text-zinc-600 dark:text-zinc-200"
                  >
                    {current.body}
                  </motion.p>

                  {current.ctaPath && (
                    <motion.button
                      variants={
                        shouldReduceMotion
                          ? undefined
                          : {
                              hidden: { opacity: 0, y: 8 },
                              visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 340, damping: 30 } },
                            }
                      }
                      type="button"
                      onClick={() => current.ctaPath && visit(current.ctaPath)}
                      className="group mt-6 inline-flex items-center gap-1 text-[14px] font-semibold text-[#1e293b] transition-colors hover:text-zinc-600 dark:text-brand-gold-bright dark:hover:text-brand-gold"
                    >
                      {current.ctaLabel ?? 'Otwórz'}
                      <ArrowRight
                        size={14}
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </motion.button>
                  )}
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer nav. BRAK border-t — body content sam się zdystansuje. */}
          <div className="relative flex items-center justify-between gap-2 px-4 pb-4 pt-1 sm:px-6 sm:pb-5">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              <ChevronLeft
                size={16}
                className="transition-transform duration-200 group-hover:-translate-x-0.5"
              />
              Wstecz
            </button>
            <span className="text-[12px] tabular-nums text-zinc-400 dark:text-zinc-500">
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

/**
 * StepHero — JEDNORODNA wysokość kontenera dla wszystkich kroków
 * (`h-48 sm:h-60 lg:h-64`) żeby przejście krok→krok NIE skakało po Y.
 *
 * Logo welcome jest większe niż chip ikony, ale oba mieszczą się w
 * tym samym wrapperze (logo w 90% wysokości, chip ikony 24/28 px stała).
 *
 * Entry animacja: spring scale (0.82 → 1) + rotate (-6° → 0°) + opacity.
 * Daje delikatny „pop-in" jak ikony w iOS keynote. Respect reduced-motion.
 */
function StepHero({ step, reduceMotion }: { step: Step; reduceMotion: boolean }) {
  const entry = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.82, rotate: -6 }
  const animate = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, rotate: 0 }
  const transition = reduceMotion
    ? { duration: 0.22 }
    : { type: 'spring' as const, stiffness: 240, damping: 18, mass: 0.7 }

  return (
    <div className="relative flex h-48 w-full items-center justify-center sm:h-60 lg:h-64">
      {step.visual === 'logo' && (
        <motion.div
          aria-label="UJverse"
          role="img"
          initial={entry}
          animate={animate}
          transition={transition}
          className="h-40 w-56 bg-logo-navy transition-colors duration-150 sm:h-48 sm:w-64 lg:h-52 lg:w-72 dark:bg-brand-gold-bright"
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
      )}

      {step.visual === 'bot' && (
        <motion.div
          initial={entry}
          animate={animate}
          transition={transition}
          className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#1e293b] text-brand-gold-bright shadow-lg shadow-[#1e293b]/15 sm:h-28 sm:w-28 dark:bg-brand-gold dark:text-zinc-950 dark:shadow-brand-gold/10"
        >
          <AnimatedBot size={48} strokeWidth={1.8} intensity="wave" />
        </motion.div>
      )}

      {step.visual !== 'logo' && step.visual !== 'bot' && (
        <motion.div
          initial={entry}
          animate={animate}
          transition={transition}
          className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#1e293b] text-brand-gold-bright shadow-lg shadow-[#1e293b]/15 sm:h-28 sm:w-28 dark:bg-brand-gold dark:text-zinc-950 dark:shadow-brand-gold/10"
        >
          {(() => {
            const Icon = step.visual as LucideIcon
            return <Icon size={44} strokeWidth={1.8} />
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
 * NextButton — solidny primary pill (wariant „minimalistyczny solidny"
 * z commit 89e29da). User preferuje ten styl nad gradient pill / ghost
 * link.
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
      transition={reduceMotion ? undefined : { type: 'spring', stiffness: 500, damping: 30 }}
      className={[
        'group inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-[15px] font-semibold tracking-tight transition-colors',
        'bg-[#1e293b] text-white hover:bg-[#0f172a]',
        'dark:bg-brand-gold dark:text-zinc-950 dark:hover:bg-brand-gold-bright',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1e293b]/50 focus-visible:ring-offset-white dark:focus-visible:ring-brand-gold-bright/55 dark:focus-visible:ring-offset-zinc-900',
      ].join(' ')}
    >
      {isLast ? (
        <>
          <Check size={16} strokeWidth={2.5} />
          Gotowe
        </>
      ) : (
        <>
          Dalej
          <ChevronRight
            size={16}
            strokeWidth={2.5}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </>
      )}
    </motion.button>
  )
}
