import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Calendar, CalendarPlus, MapPin } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatEventDateLong, generateGoogleCalendarLink, type UJEvent } from '../data/mockEvents'

type Props = {
  event: UJEvent | null
  onClose: () => void
}

function formatAttendeesLine(count: number): string {
  if (count === 1) return '🔥 1 osoba bierze udział'
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `🔥 ${count} osoby biorą udział`
  }
  return `🔥 ${count} osób bierze udział`
}

type ContentProps = {
  event: UJEvent
  isClosing: boolean
  handleClose: () => void
}

function EventModalContent({ event, isClosing, handleClose }: ContentProps) {
  const [isAttending, setIsAttending] = useState(event.isAttending ?? false)

  useEffect(() => {
    setIsAttending(event.isAttending ?? false)
  }, [event.id, event.isAttending])

  const dateLine = formatEventDateLong(event.date)
  const attendeeCount = event.attendees + (isAttending ? 1 : 0)

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
      <button
        type="button"
        onClick={handleClose}
        className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
        aria-label="Zamknij"
      >
        <X size={20} strokeWidth={2} />
      </button>

      <h2 id="event-modal-title" className="text-xl font-bold text-white mb-2 pr-10">
        {event.title}
      </h2>

      <div className="text-sm text-slate-400 mb-4 space-y-2">
        <div className="flex items-start gap-2">
          <Calendar size={16} className="text-[#ffa000] shrink-0 mt-0.5" aria-hidden />
          <span>{dateLine}</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin size={16} className="text-[#ffa000] shrink-0 mt-0.5" aria-hidden />
          <span>{event.location}</span>
        </div>
      </div>

      <p className="text-slate-300 mb-6 leading-relaxed">{event.description}</p>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setIsAttending((v) => !v)}
            className={`flex-1 min-w-[140px] py-3 rounded-xl font-bold transition-colors ${
              isAttending
                ? 'bg-transparent border border-[#ffa000] text-[#ffa000] hover:bg-[#ffa000]/10'
                : 'bg-[#ffa000] text-black hover:bg-[#e69000]'
            }`}
          >
            {isAttending ? '✓ Bierzesz udział' : 'Wezmę udział'}
          </button>
          <span className="shrink-0 text-sm text-slate-400 max-w-[40%] text-right leading-snug">
            {formatAttendeesLine(attendeeCount)}
          </span>
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
    </motion.div>
  )
}

export default function EventModal({ event, onClose }: Props) {
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
      <EventModalContent event={event} isClosing={isClosing} handleClose={handleClose} />
    </motion.div>,
    document.body,
  )
}
