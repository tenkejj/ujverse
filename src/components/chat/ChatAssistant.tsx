/**
 * `ChatAssistant` — desktopowa wyspa-teaser asystenta AI w lewej kolumnie feedu.
 *
 * Nie renderuje mini-czatu — zaproszenie z CTA do pełnego widoku `/chat`
 * (`ChatHubView`). Historia rozmowy w `useChatStore` (RAM).
 *
 * Mobilny odpowiednik: `ChatAssistantFab` (FAB + bottom-sheet).
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import type { Profile } from '../../types'
import { CHAT_ASSISTANT_NAME, CHAT_MODEL_LABEL } from '../../lib/chatModel'
import { buildWelcomeOpener } from '../../lib/welcomeOpener'
import { useChatStore } from '../../store/useChatStore'
import VersuHeroCluster from './VersuHeroCluster'

const EASE = [0.16, 1, 0.3, 1] as const
const SPRING = { type: 'spring' as const, stiffness: 380, damping: 28 }

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: EASE },
  },
}

type Props = {
  myProfile?: Profile | null
  displayName?: string
  heightClassName?: string
}

export default function ChatAssistant({
  displayName,
  heightClassName = 'h-[280px]',
}: Props = {}) {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const hasConversation = useChatStore(
    (s) => s.messages.some((m) => m.role !== 'system'),
  )

  const welcome = useMemo(
    () => buildWelcomeOpener(displayName),
    [displayName],
  )

  const ctaLabel = hasConversation ? 'Kontynuuj rozmowę' : 'Porozmawiaj'

  return (
    <BaseCard
      variant="default"
      className={`relative grid ${heightClassName} min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden`}
    >
      <motion.div
        variants={reducedMotion ? undefined : containerVariants}
        initial={reducedMotion ? false : 'hidden'}
        animate="show"
        className="flex min-h-0 flex-col items-center justify-center gap-2 px-4 py-3 text-center"
      >
        <motion.div variants={reducedMotion ? undefined : itemVariants}>
          <VersuHeroCluster
            containerClass="size-16"
            iconWrapClass="size-11"
            iconSize={40}
          />
        </motion.div>

        <motion.h2
          variants={reducedMotion ? undefined : itemVariants}
          className="w-full text-balance text-[15px] font-semibold leading-snug tracking-tight text-brand-ink dark:text-white"
        >
          {welcome.headline}
        </motion.h2>

        <motion.p
          variants={reducedMotion ? undefined : itemVariants}
          className="w-full max-w-[16rem] text-balance text-[13px] leading-snug text-fg-secondary"
        >
          {welcome.subline}
        </motion.p>

        <motion.button
          type="button"
          variants={reducedMotion ? undefined : itemVariants}
          whileHover={
            reducedMotion
              ? undefined
              : {
                  scale: 1.03,
                  boxShadow: '0 8px 28px -6px rgb(30 41 59 / 0.35)',
                }
          }
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          transition={SPRING}
          onClick={() => navigate('/chat')}
          aria-label={`${ctaLabel} z asystentem ${CHAT_ASSISTANT_NAME}`}
          className="mt-0.5 inline-flex w-full max-w-[13.5rem] items-center justify-center gap-2 rounded-full bg-brand-ink px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-ink/90 dark:bg-brand-gold-bright dark:text-zinc-950 dark:hover:bg-brand-gold-bright/90"
        >
          <MessageCircle size={15} strokeWidth={2.2} className="shrink-0" />
          <span>{ctaLabel}</span>
        </motion.button>
      </motion.div>

      <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-zinc-200/80 bg-zinc-50/90 px-4 py-1.5 dark:border-white/10 dark:bg-black/40">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          {CHAT_ASSISTANT_NAME}
        </span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          · {CHAT_MODEL_LABEL}
        </span>
      </div>
    </BaseCard>
  )
}
