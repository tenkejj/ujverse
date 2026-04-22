import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'

export type ActionKind = 'edit' | 'follow' | 'following'

type Props = {
  variant: 'inline' | 'fab'
  kind: ActionKind
  onClick: () => void
  loading?: boolean
  hovering?: boolean
  onHoverChange?: (next: boolean) => void
}

export default function ProfileActionButton({
  variant,
  kind,
  onClick,
  loading,
  hovering,
  onHoverChange,
}: Props) {
  const inlineBaseClass = PROFILE_MOBILE.actionButton.inlineClass
  const fabBaseClass = PROFILE_MOBILE.fab.buttonClass

  if (variant === 'fab') {
    const icon: ReactNode =
      kind === 'edit' ? (
        <Pencil size={22} strokeWidth={2} />
      ) : (
        <UserPlus size={22} strokeWidth={2} />
      )
    return (
      <motion.button
        layoutId={PROFILE_MOBILE.fab.layoutId}
        type="button"
        onClick={onClick}
        disabled={loading}
        whileTap={{ scale: 0.92 }}
        aria-label={
          kind === 'edit'
            ? 'Edytuj profil'
            : kind === 'follow'
              ? 'Obserwuj'
              : 'Obserwujesz'
        }
        className={fabBaseClass}
        transition={PROFILE_MOBILE.motion.indicatorSpring}
      >
        {loading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          icon
        )}
      </motion.button>
    )
  }

  if (kind === 'edit') {
    return (
      <motion.button
        layoutId={PROFILE_MOBILE.fab.layoutId}
        type="button"
        onClick={onClick}
        disabled={loading}
        whileTap={{ scale: 0.97 }}
        className={inlineBaseClass}
        transition={PROFILE_MOBILE.motion.indicatorSpring}
      >
        Edytuj profil
      </motion.button>
    )
  }

  if (kind === 'follow') {
    return (
      <motion.button
        layoutId={PROFILE_MOBILE.fab.layoutId}
        type="button"
        onClick={onClick}
        disabled={loading}
        whileTap={loading ? undefined : { scale: 0.95 }}
        className={inlineBaseClass}
        transition={PROFILE_MOBILE.motion.indicatorSpring}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <>
            <UserPlus size={18} strokeWidth={2} />
            Obserwuj
          </>
        )}
      </motion.button>
    )
  }

  const isHover = Boolean(hovering)
  return (
    <motion.button
      layoutId={PROFILE_MOBILE.fab.layoutId}
      type="button"
      onClick={onClick}
      disabled={loading}
      whileTap={loading ? undefined : { scale: 0.95 }}
      onHoverStart={() => onHoverChange?.(true)}
      onHoverEnd={() => onHoverChange?.(false)}
      transition={PROFILE_MOBILE.motion.indicatorSpring}
      className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
        isHover
          ? 'border-red-500/35 text-red-500/80'
          : 'border-[#0f172a]/20 bg-transparent text-[#0f172a] dark:border-white/25 dark:text-white'
      }`}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <span className="relative block min-h-5 min-w-[12.5rem] overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isHover ? 'u' : 'f'}
              initial={{ y: isHover ? 10 : -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: isHover ? 10 : -10, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 top-0 block whitespace-nowrap text-center"
            >
              {isHover ? 'Przestań obserwować' : 'Obserwujesz'}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </motion.button>
  )
}
