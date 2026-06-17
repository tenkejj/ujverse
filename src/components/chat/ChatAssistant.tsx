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
import { sectionTitleCls, sideMutedCls } from '../../lib/sidePanelStyles'
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
      className={`relative flex ${heightClassName} min-h-0 flex-col overflow-hidden`}
    >
      <motion.div
        variants={reducedMotion ? undefined : containerVariants}
        initial={reducedMotion ? false : 'hidden'}
        animate="show"
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-5 text-center"
      >
        <motion.div variants={reducedMotion ? undefined : itemVariants}>
          <VersuHeroCluster iconSize={56} />
        </motion.div>

        <motion.h2
          variants={reducedMotion ? undefined : itemVariants}
          className="text-base font-semibold leading-snug tracking-tight text-[#1e293b] dark:text-white"
        >
          {welcome.headline}
        </motion.h2>

        <motion.p
          variants={reducedMotion ? undefined : itemVariants}
          className="max-w-[15rem] text-xs leading-relaxed text-fg-secondary"
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
          className="group relative inline-flex w-full max-w-[13.75rem] items-center justify-center gap-2 overflow-hidden rounded-full border border-logo-navy/20 bg-logo-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-logo-navy/90 dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/25 dark:hover:shadow-[0_8px_28px_-6px_rgb(201_162_57/0.2)]"
        >
          {!reducedMotion && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-white/25 to-transparent dark:via-brand-gold-bright/20"
              initial={{ x: '-120%' }}
              whileHover={{ x: '120%' }}
              transition={{ duration: 0.55, ease: 'easeInOut' }}
            />
          )}
          <motion.span
            aria-hidden
            className="relative shrink-0"
            animate={reducedMotion ? undefined : { rotate: [0, -8, 8, 0] }}
            transition={
              reducedMotion
                ? undefined
                : { duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }
            }
          >
            <MessageCircle size={15} strokeWidth={2.2} />
          </motion.span>
          <span className="relative">{ctaLabel}</span>
        </motion.button>
      </motion.div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: reducedMotion ? 0 : 0.45, ease: EASE }}
        className="relative flex shrink-0 items-center justify-center gap-1.5 border-t border-zinc-200/60 px-4 py-2 dark:border-white/8"
      >
        <span className={sectionTitleCls}>{CHAT_ASSISTANT_NAME}</span>
        <span className={`text-[10px] ${sideMutedCls}`}>· {CHAT_MODEL_LABEL}</span>
      </motion.div>
    </BaseCard>
  )
}
