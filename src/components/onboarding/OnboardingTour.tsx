/**
 * UJverse — OnboardingTour: interaktywny tour pierwszaka.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Pełnoekranowy modal z slajdami przedstawiającymi kluczowe sekcje:
 *   1. Witaj                  — branding + greeting
 *   2. Aula                   — czat rocznika
 *   3. Dziś                   — daily brief + AI
 *   4. Plan zajęć / Calendar  — wykładowcy + komunikaty
 *   5. Couponek UJ            — zniżki studenckie
 *   6. Profil + cel           — uzupełnij + zaproś
 *
 * Po ukończeniu: ustawia `profiles.onboarding_completed_at = now()`,
 * odblokuje achievement `welcome_aboard` i `onboarding_done`. "Pomiń" =
 * `onboarding_skipped_at` (nie pokazujemy ponownie automatycznie).
 *
 * Brak skomplikowanego highlight-spotlight — celowo. Prosty pełnoekranowy
 * tour działa na każdym viewport bez ryzyka layout-bugu.
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
  type LucideIcon,
  MessagesSquare,
  Sparkles,
  Sunrise,
  Ticket,
  User,
  X,
} from 'lucide-react'
import { useGamificationContext } from '../../lib/gamificationContext'

type Step = {
  id: string
  icon: LucideIcon
  iconBg: string
  title: string
  subtitle: string
  body: string
  ctaLabel?: string
  ctaPath?: string
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    icon: GraduationCap,
    iconBg: 'from-indigo-500 to-violet-600',
    title: 'Witaj w UJverse',
    subtitle: 'Wszystko czego potrzebujesz na studiach — w jednym miejscu.',
    body:
      'Aula, plan, ogłoszenia, zniżki i AI asystent. Stworzone przez studenta dla studentów UJ. Damy Ci 60 sekund tour, żebyś wiedział co i gdzie.',
  },
  {
    id: 'aula',
    icon: MessagesSquare,
    iconBg: 'from-emerald-500 to-teal-600',
    title: 'Aula — czat Twojego rocznika',
    subtitle: 'Discord + Teams. Tylko dla Twojej grupy.',
    body:
      'Logując się mailem uczelnianym automatycznie trafisz do czatu rocznika. Twórzcie sale tematyczne, dzielcie pliki, prowadźcie wspólne notatki, ankietujcie, nagrywajcie głosówki. Koniec szukania znajomych po Facebooku.',
    ctaLabel: 'Otwórz Aulę',
    ctaPath: '/aula',
  },
  {
    id: 'dzis',
    icon: Sunrise,
    iconBg: 'from-amber-500 to-orange-500',
    title: '„Dziś" — Twój dzień w 5 sekund',
    subtitle: 'Najszybszy sposób żeby wiedzieć co jutro.',
    body:
      'Twoje zajęcia, zadania, ogłoszenia wykładowców — w jednym widoku. AI tworzy poranny brief z najważniejszych informacji. Klikasz raz i wiesz wszystko.',
    ctaLabel: 'Zobacz Dziś',
    ctaPath: '/dzis',
  },
  {
    id: 'ai',
    icon: Sparkles,
    iconBg: 'from-violet-500 to-fuchsia-600',
    title: 'AI Asystent — twój prywatny tutor',
    subtitle: 'Zapytaj o cokolwiek.',
    body:
      '„Co dzisiaj na zajęciach?", „Streść mi tę dyskusję", „Tłumaczy to na angielski". AI zna Twój plan, ogłoszenia i wiadomości w Auli. Pisz lub mów — Whisper to przepisze.',
  },
  {
    id: 'znizki',
    icon: Ticket,
    iconBg: 'from-rose-500 to-pink-600',
    title: 'Couponek UJ — zniżki studenckie',
    subtitle: 'Krakowska społeczność dzieli się rabatami.',
    body:
      'Restauracje, kina, fitness, książki — wszystko gdzie z legitymacją UJ płacisz mniej. Dodawaj swoje, oceniaj cudze, oszczędzaj.',
    ctaLabel: 'Sprawdź zniżki',
    ctaPath: '/znizki',
  },
  {
    id: 'profile',
    icon: User,
    iconBg: 'from-sky-500 to-cyan-600',
    title: 'Skompletuj profil',
    subtitle: 'Awatar + bio = zdobywasz odznakę „Pełen profil" + XP.',
    body:
      'Twój profil widzą inni studenci Twojego rocznika. Awatar, krótkie bio, kierunek — to wystarczy. A za każdą aktywność zbierasz XP, awansujesz lvl-em i odblokowujesz odznaki.',
  },
]

type Props = {
  onComplete: () => void
  onSkip: () => void
}

export default function OnboardingTour({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0)
  const shouldReduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const gam = useGamificationContext()

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  const next = () => {
    if (isLast) {
      void gam?.unlockAchievement('welcome_aboard')
      void gam?.unlockAchievement('onboarding_done')
      onComplete()
    } else {
      setStep((s) => Math.min(STEPS.length - 1, s + 1))
    }
  }
  const prev = () => setStep((s) => Math.max(0, s - 1))

  const visit = (path: string) => {
    navigate(path)
    void gam?.unlockAchievement('welcome_aboard')
    onComplete()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Wprowadzenie do UJverse"
        className="fixed inset-0 z-[350] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 py-6 sm:py-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0.15 } : { duration: 0.22 }}
      >
        <motion.div
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-bg-card"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.95 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          transition={shouldReduceMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 320, damping: 28 }}
        >
          {/* Header — Skip + progress dots */}
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  aria-hidden
                  className={[
                    'h-1.5 rounded-full transition-all',
                    i === step
                      ? 'w-6 bg-violet-500 dark:bg-violet-400'
                      : i < step
                        ? 'w-1.5 bg-violet-300 dark:bg-violet-500/60'
                        : 'w-1.5 bg-zinc-200 dark:bg-white/15',
                  ].join(' ')}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-zinc-500 transition-colors hover:bg-black/[0.05] hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
            >
              Pomiń
              <X size={13} />
            </button>
          </div>

          {/* Step body */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
              className="px-5 pb-5 pt-6 sm:px-7 sm:pt-8"
            >
              <div
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${current.iconBg} text-white shadow-lg`}
              >
                <current.icon size={30} strokeWidth={1.8} />
              </div>
              <h2 className="mt-4 text-center text-xl font-extrabold text-fg-primary">
                {current.title}
              </h2>
              <p className="mt-1 text-center text-sm font-semibold text-fg-secondary">
                {current.subtitle}
              </p>
              <p className="mt-3 text-center text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                {current.body}
              </p>

              {current.ctaPath && (
                <button
                  type="button"
                  onClick={() => current.ctaPath && visit(current.ctaPath)}
                  className={`mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r ${current.iconBg} px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.01]`}
                >
                  {current.ctaLabel ?? 'Otwórz'}
                  <ArrowRight size={15} />
                </button>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3 dark:border-white/10">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              <ChevronLeft size={15} />
              Wstecz
            </button>
            <span className="text-[11px] tabular-nums text-zinc-400">
              {step + 1} / {STEPS.length}
            </span>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1e293b] px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.02] dark:bg-brand-gold dark:text-black"
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
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
