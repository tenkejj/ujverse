/**
 * UJverse — AchievementUnlockedModal: fanfara po odblokowaniu odznaki.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Listenuje na global `achievement-unlocked` event. Pokazuje modal z:
 *   • dużą ikoną odznaki (lucide z `icon_name`)
 *   • nazwą + opisem + rarity (kolorowa)
 *   • XP rewardem
 *   • CTA "Świetnie!" + "Zobacz wszystkie"
 *
 * Kolejka: jeśli kilka odznak odblokowane jednocześnie (np. milestone +
 * streak) — pokazujemy po kolei.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
  Award,
  BarChart3,
  Bell,
  CheckCircle2,
  CheckSquare,
  Compass,
  Crown,
  Flame,
  Heart,
  type LucideIcon,
  MessageCircle,
  MessagesSquare,
  Mic,
  Sparkles,
  StickyNote,
  Sunrise,
  Tags,
  Target,
  Ticket,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import {
  onAchievementUnlocked,
} from '../../lib/gamificationEvents'
import type { AchievementRarity, UnlockedAchievement } from '../../types/gamification'

const ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  'user-check': UserCheck,
  compass: Compass,
  flame: Flame,
  crown: Crown,
  'message-circle': MessageCircle,
  'messages-square': MessagesSquare,
  trophy: Trophy,
  mic: Mic,
  'bar-chart-3': BarChart3,
  'sticky-note': StickyNote,
  'check-square': CheckSquare,
  'check-circle-2': CheckCircle2,
  target: Target,
  ticket: Ticket,
  tags: Tags,
  users: Users,
  bell: Bell,
  heart: Heart,
  sunrise: Sunrise,
}

function iconFor(name: string): LucideIcon {
  return ICON_MAP[name] ?? Award
}

const RARITY_STYLES: Record<AchievementRarity, {
  bg: string
  ring: string
  text: string
  badge: string
  label: string
}> = {
  common: {
    bg: 'from-slate-400 to-slate-600',
    ring: 'ring-slate-300/40',
    text: 'text-slate-100',
    badge: 'bg-slate-500/20 text-slate-200',
    label: 'Zwykła',
  },
  rare: {
    bg: 'from-sky-400 to-blue-600',
    ring: 'ring-sky-300/40',
    text: 'text-white',
    badge: 'bg-sky-500/20 text-sky-100',
    label: 'Rzadka',
  },
  epic: {
    bg: 'from-violet-500 to-fuchsia-600',
    ring: 'ring-violet-300/50',
    text: 'text-white',
    badge: 'bg-fuchsia-500/25 text-fuchsia-100',
    label: 'Epicka',
  },
  legendary: {
    bg: 'from-amber-400 via-orange-500 to-rose-500',
    ring: 'ring-amber-300/60',
    text: 'text-white',
    badge: 'bg-amber-500/25 text-amber-100',
    label: 'Legendarna',
  },
}

export default function AchievementUnlockedModal() {
  const [queue, setQueue] = useState<UnlockedAchievement[]>([])
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    return onAchievementUnlocked((p) => {
      setQueue((prev) => [...prev, p])
    })
  }, [])

  const current = queue[0] ?? null

  const dismiss = () => setQueue((prev) => prev.slice(1))

  // ESC + body-lock
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [current])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {current && (
        <motion.div
          key={`ach-${current.key}-${current.unlocked_at}`}
          role="dialog"
          aria-modal="true"
          aria-label={`Odznaka odblokowana: ${current.name}`}
          className="fixed inset-0 z-[340] flex items-end justify-center px-4 pb-6 pt-16 sm:items-center sm:pb-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0.15 } : { duration: 0.22 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} aria-hidden />
          <AchievementCardModal a={current} onClose={dismiss} reduceMotion={!!shouldReduceMotion} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function AchievementCardModal({
  a,
  onClose,
  reduceMotion,
}: {
  a: UnlockedAchievement
  onClose: () => void
  reduceMotion: boolean
}) {
  const Icon = iconFor(a.icon_name)
  const style = RARITY_STYLES[a.rarity as AchievementRarity] ?? RARITY_STYLES.common

  return (
    <motion.div
      role="document"
      className={`relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${style.bg} p-6 text-center shadow-2xl ring-2 ${style.ring}`}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.92 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
      transition={reduceMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 320, damping: 26 }}
    >
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" aria-hidden />

      <button
        type="button"
        onClick={onClose}
        aria-label="Zamknij"
        className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15"
      >
        <X size={16} />
      </button>

      <p className="relative text-[11px] font-bold uppercase tracking-[0.28em] text-white/85">
        Odznaka odblokowana
      </p>
      <div className="relative mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/30 backdrop-blur-sm">
        <motion.div
          initial={reduceMotion ? { scale: 1 } : { scale: 0.4, rotate: -20 }}
          animate={reduceMotion ? { scale: 1 } : { scale: 1, rotate: 0 }}
          transition={reduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 280, damping: 16, delay: 0.15 }}
        >
          <Icon size={48} strokeWidth={1.8} className={style.text} />
        </motion.div>
      </div>
      <h2 className={`relative mt-4 text-xl font-extrabold ${style.text}`}>{a.name}</h2>
      <p className={`relative mt-1.5 text-sm leading-snug ${style.text}/90`}>{a.description}</p>

      <div className="relative mt-4 inline-flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
          {style.label}
        </span>
        {a.xp_reward > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white">
            +{a.xp_reward} XP
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="relative mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-zinc-900 shadow-lg transition-transform hover:scale-[1.02]"
      >
        Świetnie!
      </button>
    </motion.div>
  )
}
