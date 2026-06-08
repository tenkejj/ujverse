import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Users, X } from 'lucide-react'
import { RsvpService, type RsvpAttendee } from '../../services/RsvpService'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'
import UserAvatar from '../UserAvatar'

type Props = {
  open: boolean
  onClose: () => void
  eventId: string
  eventTitle: string
  currentUserId: string
  onNavigateToProfileHandle?: (handle: string) => void
}

const listMotion = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.02,
    },
  },
} as const

const rowMotion = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 380, damping: 30, mass: 0.7 },
  },
} as const

export default function EventAttendeesModal({
  open,
  onClose,
  eventId,
  eventTitle,
  currentUserId,
  onNavigateToProfileHandle,
}: Props) {
  const [attendees, setAttendees] = useState<RsvpAttendee[]>([])
  const [loading, setLoading] = useState(true)
  const [isClosing, setIsClosing] = useState(false)

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  useEffect(() => {
    if (!open || !eventId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const data = await RsvpService.getAttendeesForEvent(eventId)
      if (!cancelled) {
        setAttendees(data)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, eventId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  const handleRowClick = (attendee: RsvpAttendee) => {
    const handle = attendee.profile?.username?.trim().toLowerCase()
    if (!handle || !onNavigateToProfileHandle) return
    // Instant close (bez 200 ms close-animation z `handleClose`), żeby parent EventModal
    // też zdążył się zamknąć w tym samym cyklu renderu przed navigate. W przeciwnym razie
    // pop-up wydarzenia migocze pod modalem zanim widok się przełączy na profil.
    onClose()
    onNavigateToProfileHandle(handle)
  }

  if (!open) return null

  const total = attendees.length

  return createPortal(
    <motion.div
      className="fixed inset-0 z-10010 flex items-center justify-center bg-bg-app/70 p-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-attendees-title"
        aria-describedby="event-attendees-context"
        className={`flex max-h-[min(85vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl ${PROFILE_MOBILE.card.glassLight} ${PROFILE_MOBILE.card.glassDark} backdrop-blur-2xl`}
        initial={{ opacity: 0, y: 28, scale: 0.96, rotateX: 8 }}
        animate={{
          opacity: isClosing ? 0 : 1,
          y: isClosing ? 18 : 0,
          scale: isClosing ? 0.975 : 1,
          rotateX: isClosing ? 5 : 0,
        }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, mass: 0.85 }}
        onClick={(e) => e.stopPropagation()}
        style={{ transformOrigin: 'center top' }}
      >
        <div className="flex items-center justify-between border-b border-border-app/70 px-4 py-3">
          <h2
            id="event-attendees-title"
            className="flex items-center gap-2 text-base font-bold text-fg-primary"
          >
            <Users size={18} strokeWidth={2} className="shrink-0" aria-hidden />
            Uczestnicy
            {!loading && (
              <span className="text-sm font-semibold text-fg-secondary">{total}</span>
            )}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Zamknij"
            className="rounded-full p-2 text-fg-secondary transition-colors hover:bg-bg-app/35 hover:text-fg-primary"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Tytuł wydarzenia trzymany TYLKO dla a11y (czytniki ekranu) — bez wizualnego sub-headera. */}
        <span id="event-attendees-context" className="sr-only">
          Lista uczestników wydarzenia: {eventTitle}
        </span>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-14">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1e293b] border-t-transparent dark:border-brand-gold-bright" />
            </div>
          ) : total === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-fg-secondary">
              Nikt jeszcze nie zapisał się na to wydarzenie.
              <br />
              <span className="text-xs">Bądź pierwszy(a)!</span>
            </p>
          ) : (
            <motion.ul variants={listMotion} initial="hidden" animate="show" className="space-y-1">
              {attendees.map((att) => {
                const profile = att.profile
                const name = profile?.full_name?.trim() || profile?.username?.trim() || 'Użytkownik'
                const handle = profile?.username?.trim()
                const isSelf = profile?.id === currentUserId
                const isClickable = Boolean(handle && onNavigateToProfileHandle)
                return (
                  <motion.li
                    key={att.user_id}
                    variants={rowMotion}
                    whileHover={isClickable ? { y: -1, scale: 1.004 } : undefined}
                    whileTap={isClickable ? { scale: 0.992 } : undefined}
                    className={`flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors ${
                      isClickable ? 'cursor-pointer hover:bg-bg-app/25' : ''
                    }`}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={isClickable ? () => handleRowClick(att) : undefined}
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleRowClick(att)
                            }
                          }
                        : undefined
                    }
                  >
                    <UserAvatar
                      profile={profile ?? null}
                      name={name}
                      className="h-10 w-10"
                      textSize="text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg-primary">{name}</p>
                      {handle ? (
                        <p className="truncate text-xs text-fg-secondary">@{handle}</p>
                      ) : profile?.department ? (
                        <p className="truncate text-xs text-fg-secondary">{profile.department}</p>
                      ) : null}
                    </div>
                    {isSelf ? (
                      <span className="shrink-0 rounded-full border border-border-app/70 px-3 py-1 text-xs font-medium text-fg-secondary">
                        Ty
                      </span>
                    ) : null}
                  </motion.li>
                )
              })}
            </motion.ul>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
