/**
 * UJverse — XpToastStack: animowane "+N XP" toasty po każdym awardzie.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Pływający stack w prawym dolnym rogu (above bottom nav na mobile).
 * Każdy toast auto-dismisses po 2.5s. Listenuje na global `XpToast` event
 * z `lib/gamificationEvents`. Renderowane jednokrotnie w App.tsx jako
 * "tail" (poza routingiem) żeby toasty przeżyły nawigację.
 *
 * Level-up: dodatkowy złoty toast "🎉 Level X!" — bardziej wyraźny niż
 * zwykły +XP, zostaje na 4s.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Sparkles, Zap, TrendingUp } from 'lucide-react'
import { onXpToast, type XpToastPayload } from '../../lib/gamificationEvents'

type ToastItem = XpToastPayload & {
  id: string
  /** Renderujemy 2 osobne wpisy gdy level-up (XP + levelup); ten flag
   *  pozwala wyróżnić styling. */
  variant: 'xp' | 'levelup'
}

function nextId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const XP_DISMISS_MS = 2500
const LEVELUP_DISMISS_MS = 4500

export default function XpToastStack() {
  const [items, setItems] = useState<ToastItem[]>([])
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    return onXpToast((p) => {
      const xpItem: ToastItem = { ...p, id: nextId(), variant: 'xp' }
      setItems((prev) => [...prev, xpItem])
      window.setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.id !== xpItem.id))
      }, XP_DISMISS_MS)

      if (p.leveledUp) {
        const lvlItem: ToastItem = { ...p, id: nextId(), variant: 'levelup' }
        // delikatne opóźnienie żeby XP nie nadpisało level-upu wizualnie
        window.setTimeout(() => {
          setItems((prev) => [...prev, lvlItem])
          window.setTimeout(() => {
            setItems((prev) => prev.filter((it) => it.id !== lvlItem.id))
          }, LEVELUP_DISMISS_MS)
        }, 350)
      }
    })
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[330] flex flex-col items-center gap-1.5 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end sm:px-0"
    >
      <AnimatePresence>
        {items.map((it) => (
          <motion.div
            key={it.id}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.85 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.9 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 500, damping: 32 }
            }
            className={
              it.variant === 'levelup'
                ? 'pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-gradient-to-br from-amber-500 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-amber-500/30 ring-1 ring-amber-300/40'
                : 'pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-gradient-to-br from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-violet-500/25'
            }
          >
            {it.variant === 'levelup' ? (
              <>
                <TrendingUp size={16} strokeWidth={2.5} />
                <span>Level {it.newLevel}! Gratulacje 🎉</span>
              </>
            ) : (
              <>
                <Zap size={13} strokeWidth={2.75} className="-mx-0.5" />
                <span className="tabular-nums">+{it.amount} XP</span>
                <Sparkles size={11} strokeWidth={2.25} className="opacity-80" />
              </>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
