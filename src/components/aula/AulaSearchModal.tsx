/**
 * UJverse — AulaSearchModal: lokalny search dla AulaView.
 * Bottom-sheet mobile / center-modal desktop. Debounced search-as-you-type
 * przez `SearchService.searchAula`. Klik wiersza → `onJump(messageId)` →
 * AulaView.jumpToMessage scroll+highlight.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { GraduationCap, Loader2, Paperclip, Search, X } from 'lucide-react'
import { SearchService } from '../../services/SearchService'
import type { AulaSearchHit } from '../../types/search'
import { relativeTime } from '../../lib/utils'
import type { ChannelKind } from '../../types/database'
import ChannelKindPill, { CHANNEL_KINDS } from './ChannelKindPill'

/**
 * Defensywne mapowanie raw string z search hita / propsa na `ChannelKind`.
 * Legacy dokumenty bez `channelKind` lub z nieznaną wartością → `inne`
 * (najmniej krzykliwy pill).
 */
function asChannelKind(raw: string | null | undefined): ChannelKind {
  if (typeof raw === 'string' && (CHANNEL_KINDS as readonly string[]).includes(raw)) {
    return raw as ChannelKind
  }
  return 'inne'
}

type Props = {
  cohortId: string
  onJump: (messageId: number) => void
  onClose: () => void
  /**
   * Aktualnie aktywny kanał w AulaView. Wyświetlamy toggle "Tylko ten kanał"
   * gdy aktywny jest **konkretny** sub-channel (number). Dla #general (null)
   * toggle nie ma sensu — i tak wpadłby filter `channelId IS NULL` co dla
   * większości userów jest po prostu cała Aula.
   */
  activeChannelId?: number | null
  activeChannelName?: string | null
  activeChannelKind?: ChannelKind | null
}

const DEBOUNCE_MS = 200
const RESULT_LIMIT = 20

export default function AulaSearchModal({
  cohortId,
  onJump,
  onClose,
  activeChannelId,
  activeChannelName,
  activeChannelKind,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<AulaSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqIdRef = useRef(0)
  const debounceRef = useRef<number | null>(null)
  const [onlyThisChannel, setOnlyThisChannel] = useState(false)
  const [selectedKinds, setSelectedKinds] = useState<Set<ChannelKind>>(new Set())

  // Reset toggle gdy zmieni się aktywny kanał (otwarcie modala z innego
  // kontekstu) — defensywnie żeby state nie wisiał z poprzedniego widoku.
  useEffect(() => {
    setOnlyThisChannel(false)
    setSelectedKinds(new Set())
  }, [activeChannelId])

  // Toggle dostępny tylko gdy aktywny jest konkretny sub-channel.
  const canFilterByChannel =
    typeof activeChannelId === 'number' && activeChannelId !== null

  // Kind filter mutex: gdy filtrujemy konkretny kanał, kind ignorujemy
  // (jednoznaczny). Disabled UI sygnalizuje to opacity + pointer-events.
  const kindFilterDisabled = onlyThisChannel && canFilterByChannel

  const toggleKind = useCallback((kind: ChannelKind) => {
    setSelectedKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  // Stabilny key dla dependency array — Set referential equality nie działa.
  const selectedKindsKey = useMemo(
    () => Array.from(selectedKinds).sort().join(','),
    [selectedKinds],
  )

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length === 0) {
      setHits([])
      setLoading(false)
      setError(null)
      reqIdRef.current += 1
      return
    }
    setLoading(true)
    setError(null)
    debounceRef.current = window.setTimeout(() => {
      const reqId = ++reqIdRef.current
      const channelFilter =
        onlyThisChannel && canFilterByChannel ? activeChannelId : undefined
      const kindsFilter =
        kindFilterDisabled || selectedKinds.size === 0
          ? undefined
          : Array.from(selectedKinds)
      void SearchService.searchAula(trimmed, {
        cohortId,
        limit: RESULT_LIMIT,
        channelId: channelFilter,
        channelKinds: kindsFilter,
      })
        .then((result) => {
          if (reqId !== reqIdRef.current) return
          setHits(result.hits)
        })
        .catch((err: unknown) => {
          if (reqId !== reqIdRef.current) return
          setError(err instanceof Error ? err.message : 'Błąd wyszukiwania')
          setHits([])
        })
        .finally(() => {
          if (reqId === reqIdRef.current) setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current)
    }
  }, [
    query,
    cohortId,
    onlyThisChannel,
    canFilterByChannel,
    activeChannelId,
    selectedKindsKey,
    kindFilterDisabled,
    selectedKinds,
  ])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose()
  }

  const handlePick = useCallback(
    (messageId: number) => {
      onJump(messageId)
      onClose()
    },
    [onJump, onClose],
  )

  const body = (
    <>
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-white/10">
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-black/30">
          <Search size={16} strokeWidth={2} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj w Auli — wiadomości, autorzy, pliki..."
            // text-base na mobile → no iOS auto-zoom; sm:text-sm na PC.
            className="ujverse-search-input flex-1 bg-transparent text-base text-zinc-800 outline-none placeholder:text-zinc-400 sm:text-sm dark:text-zinc-100 dark:placeholder:text-zinc-500"
            autoComplete="off"
            spellCheck={false}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
              aria-label="Wyczyść"
            >
              <X size={14} strokeWidth={2.25} />
            </button>
          )}
        </div>
        {canFilterByChannel && activeChannelName && (
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={onlyThisChannel}
              onChange={(e) => setOnlyThisChannel(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-[#1e293b] focus:ring-[#1e293b] dark:border-white/20 dark:bg-black/30 dark:text-brand-gold-bright"
            />
            <span className="inline-flex items-center gap-1">
              Tylko w sali
              {activeChannelKind ? (
                <ChannelKindPill kind={activeChannelKind} size="sm" />
              ) : null}
              <span className="font-semibold text-fg-primary">{activeChannelName}</span>
            </span>
          </label>
        )}

        <div
          // Na mobile (sm-): horizontal scroll z hidden scrollbarem; pills NIE
          // wrapują (gap-1.5 + 6 pillów * ~80px byłyby 3 rzędy na 360px).
          // Na desktop (sm+): flex-wrap jak dotąd.
          className={[
            'mt-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible',
            kindFilterDisabled ? 'pointer-events-none opacity-40' : '',
          ].join(' ')}
          title={
            kindFilterDisabled
              ? 'Wyłączone — filtrujesz konkretną salę'
              : undefined
          }
          aria-disabled={kindFilterDisabled}
        >
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Typ:
          </span>
          {CHANNEL_KINDS.map((k) => (
            <ChannelKindPill
              key={k}
              kind={k}
              size="sm"
              active={selectedKinds.has(k)}
              onClick={() => toggleKind(k)}
              title={`Filtruj: ${k}`}
            />
          ))}
          {selectedKinds.size > 0 && !kindFilterDisabled && (
            <button
              type="button"
              onClick={() => setSelectedKinds(new Set())}
              aria-label="Wyczyść filter typów"
              title="Wyczyść filter"
              className="ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-black/[0.06] hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {query.trim().length === 0 ? (
          <EmptyState message="Zacznij wpisywać, żeby przeszukać Aulę." />
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 size={14} className="animate-spin" />
            Szukam...
          </div>
        ) : error ? (
          <p className="px-2 py-6 text-center text-sm text-red-600 dark:text-red-300">{error}</p>
        ) : hits.length === 0 ? (
          <EmptyState message={`Brak wyników dla „${query.trim()}".`} />
        ) : (
          <ul className="space-y-1.5">
            {hits.map((hit) => (
              <li key={hit.id}>
                <ResultRow hit={hit} onPick={handlePick} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Szukaj w Auli"
      className="fixed inset-0 z-210"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />

      {/* Mobile: bottom-sheet */}
      <motion.div
        className="absolute inset-x-0 bottom-0 z-220 flex max-h-[85vh] flex-col rounded-t-3xl border border-zinc-200 bg-white/95 backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97 lg:hidden"
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
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 text-[#1e293b] dark:text-brand-gold-bright">
            <Search size={16} />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em]">
              Szukaj w Auli
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>
        {body}
      </motion.div>

      {/* Desktop: center-modal */}
      <motion.div
        className="absolute left-1/2 top-1/2 z-220 hidden w-[min(720px,92vw)] max-h-[80vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97 lg:flex"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16 } }}
        transition={
          shouldReduceMotion
            ? { duration: 0.16 }
            : { type: 'spring', stiffness: 460, damping: 42, mass: 0.7 }
        }
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2 text-[#1e293b] dark:text-brand-gold-bright">
            <Search size={16} />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em]">
              Szukaj w Auli
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>
        {body}
      </motion.div>
    </motion.div>,
    document.body,
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <GraduationCap size={28} className="text-zinc-400 dark:text-zinc-500" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
    </div>
  )
}

function ResultRow({
  hit,
  onPick,
}: {
  hit: AulaSearchHit
  onPick: (messageId: number) => void
}) {
  const snippetHtml = useMemo(
    () => hit.contentSnippetHTML ?? escapeFallback(hit.content),
    [hit.contentSnippetHTML, hit.content],
  )
  return (
    <button
      type="button"
      onClick={() => onPick(hit.messageId)}
      className="group flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-zinc-200 hover:bg-zinc-50 focus:outline-none focus-visible:border-zinc-200 focus-visible:bg-zinc-50 dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:focus-visible:border-white/10 dark:focus-visible:bg-white/[0.04]"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white/70 text-[#1e293b] dark:border-white/10 dark:bg-black/30 dark:text-brand-gold-bright">
        <GraduationCap size={14} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {hit.authorName}
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {relativeTime(hit.createdAt)}
          </span>
          {hit.channelId == null ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[#1e293b]/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e293b] dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright"
              title="Sala główna"
            >
              <GraduationCap size={9} />
              Sala główna
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1"
              title={`Sala: ${hit.channelName ?? hit.channelSlug ?? ''}`}
            >
              <ChannelKindPill kind={asChannelKind(hit.channelKind)} size="sm" />
              <span className="text-[10px] font-semibold text-fg-primary">
                {hit.channelName ?? hit.channelSlug}
              </span>
            </span>
          )}
          {hit.hasAttachments && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600 dark:border-white/10 dark:bg-black/30 dark:text-zinc-300"
              title={`${hit.fileNames.length} ${hit.fileNames.length === 1 ? 'plik' : 'plików'}`}
            >
              <Paperclip size={10} strokeWidth={2.25} />
              {hit.fileNames.length}
            </span>
          )}
        </div>
        {snippetHtml && (
          <p
            className="mt-0.5 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-200 [&_mark]:rounded [&_mark]:bg-brand-gold/35 [&_mark]:px-0.5 [&_mark]:text-zinc-900 dark:[&_mark]:bg-brand-gold-bright/30 dark:[&_mark]:text-zinc-50"
            dangerouslySetInnerHTML={{ __html: snippetHtml }}
          />
        )}
      </div>
    </button>
  )
}

function escapeFallback(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
