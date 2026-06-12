/**
 * UJverse — ChannelNotePanel + ChannelNoteSheet: wspólna notatka per sala.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * `ChannelNotePanel` = desktop right side panel (inline w 3-column AulaView,
 * conditional render gdy `notesOpen` w AulaView). Zastępuje members aside
 * gdy aktywny — chat zostaje pełnoekranowy.
 *
 * `ChannelNoteSheet` = mobile bottom sheet (analogicznie do MembersSheet).
 *
 * Oba używają shared `ChannelNoteEditor` (markdown textarea + preview tab +
 * status indicator + conflict banners + saveNow).
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  Eye,
  Loader2,
  Pencil,
  RefreshCcw,
  Save,
  StickyNote,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChannelNote, type ChannelNoteStatus } from '../../hooks/useChannelNote'
import { relativeTime } from '../../lib/utils'

type SharedProps = {
  cohortId: string | null
  channelId: number | null
  channelName: string
  currentUserId: string
  userNames?: Map<string, string>
  onClose: () => void
}

function statusLabel(
  status: ChannelNoteStatus,
  lastEditedBy: string | null,
  lastEditedAt: string | null,
  currentUserId: string,
  userNames?: Map<string, string>,
): { text: string; tone: 'idle' | 'saving' | 'dirty' | 'warn' | 'error' } {
  switch (status) {
    case 'loading':
      return { text: 'Ładuję notatkę…', tone: 'saving' }
    case 'saving':
      return { text: 'Zapisuję…', tone: 'saving' }
    case 'dirty':
      return { text: 'Zmiany niezapisane', tone: 'dirty' }
    case 'conflict':
      return { text: 'Konflikt — ktoś inny zapisał równolegle', tone: 'warn' }
    case 'remote-update':
      return { text: 'Ktoś dodał nowe zmiany — przejrzyj', tone: 'warn' }
    case 'error':
      return { text: 'Błąd zapisu', tone: 'error' }
    case 'saved':
    case 'idle':
    default:
      if (!lastEditedAt) return { text: 'Pusta notatka — zacznij pisać.', tone: 'idle' }
      const who =
        lastEditedBy === currentUserId
          ? 'Ty'
          : (lastEditedBy && userNames?.get(lastEditedBy)) || 'ktoś'
      return { text: `Ostatnio ${who}, ${relativeTime(lastEditedAt)}`, tone: 'idle' }
  }
}

function toneClasses(tone: 'idle' | 'saving' | 'dirty' | 'warn' | 'error'): string {
  if (tone === 'saving') return 'text-zinc-500 dark:text-zinc-400'
  if (tone === 'dirty') return 'text-amber-600 dark:text-amber-400'
  if (tone === 'warn') return 'text-amber-700 dark:text-amber-300'
  if (tone === 'error') return 'text-red-600 dark:text-red-400'
  return 'text-zinc-500 dark:text-zinc-400'
}

function ChannelNoteEditor({
  cohortId,
  channelId,
  channelName,
  currentUserId,
  userNames,
}: Omit<SharedProps, 'onClose'>) {
  const {
    content,
    server,
    status,
    isDirty,
    onChangeDraft,
    saveNow,
    acceptRemote,
    overrideWithMine,
  } = useChannelNote({ cohortId, channelId, currentUserId })

  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  // Ctrl/Cmd+S → manual save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (status !== 'saving' && status !== 'loading') void saveNow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveNow, status])

  const label = statusLabel(
    status,
    server?.lastEditedBy ?? null,
    server?.lastEditedAt ?? null,
    currentUserId,
    userNames,
  )
  const isConflict = status === 'conflict' || status === 'remote-update'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10">
        <StickyNote
          size={14}
          className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-primary">
            Notatki: {channelName}
          </p>
          <p className={`mt-0.5 truncate text-[11px] ${toneClasses(label.tone)}`}>
            {label.text}
            {isDirty && status !== 'saving' && status !== 'dirty' && !isConflict && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">·  niezapisane</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveNow()}
          disabled={status === 'saving' || status === 'loading'}
          aria-label="Zapisz teraz (Ctrl+S)"
          title="Zapisz teraz (Ctrl+S)"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-zinc-600 transition-colors hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
        >
          {status === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Zapisz
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-zinc-200 px-2 py-1.5 dark:border-white/10">
        <button
          type="button"
          onClick={() => setTab('edit')}
          aria-pressed={tab === 'edit'}
          className={[
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors',
            tab === 'edit'
              ? 'bg-[#1e293b] text-white dark:bg-brand-gold dark:text-black'
              : 'text-zinc-500 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]',
          ].join(' ')}
        >
          <Pencil size={11} />
          Edycja
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          aria-pressed={tab === 'preview'}
          className={[
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors',
            tab === 'preview'
              ? 'bg-[#1e293b] text-white dark:bg-brand-gold dark:text-black'
              : 'text-zinc-500 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.06]',
          ].join(' ')}
        >
          <Eye size={11} />
          Podgląd
        </button>
        <div className="ml-auto text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {content.length} znaków · v{server?.version ?? 0}
        </div>
      </div>

      {/* Conflict banner */}
      {isConflict && (
        <div className="flex items-start gap-2 border-b border-amber-300/40 bg-amber-50/80 px-3 py-2 text-[12px] dark:border-amber-300/30 dark:bg-amber-300/10">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="min-w-0 flex-1 text-amber-800 dark:text-amber-200">
            <p className="font-semibold">
              {status === 'conflict'
                ? 'Konflikt zapisu — ktoś zaktualizował notatkę zanim Ty zapisałeś.'
                : 'Inna osoba zapisała zmiany w trakcie Twojej edycji.'}
            </p>
            <p className="mt-0.5">
              Wybierz: <strong>Pobierz cudze</strong> (Twoje zmiany przepadną) lub
              {' '}<strong>Zachowaj moje</strong> (nadpisze cudze).
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={acceptRemote}
                className="inline-flex items-center gap-1 rounded-md bg-amber-600/15 px-2 py-1 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-600/25 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25"
              >
                <RefreshCcw size={11} />
                Pobierz cudze
              </button>
              <button
                type="button"
                onClick={() => void overrideWithMine()}
                className="inline-flex items-center gap-1 rounded-md bg-amber-700 px-2 py-1 text-[11px] font-bold text-white transition-colors hover:bg-amber-700/90 dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400"
              >
                <Check size={11} />
                Zachowaj moje
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body — edit or preview */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => onChangeDraft(e.target.value)}
            spellCheck
            placeholder={
              'Tu możesz wspólnie pisać notatki z wykładu / projektu / kolokwium.\n' +
              'Markdown wspierany: **bold**, *italic*, # nagłówki, - listy, > cytaty, `kod`.\n' +
              'Każdy w roczniku może edytować. Autosave co 1.5s.'
            }
            className="custom-scrollbar h-full w-full resize-none bg-transparent px-3 py-2.5 font-mono text-[13px] leading-relaxed text-fg-primary outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />
        ) : (
          <div className="custom-scrollbar h-full overflow-y-auto px-3 py-2.5">
            {content.trim().length === 0 ? (
              <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
                Notatka jest pusta. Przełącz się na „Edycja" i zacznij pisać.
              </p>
            ) : (
              <article className="prose prose-sm dark:prose-invert max-w-none text-fg-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </article>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Desktop right side panel — inline w 3-column AulaView. Caller toggluje
 * widoczność przez własny state; my po prostu rendrujemy zawartość.
 */
export function ChannelNotePanel({
  cohortId,
  channelId,
  channelName,
  currentUserId,
  userNames,
  onClose,
}: SharedProps) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-white/10 dark:bg-bg-card xl:flex">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
        <span>Wspólna notatka</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij notatki"
          className="rounded-md p-1 text-zinc-400 hover:bg-black/[0.05] hover:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
        >
          <X size={13} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ChannelNoteEditor
          cohortId={cohortId}
          channelId={channelId}
          channelName={channelName}
          currentUserId={currentUserId}
          userNames={userNames}
        />
      </div>
    </aside>
  )
}

/**
 * Mobile bottom sheet — analogicznie do MembersSheet/ChannelsSheet.
 * `max-h-[85vh]` żeby textarea miała sensowną wysokość edycji nawet
 * z keyboard'em wysuniętym.
 */
export function ChannelNoteSheet({
  cohortId,
  channelId,
  channelName,
  currentUserId,
  userNames,
  onClose,
}: SharedProps) {
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverflow = html.style.overflow
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    return () => {
      body.style.overflow = prevBodyOverflow
      html.style.overflow = prevHtmlOverflow
    }
  }, [])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose()
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Notatki sali"
      className="fixed inset-0 z-210 xl:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <motion.div
        className="absolute inset-x-0 bottom-0 z-220 flex max-h-[85vh] flex-col rounded-t-3xl border border-zinc-200 bg-white/95 backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={
          shouldReduceMotion
            ? { duration: 0.16 }
            : { type: 'spring', stiffness: 460, damping: 40, mass: 0.7 }
        }
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.18}
        onDragEnd={handleDragEnd}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-white/15" />
        <div className="min-h-0 flex-1">
          <ChannelNoteEditor
            cohortId={cohortId}
            channelId={channelId}
            channelName={channelName}
            currentUserId={currentUserId}
            userNames={userNames}
          />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

/**
 * Pojedynczy export Animate wrapper na desktopie — AulaView używa go żeby
 * panel slide-in'ował z prawej. Mobile sheet jest portalem, więc Animate
 * Presence dla niego trzyma AulaView samodzielnie.
 */
export function AnimatedNotePanel(props: SharedProps & { open: boolean }) {
  const { open, ...rest } = props
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="note-panel"
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 36, mass: 0.7 }}
          className="hidden xl:contents"
        >
          <ChannelNotePanel {...rest} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
