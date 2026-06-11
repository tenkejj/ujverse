/**
 * UJverse — RecentFilesPanel: drawer (desktop) / bottom-sheet (mobile)
 * z listą ostatnich plików rocznika, grupowanych po dacie i z filter chipami.
 * Lazy fetch: zaciągamy listę dopiero po otwarciu.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { Download, ExternalLink, FolderOpen, X } from 'lucide-react'
import { CohortService } from '../../services/CohortService'
import { formatFileSize, getFileIcon, isImageMime } from '../../lib/aulaUpload'
import type { CohortMessageAttachment } from '../../types/database'
import type { Profile } from '../../types'
import UserAvatar from '../UserAvatar'

type RecentFile = CohortMessageAttachment & { profiles: Profile | null }

type FilterKey = 'all' | 'images' | 'docs' | 'other'

type Props = {
  cohortId: string
  onClose: () => void
}

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Wszystkie',
  images: 'Obrazki',
  docs: 'Dokumenty',
  other: 'Inne',
}

function classifyFilter(mime: string): FilterKey {
  if (isImageMime(mime)) return 'images'
  if (
    mime === 'application/pdf' ||
    mime.includes('word') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.startsWith('text/') ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.ms-powerpoint'
  ) {
    return 'docs'
  }
  return 'other'
}

function dateBucket(iso: string): { key: string; label: string; order: number } {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const today = startOfDay(now)
  const yesterday = today - 24 * 60 * 60 * 1000
  const weekAgo = today - 7 * 24 * 60 * 60 * 1000
  const ts = startOfDay(d)

  if (ts >= today) return { key: 'today', label: 'Dziś', order: 0 }
  if (ts >= yesterday) return { key: 'yesterday', label: 'Wczoraj', order: 1 }
  if (ts >= weekAgo) return { key: 'week', label: 'W tym tygodniu', order: 2 }
  return { key: 'older', label: 'Wcześniej', order: 3 }
}

function FilePreviewIcon({
  attachment,
  signedUrl,
}: {
  attachment: RecentFile
  signedUrl: string | null
}) {
  const Icon = getFileIcon(attachment.mime_type)
  if (isImageMime(attachment.mime_type) && signedUrl) {
    return (
      <img
        src={signedUrl}
        alt={attachment.file_name}
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-md object-cover"
      />
    )
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
      <Icon size={18} />
    </div>
  )
}

function FileRow({
  file,
  signedUrl,
}: {
  file: RecentFile
  signedUrl: string | null
}) {
  const authorName = file.profiles?.full_name || file.profiles?.username || 'Użytkownik'
  const dateText = new Date(file.created_at).toLocaleString('pl-PL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2 transition-colors hover:bg-zinc-50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]">
      <FilePreviewIcon attachment={file} signedUrl={signedUrl} />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium text-fg-primary"
          title={file.file_name}
        >
          {file.file_name}
        </p>
        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
          {formatFileSize(file.size_bytes)} · {dateText}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {file.profiles && (
            <UserAvatar
              profile={file.profiles}
              name={authorName}
              className="h-4 w-4"
              textSize="text-[8px]"
            />
          )}
          <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-500">
            {authorName}
          </span>
        </div>
      </div>
      {signedUrl ? (
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Otwórz"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-black/5 hover:text-[#1e293b] dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-brand-gold-bright"
          >
            <ExternalLink size={14} />
          </a>
          <a
            href={signedUrl}
            download={file.file_name}
            aria-label="Pobierz"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-black/5 hover:text-[#1e293b] dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-brand-gold-bright"
          >
            <Download size={14} />
          </a>
        </div>
      ) : (
        <span className="h-5 w-5 shrink-0 animate-pulse rounded bg-zinc-200 dark:bg-white/10" />
      )}
    </div>
  )
}

export default function RecentFilesPanel({ cohortId, onClose }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState<RecentFile[]>([])
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map())
  const [filter, setFilter] = useState<FilterKey>('all')
  const fetchedRef = useRef(false)

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
    if (fetchedRef.current) return
    fetchedRef.current = true
    let cancelled = false
    void (async () => {
      const { data, error } = await CohortService.getRecentFiles(cohortId, 50)
      if (cancelled) return
      if (!error) {
        setFiles(data)
        const paths = data.map((f) => f.storage_path)
        const urls = await CohortService.signedUrlsForPaths(paths, 3600)
        if (!cancelled) setSignedUrls(urls)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [cohortId])

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: files.length, images: 0, docs: 0, other: 0 }
    for (const f of files) c[classifyFilter(f.mime_type)] += 1
    return c
  }, [files])

  const filtered = useMemo(() => {
    if (filter === 'all') return files
    return files.filter((f) => classifyFilter(f.mime_type) === filter)
  }, [files, filter])

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; order: number; rows: RecentFile[] }>()
    for (const f of filtered) {
      const b = dateBucket(f.created_at)
      const existing = map.get(b.key)
      if (existing) existing.rows.push(f)
      else map.set(b.key, { label: b.label, order: b.order, rows: [f] })
    }
    return Array.from(map.values()).sort((a, b) => a.order - b.order)
  }, [filtered])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose()
  }

  const body = (
    <>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-2">
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? 'border-[#1e293b] bg-[#1e293b] text-white dark:border-brand-gold-bright dark:bg-brand-gold-bright dark:text-black'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]'
              }`}
            >
              {FILTER_LABELS[key]} ({counts[key]})
            </button>
          )
        })}
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-zinc-200/70 dark:bg-white/[0.04]"
              />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FolderOpen size={28} className="text-zinc-400 dark:text-zinc-500" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Brak plików w tej kategorii.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {grouped.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.rows.map((f) => (
                    <FileRow
                      key={f.id}
                      file={f}
                      signedUrl={signedUrls.get(f.storage_path) ?? null}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Pliki rocznika"
      className="fixed inset-0 z-210"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />

      {/* Mobile: bottom-sheet */}
      <motion.div
        className="absolute inset-x-0 bottom-0 z-220 flex max-h-[80vh] flex-col rounded-t-3xl border border-zinc-200 bg-white/95 backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97 lg:hidden"
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
            <FolderOpen size={16} />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em]">
              Pliki rocznika ({files.length})
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

      {/* Desktop: right-side drawer */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 z-220 hidden w-[420px] flex-col border-l border-zinc-200 bg-white/95 backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97 lg:flex"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={
          shouldReduceMotion
            ? { duration: 0.16 }
            : { type: 'spring', stiffness: 460, damping: 40, mass: 0.7 }
        }
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2 text-[#1e293b] dark:text-brand-gold-bright">
            <FolderOpen size={16} />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em]">
              Pliki rocznika ({files.length})
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
        <div className="pt-2" />
        {body}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
