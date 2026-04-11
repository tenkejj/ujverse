import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Shield,
  X,
  Calendar,
  CalendarPlus,
  ExternalLink,
  MapPin,
  Pencil,
  Share2,
  Trash2,
  Users,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { formatEventDateLong, generateGoogleCalendarLink, type UJEvent } from '../data/mockEvents'
import { useEvents } from '../hooks/useEvents'

type Props = {
  event: UJEvent | null
  onClose: () => void
  onToggleRsvp: (eventId: string) => void
  /** Otwiera formularz edycji (np. zamknij szczegóły i ustaw `editEvent` w rodzicu). */
  onEditRequest?: (event: UJEvent) => void
}

const AVATAR_CAP = 4

const dialogPanelCls =
  'relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 shadow-none backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90'

const goldIconCls = 'text-brand-gold dark:text-brand-gold-bright'

const actionBtnCls =
  'z-10 rounded-full border border-brand-gold/30 bg-black/40 p-2 text-brand-gold backdrop-blur-sm transition-colors hover:bg-black/55 dark:text-brand-gold-bright'

function formatOthersLine(count: number): string {
  if (count === 0) return '+ 0 innych'
  const mod100 = count % 100
  const mod10 = count % 10
  if (count === 1 || (mod10 === 1 && mod100 !== 11)) return '+ 1 inna'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `+ ${count} inne`
  return `+ ${count} innych`
}

function ModalToolbar({
  onEdit,
  onDeleteClick,
  onClose,
  showEdit,
  showDelete,
}: {
  onEdit?: () => void
  onDeleteClick: () => void
  onClose: () => void
  showEdit: boolean
  showDelete: boolean
}) {
  return (
    <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
      {showEdit && onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className={actionBtnCls}
          aria-label="Edytuj wydarzenie"
        >
          <Pencil size={18} strokeWidth={2} />
        </button>
      ) : null}
      {showDelete ? (
        <button
          type="button"
          onClick={onDeleteClick}
          className="z-10 rounded-full border border-red-500/40 bg-black/40 p-2 text-red-500 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-red-400"
          aria-label="Usuń wydarzenie"
        >
          <Trash2 size={18} strokeWidth={2} />
        </button>
      ) : null}
      <button type="button" onClick={onClose} className={actionBtnCls} aria-label="Zamknij">
        <X size={20} strokeWidth={2} />
      </button>
    </div>
  )
}

type ContentProps = {
  event: UJEvent
  isClosing: boolean
  handleClose: () => void
  onToggleRsvp: (eventId: string) => void
  onEditRequest?: (event: UJEvent) => void
  onDeleteClick: () => void
  onShare: () => void
}

type BannerImageState = 'empty' | 'loading' | 'ok' | 'fail'

function EventModalContent({
  event,
  isClosing,
  handleClose,
  onToggleRsvp,
  onEditRequest,
  onDeleteClick,
  onShare,
}: ContentProps) {
  const trimmedBannerUrl = (event.imageUrl ?? '').trim()
  const [bannerImageState, setBannerImageState] = useState<BannerImageState>('empty')

  useEffect(() => {
    if (!trimmedBannerUrl) {
      setBannerImageState('empty')
      return
    }
    setBannerImageState('loading')
    let cancelled = false
    const probe = new Image()
    probe.onload = () => {
      if (!cancelled) setBannerImageState('ok')
    }
    probe.onerror = () => {
      if (!cancelled) setBannerImageState('fail')
    }
    probe.src = trimmedBannerUrl
    return () => {
      cancelled = true
    }
  }, [trimmedBannerUrl])

  const dateLine = formatEventDateLong(event.date)
  const isAttending = Boolean(event.isAttending)
  const attendeeCount = event.attendees
  const avatars = (event.attendeeAvatars ?? []).slice(0, AVATAR_CAP)
  const showBannerImage = bannerImageState === 'ok'
  const official = Boolean(event.is_official)
  const canManage = Boolean(onEditRequest) && !official

  const handleEdit = () => {
    onEditRequest?.(event)
    handleClose()
  }

  const body = (
    <>
      <div className="mb-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex items-start gap-2">
          <Calendar size={16} className={`mt-0.5 shrink-0 ${goldIconCls}`} aria-hidden />
          <span>{dateLine}</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin size={16} className={`mt-0.5 shrink-0 ${goldIconCls}`} aria-hidden />
          {event.mapUrl ? (
            <a
              href={event.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-wrap items-center gap-1 text-slate-600 transition-colors hover:text-brand-gold dark:text-slate-400 dark:hover:text-brand-gold-bright"
            >
              <span className="underline-offset-2 hover:underline">{event.location}</span>
            </a>
          ) : (
            <span>{event.location}</span>
          )}
        </div>
      </div>

      <p className="mb-4 leading-relaxed text-slate-700 dark:text-slate-300">{event.description}</p>

      {event.event_url ? (
        <a
          href={event.event_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`mb-6 inline-flex w-fit items-center gap-2 text-sm font-semibold ${goldIconCls} transition-colors hover:text-brand-gold dark:hover:text-brand-gold-bright`}
        >
          <ExternalLink size={16} className={`shrink-0 ${goldIconCls}`} strokeWidth={2} aria-hidden />
          Strona wydarzenia u źródła
        </a>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleRsvp(event.id)}
            className={`min-w-[120px] flex-1 rounded-xl py-3 font-bold transition-colors ${
              isAttending
                ? 'border border-brand-gold bg-transparent text-brand-gold hover:bg-brand-gold/10 dark:text-brand-gold-bright'
                : 'bg-brand-gold text-black hover:bg-brand-gold/85'
            }`}
          >
            {isAttending ? '✓ Bierzesz udział' : 'Wezmę udział'}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-gold/50 bg-brand-gold/5 px-4 py-3 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10 dark:text-brand-gold-bright"
            aria-label="Udostępnij wydarzenie"
          >
            <Share2 size={18} strokeWidth={2} className={goldIconCls} aria-hidden />
            Udostępnij
          </button>
          <div className="flex min-w-[180px] flex-1 flex-wrap items-center justify-end gap-3">
            <Users size={16} className={`shrink-0 ${goldIconCls}`} aria-hidden />
            {avatars.length > 0 && (
              <div className="-space-x-2 flex shrink-0">
                {avatars.map((url, i) => (
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt=""
                    className="relative h-8 w-8 rounded-full border-2 border-slate-200 bg-white object-cover dark:border-zinc-700 dark:bg-zinc-900"
                    style={{ zIndex: i + 1 }}
                  />
                ))}
              </div>
            )}
            <span className="shrink-0 text-right text-sm leading-snug text-slate-600 dark:text-slate-400">
              {formatOthersLine(attendeeCount)}
            </span>
          </div>
        </div>
        <a
          href={generateGoogleCalendarLink(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-2 text-sm text-slate-600 transition-colors hover:text-brand-gold dark:text-slate-400 dark:hover:text-brand-gold-bright"
        >
          <CalendarPlus size={16} className={`shrink-0 ${goldIconCls}`} aria-hidden />
          Dodaj do kalendarza
        </a>
      </div>
    </>
  )

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
      className={dialogPanelCls}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{
        opacity: isClosing ? 0 : 1,
        y: isClosing ? 8 : 0,
        scale: isClosing ? 0.97 : 1,
      }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative h-[240px] w-full overflow-hidden rounded-t-2xl">
        {showBannerImage ? (
          <img src={trimmedBannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full bg-gradient-to-br from-amber-500/10 to-transparent"
            aria-hidden
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent dark:from-zinc-950/90 dark:via-zinc-950/45" />
        <ModalToolbar
          showEdit={canManage}
          showDelete={canManage}
          onEdit={onEditRequest ? handleEdit : undefined}
          onDeleteClick={onDeleteClick}
          onClose={handleClose}
        />
        {official ? (
          <span className="absolute left-4 top-16 z-[6] inline-flex items-center gap-1 rounded-full border border-[#c9a227]/55 bg-black/50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-gold backdrop-blur-sm dark:text-brand-gold-bright">
            <Shield size={12} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.5} aria-hidden />
            OFICJALNE UJ
          </span>
        ) : null}
        <h2
          id="event-modal-title"
          className="absolute bottom-0 left-0 right-0 z-[5] px-4 pb-3 pr-40 text-xl font-bold leading-tight text-white drop-shadow-md"
        >
          {event.title}
        </h2>
      </div>
      <div className="p-6">{body}</div>
    </motion.div>
  )
}

export default function EventModal({ event, onClose, onToggleRsvp, onEditRequest }: Props) {
  const { deleteEvent } = useEvents()
  const [isClosing, setIsClosing] = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const toastTimerRef = useRef<number | null>(null)

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 200)
  }

  const handleDeleteClick = () => {
    if (!event) return
    if (event.is_official) return
    if (!window.confirm('Czy na pewno chcesz usunąć to wydarzenie?')) return
    deleteEvent(event.id)
    handleClose()
  }

  const handleShare = async () => {
    if (!event) return
    const url = `${window.location.origin}/events/${event.id}`
    try {
      await navigator.clipboard.writeText(url)
      setShareToast(true)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => {
        setShareToast(false)
        toastTimerRef.current = null
      }, 2800)
    } catch {
      // brak uprawnień / HTTPS
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

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
    <>
      {shareToast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[10025] max-w-[90vw] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white/80 px-5 py-3 text-sm font-medium text-slate-900 shadow-lg shadow-black/25 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-white dark:shadow-black/40"
        >
          Link skopiowany do schowka! 🔗
        </div>
      ) : null}

      <motion.div
        role="presentation"
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
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
          onEditRequest={onEditRequest}
          onDeleteClick={handleDeleteClick}
          onShare={handleShare}
        />
      </motion.div>
    </>,
    document.body,
  )
}
