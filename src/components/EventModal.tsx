import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Calendar, CalendarPlus, MapPin } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatEventDateLong, generateGoogleCalendarLink, type UJEvent } from '../data/mockEvents'

type Props = {
  event: UJEvent | null
  onClose: () => void
  onToggleRsvp: (eventId: string) => void
}

const AVATAR_CAP = 4

function formatOthersLine(count: number): string {
  if (count === 0) return '+ 0 innych'
  const mod100 = count % 100
  const mod10 = count % 10
  if (count === 1 || (mod10 === 1 && mod100 !== 11)) return '+ 1 inna'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `+ ${count} inne`
  return `+ ${count} innych`
}

type ContentProps = {
  event: UJEvent
  isClosing: boolean
  handleClose: () => void
  onToggleRsvp: (eventId: string) => void
}

function EventModalContent({ event, isClosing, handleClose, onToggleRsvp }: ContentProps) {
  const dateLine = formatEventDateLong(event.date)
  const isAttending = Boolean(event.isAttending)
  const attendeeCount = event.attendees
  const avatars = (event.attendeeAvatars ?? []).slice(0, AVATAR_CAP)
  const hasBanner = Boolean(event.imageUrl)

  const closeBtnCls =
    'z-10 p-2 rounded-full text-white bg-black/50 hover:bg-black/65 transition-colors backdrop-blur-[2px]'

  const body = (
    <>
      {!hasBanner && (
        <button
          type="button"
          onClick={handleClose}
          className={`absolute top-4 right-4 ${closeBtnCls}`}
          aria-label="Zamknij"
        >
          <X size={20} strokeWidth={2} />
        </button>
      )}

      {hasBanner ? null : (
        <h2 id="event-modal-title" className="text-xl font-bold text-white mb-2 pr-14">
          {event.title}
        </h2>
      )}

      <div className="text-sm text-slate-400 mb-4 space-y-2">
        <div className="flex items-start gap-2">
          <Calendar size={16} className="text-[#ffa000] shrink-0 mt-0.5" aria-hidden />
          <span>{dateLine}</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin size={16} className="text-[#ffa000] shrink-0 mt-0.5" aria-hidden />
          {event.mapUrl ? (
            <a
              href={event.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-[#ffa000] transition-colors inline-flex items-center gap-1 flex-wrap"
            >
              <span className="underline-offset-2 hover:underline">{event.location}</span>
            </a>
          ) : (
            <span>{event.location}</span>
          )}
        </div>
      </div>

      <p className="text-slate-300 mb-6 leading-relaxed">{event.description}</p>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => onToggleRsvp(event.id)}
            className={`flex-1 min-w-[140px] py-3 rounded-xl font-bold transition-colors ${
              isAttending
                ? 'bg-transparent border border-[#ffa000] text-[#ffa000] hover:bg-[#ffa000]/10'
                : 'bg-[#ffa000] text-black hover:bg-[#e69000]'
            }`}
          >
            {isAttending ? '✓ Bierzesz udział' : 'Wezmę udział'}
          </button>
          <div className="flex flex-1 min-w-[200px] items-center justify-end gap-3 flex-wrap">
            {avatars.length > 0 && (
              <div className="flex -space-x-2 shrink-0">
                {avatars.map((url, i) => (
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt=""
                    className="relative w-8 h-8 rounded-full border-2 border-[#040521] bg-[#040521] object-cover"
                    style={{ zIndex: i + 1 }}
                  />
                ))}
              </div>
            )}
            <span className="shrink-0 text-sm text-slate-400 text-right leading-snug">
              {formatOthersLine(attendeeCount)}
            </span>
          </div>
        </div>
        <a
          href={generateGoogleCalendarLink(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-fit"
        >
          <CalendarPlus size={16} className="shrink-0" aria-hidden />
          Dodaj do kalendarza
        </a>
      </div>
    </>
  )

  if (hasBanner) {
    return (
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        className="w-full max-w-lg rounded-2xl border border-[#1c2b4e] bg-[#040521] relative overflow-hidden shadow-none"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{
          opacity: isClosing ? 0 : 1,
          y: isClosing ? 8 : 0,
          scale: isClosing ? 0.97 : 1,
        }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-48">
          <img
            src={event.imageUrl}
            alt=""
            className="w-full h-48 object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#040521] via-[#040521]/50 to-transparent" />
          <button
            type="button"
            onClick={handleClose}
            className={`absolute top-4 right-4 ${closeBtnCls}`}
            aria-label="Zamknij"
          >
            <X size={20} strokeWidth={2} />
          </button>
          <h2
            id="event-modal-title"
            className="absolute bottom-0 left-0 right-0 z-[5] px-4 pb-3 pr-14 text-xl font-bold text-white drop-shadow-md"
          >
            {event.title}
          </h2>
        </div>
        <div className="p-6">{body}</div>
      </motion.div>
    )
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
      className="w-full max-w-lg rounded-2xl border border-[#1c2b4e] bg-[#040521] p-6 relative overflow-hidden shadow-none"
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{
        opacity: isClosing ? 0 : 1,
        y: isClosing ? 8 : 0,
        scale: isClosing ? 0.97 : 1,
      }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </motion.div>
  )
}

export default function EventModal({ event, onClose, onToggleRsvp }: Props) {
  const [isClosing, setIsClosing] = useState(false)

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(onClose, 200)
  }

  useEffect(() => {
    if (!event) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])

  useEffect(() => {
    if (event) setIsClosing(false)
  }, [event])

  if (!event) return null

  return createPortal(
    <motion.div
      role="presentation"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <EventModalContent
        event={event}
        isClosing={isClosing}
        handleClose={handleClose}
        onToggleRsvp={onToggleRsvp}
      />
    </motion.div>,
    document.body,
  )
}
