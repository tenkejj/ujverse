/**
 * UJverse — AiInsightModal: uniwersalny modal dla AI-generowanej zawartości
 * w Auli (streszczenie sali, wyjaśnienie wiadomości, tłumaczenie).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Kontrakt:
 *   - `start: () => AsyncGenerator<string>` — fabryka strumienia (wywołana
 *     przez modal po mount + po kliknięciu „Spróbuj jeszcze raz"). Świadomie
 *     factory zamiast gotowego generatora — pozwala retry bez kłopotów
 *     z re-mountem komponentu.
 *   - `title` / `subtitle` / `icon` — header
 *   - `kind` — wpływa na ton kolorów (sparkles vs default)
 *   - `onClose` — zamknięcie
 *
 * UX:
 *   - Streaming markdown przez `TypewriterMarkdown`
 *   - Bottom action bar: Spróbuj jeszcze raz | Kopiuj (do schowka) | Zamknij
 *   - ESC zamyka, klik w backdrop zamyka, drag-to-close na mobile (bottom sheet)
 *   - Abort: AbortController unmount → fetch cancel (jeśli `start` zaaranżuje
 *     swój signal). Domyślny stream nie podpina abortu — to OK dla MVP
 *     bo response jest krótki (<500 tokenów).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { Check, Copy, Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import TypewriterMarkdown from '../chat/TypewriterMarkdown'
import { consumeStream } from '../../services/ai/AulaAiService'

type Props = {
  title: string
  subtitle?: string
  /** Lazy factory — wywoływana per attempt (mount + retry). */
  start: () => AsyncGenerator<string, void, void>
  onClose: () => void
  /** Custom error message gdy stream throw. Default = error.message. */
  fallbackErrorMessage?: string
}

export default function AiInsightModal({
  title,
  subtitle,
  start,
  onClose,
  fallbackErrorMessage,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const [content, setContent] = useState('')
  const [streaming, setStreaming] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const attemptRef = useRef(0)

  const runStream = useCallback(() => {
    const myAttempt = attemptRef.current + 1
    attemptRef.current = myAttempt

    setContent('')
    setErrorMsg(null)
    setStreaming(true)
    setCopied(false)

    const gen = start()

    void consumeStream(
      gen,
      (delta) => {
        // Guard: jeśli rozpoczęto nową próbę (retry), ignoruj stare delty.
        if (myAttempt !== attemptRef.current) return
        setContent((prev) => prev + delta)
      },
      () => {
        if (myAttempt !== attemptRef.current) return
        setStreaming(false)
      },
      (err) => {
        if (myAttempt !== attemptRef.current) return
        setErrorMsg(err.message || fallbackErrorMessage || 'AI nie odpowiedziało.')
        setStreaming(false)
      },
    )
  }, [start, fallbackErrorMessage])

  useEffect(() => {
    runStream()
    // Świadomie tylko initial mount — retry idzie przez handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ESC zamyka.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock scroll w tle.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  const handleCopy = async () => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore — niektóre browsery wymagają HTTPS / user gesture; UX nie krytyczny
    }
  }

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose()
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-210 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        className="relative z-220 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-bg-card sm:rounded-2xl"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0, transition: { duration: 0.2 } }}
        transition={
          shouldReduceMotion
            ? { duration: 0.16 }
            : { type: 'spring', stiffness: 420, damping: 38, mass: 0.7 }
        }
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-zinc-300 sm:hidden dark:bg-white/15" />

        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md">
            <Sparkles size={16} strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-fg-primary">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-black/[0.05] hover:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {errorMsg ? (
            <div className="rounded-xl border border-rose-200/60 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200">
              {errorMsg}
            </div>
          ) : (
            <>
              <div className="prose prose-sm dark:prose-invert max-w-none text-fg-primary [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_h3]:mb-2 [&_h3]:mt-3 [&_h4]:mb-1.5 [&_h4]:mt-2">
                <TypewriterMarkdown content={content} isStreaming={streaming} />
              </div>
              {streaming && content.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                  <Loader2 size={14} className="animate-spin" />
                  AI myśli…
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200 px-4 py-2.5 dark:border-white/10">
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Asystent UJverse · qwen3 32B
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={runStream}
              disabled={streaming}
              aria-label="Spróbuj jeszcze raz"
              title="Spróbuj jeszcze raz"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600 transition-colors hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              <RotateCcw size={12} />
              Ponów
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={streaming || !content}
              aria-label="Kopiuj"
              title="Kopiuj do schowka"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600 transition-colors hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              {copied ? (
                <>
                  <Check size={12} /> Skopiowane
                </>
              ) : (
                <>
                  <Copy size={12} /> Kopiuj
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e293b] px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-[#1e293b]/90 dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85"
            >
              Zamknij
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
