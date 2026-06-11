import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { Loader2, Paperclip, SendHorizonal, X } from 'lucide-react'
import { findMentionTrigger } from '../../lib/aulaMentions'
import {
  ACCEPT_ATTR,
  formatFileSize,
  getFileIcon,
  isImageMime,
  uploadAulaFile,
  validateFile,
} from '../../lib/aulaUpload'
import { toast } from '../../lib/appToast'
import type { CohortMemberProfile } from '../../services/CohortService'
import type { Profile } from '../../types'
import UserAvatar from '../UserAvatar'

type ReplyTarget = { id: number; authorName: string } | null

export type ComposerAttachmentInput = {
  storagePath: string
  fileName: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
}

type Props = {
  replyTarget: ReplyTarget
  onCancelReply: () => void
  onSend: (
    content: string,
    attachments?: ComposerAttachmentInput[],
  ) => void | Promise<void>
  disabled?: boolean
  /** Lista członków rocznika do autocomplete `@mention`. */
  members?: CohortMemberProfile[]
  /** ID zalogowanego usera — żeby nie sugerować mention'a samego siebie. */
  currentUserId?: string
  /** Cohort ID — wymagane do uploadu (path build + RLS). */
  cohortId?: string | null
  /**
   * Nazwa aktywnego kanału (bez `#`) do placeholder. Defaultem `'general'`.
   * Reading from useCohortChannels.activeChannel?.name ?? 'general'.
   */
  channelName?: string
  /** Banner gdy kanał zarchiwizowany — pokazuje "Kanał zarchiwizowany". */
  archivedNotice?: string | null
  /**
   * Zmiana tej wartości triggeruje `focus()` na textarea. Używamy do focusu
   * po user-click w kanał (AulaView bumpuje licznik). Initial mount NIE
   * focusuje — chronimy przed kradzieżą focusu na load.
   */
  focusKey?: number | string
}

const MENTION_RESULT_LIMIT = 6
const MAX_ATTACHMENTS_PER_MESSAGE = 10

type MentionState =
  | { open: false }
  | {
      open: true
      query: string
      start: number
      results: CohortMemberProfile[]
      highlight: number
    }

type PendingFile = {
  id: string
  file: File
  /** objectURL dla obrazków, null dla pozostałych. */
  previewUrl: string | null
  status: 'pending' | 'uploading' | 'done' | 'error'
  errorMsg?: string
  result?: ComposerAttachmentInput
}

function nextChipId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function AttachmentChip({
  pending,
  onRemove,
}: {
  pending: PendingFile
  onRemove: () => void
}) {
  const Icon = getFileIcon(pending.file.type)
  const sizeText = formatFileSize(pending.file.size)
  const showSpinner = pending.status === 'uploading'
  const showError = pending.status === 'error'

  return (
    <div
      className={`relative flex max-w-[220px] items-center gap-2 rounded-lg border px-2 py-1.5 ${
        showError
          ? 'border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10'
          : 'border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04]'
      }`}
    >
      {pending.previewUrl ? (
        <img
          src={pending.previewUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
          <Icon size={16} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-xs font-medium ${
            showError ? 'text-rose-700 dark:text-rose-300' : 'text-fg-primary'
          }`}
          title={pending.file.name}
        >
          {pending.file.name}
        </p>
        <p
          className={`text-[10px] ${
            showError
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {showError ? pending.errorMsg ?? 'Błąd uploadu' : sizeText}
        </p>
      </div>
      {showSpinner ? (
        <Loader2 size={14} className="shrink-0 animate-spin text-zinc-500 dark:text-zinc-400" />
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Usuń załącznik"
          className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

function MentionDropdown({
  results,
  highlight,
  onPick,
}: {
  results: CohortMemberProfile[]
  highlight: number
  onPick: (m: CohortMemberProfile) => void
}) {
  if (results.length === 0) return null
  return (
    <div
      role="listbox"
      aria-label="Wzmianki"
      className="absolute bottom-full left-3 right-3 mb-2 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-white/95 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.35)] backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/95 dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
    >
      {results.map((m, idx) => {
        const active = idx === highlight
        const name = m.full_name || m.username || 'Użytkownik'
        return (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={active}
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(m)
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
              active
                ? 'bg-[#1e293b]/[0.06] dark:bg-brand-gold-bright/[0.08]'
                : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
            }`}
          >
            <UserAvatar
              profile={m as Profile}
              name={name}
              className="h-7 w-7 shrink-0"
              textSize="text-[11px]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg-primary">{name}</p>
              {m.username && (
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  @{m.username}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default function AulaComposer({
  replyTarget,
  onCancelReply,
  onSend,
  disabled,
  members,
  currentUserId,
  cohortId,
  channelName,
  archivedNotice,
  focusKey,
}: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [mention, setMention] = useState<MentionState>({ open: false })
  const [pending, setPending] = useState<PendingFile[]>([])
  const [dragging, setDragging] = useState(false)
  const dragDepthRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const mentionableMembers = useMemo(() => {
    if (!members) return []
    return members
      .filter((m) => m.username && m.id !== currentUserId)
      .map((m) => ({ ...m, _u: (m.username ?? '').toLowerCase() }))
  }, [members, currentUserId])

  // Cleanup objectURLs na unmount.
  useEffect(() => {
    return () => {
      for (const p of pending) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
      }
    }
    // intencjonalnie [] — chcemy cleanup tylko przy unmount; per-item revoke
    // robimy w `removeChip`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (replyTarget) textareaRef.current?.focus()
  }, [replyTarget])

  // Focus na zmianie `focusKey` — używamy `preventScroll` żeby na mobile
  // klawiatura nie podskakiwała znacząco gdy listy długie. Initial mount
  // (focusKey === undefined / 0 na starcie AulaView) NIE focusuje, bo guard
  // skipuje gdy ref do tej pory równy `focusKey` (przy pierwszym renderze
  // ref jest undefined → ustawiamy bez focusa).
  const lastFocusKeyRef = useRef<number | string | undefined>(undefined)
  useEffect(() => {
    if (focusKey === undefined) return
    if (lastFocusKeyRef.current === undefined) {
      lastFocusKeyRef.current = focusKey
      return
    }
    if (lastFocusKeyRef.current === focusKey) return
    lastFocusKeyRef.current = focusKey
    textareaRef.current?.focus({ preventScroll: true })
  }, [focusKey])

  const addFiles = useCallback(
    (files: File[]) => {
      if (!cohortId || !currentUserId) {
        toast.error('Załączniki dostępne po wczytaniu Auli.')
        return
      }
      const remainingSlots = MAX_ATTACHMENTS_PER_MESSAGE - pending.length
      if (remainingSlots <= 0) {
        toast.error(`Maks. ${MAX_ATTACHMENTS_PER_MESSAGE} plików na wiadomość.`)
        return
      }
      const toAdd: PendingFile[] = []
      for (const file of files.slice(0, remainingSlots)) {
        const v = validateFile(file)
        if (!v.ok) {
          toast.error(v.reason)
          continue
        }
        toAdd.push({
          id: nextChipId(),
          file,
          previewUrl: isImageMime(file.type) ? URL.createObjectURL(file) : null,
          status: 'pending',
        })
      }
      if (toAdd.length > 0) setPending((prev) => [...prev, ...toAdd])
    },
    [cohortId, currentUserId, pending.length],
  )

  const removeChip = useCallback((id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const updateMentionState = (nextValue: string, caret: number) => {
    const before = nextValue.slice(0, caret)
    const trigger = findMentionTrigger(before)
    if (!trigger) {
      setMention({ open: false })
      return
    }
    const filtered = mentionableMembers
      .filter((m) => m._u.startsWith(trigger.query))
      .slice(0, MENTION_RESULT_LIMIT)
    if (filtered.length === 0) {
      setMention({ open: false })
      return
    }
    setMention({
      open: true,
      query: trigger.query,
      start: trigger.start,
      results: filtered,
      highlight: 0,
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    setValue(next)
    updateMentionState(next, e.target.selectionStart ?? next.length)
  }

  const pickMention = (m: CohortMemberProfile) => {
    if (!mention.open || !m.username) return
    const after = value.slice(mention.start + 1 + mention.query.length)
    const trailingSpace = after.startsWith(' ') ? '' : ' '
    const insertion = `@${m.username}${trailingSpace}`
    const next = value.slice(0, mention.start) + insertion + after
    setValue(next)
    setMention({ open: false })
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      const newCaret = mention.start + insertion.length
      ta.setSelectionRange(newCaret, newCaret)
    })
  }

  const submit = async () => {
    const trimmed = value.trim()
    if (sending || disabled) return
    if (!trimmed && pending.length === 0) return
    if (!cohortId || !currentUserId) return

    setSending(true)
    try {
      let attachments: ComposerAttachmentInput[] | undefined

      if (pending.length > 0) {
        // Mark all pending as uploading.
        setPending((prev) =>
          prev.map((p) =>
            p.status === 'pending' || p.status === 'error'
              ? { ...p, status: 'uploading', errorMsg: undefined }
              : p,
          ),
        )

        const results = await Promise.all(
          pending.map(async (p) => {
            try {
              const res = await uploadAulaFile(p.file, cohortId, currentUserId)
              return {
                id: p.id,
                ok: true as const,
                input: {
                  storagePath: res.path,
                  fileName: p.file.name,
                  mimeType: p.file.type,
                  sizeBytes: p.file.size,
                  width: res.width,
                  height: res.height,
                } satisfies ComposerAttachmentInput,
              }
            } catch (err) {
              return {
                id: p.id,
                ok: false as const,
                error: err instanceof Error ? err.message : 'Upload failed',
              }
            }
          }),
        )

        const failed = results.filter((r) => !r.ok)
        if (failed.length > 0) {
          setPending((prev) =>
            prev.map((p) => {
              const r = results.find((x) => x.id === p.id)
              if (!r || r.ok) return p
              return { ...p, status: 'error', errorMsg: r.error }
            }),
          )
          toast.error(
            failed.length === 1
              ? 'Plik nie został przesłany. Spróbuj ponownie.'
              : `${failed.length} plików nie zostało przesłanych.`,
          )
          return
        }

        attachments = results
          .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
          .map((r) => r.input)
      }

      await onSend(trimmed, attachments)

      // Cleanup po sukcesie.
      for (const p of pending) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
      }
      setPending([])
      setValue('')
      setMention({ open: false })
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMention({ ...mention, highlight: (mention.highlight + 1) % mention.results.length })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMention({
          ...mention,
          highlight: (mention.highlight - 1 + mention.results.length) % mention.results.length,
        })
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const picked = mention.results[mention.highlight]
        if (picked) pickMention(picked)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention({ open: false })
        return
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  // Drag-and-drop handlers — używamy dragDepthRef bo dragenter/dragleave
  // odpalają się dla każdego dziecka.
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      dragDepthRef.current += 1
      setDragging(true)
    }
  }
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setDragging(false)
    }
  }
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      dragDepthRef.current = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) addFiles(files)
    }
  }

  const canSend =
    !sending && !disabled && (value.trim().length > 0 || pending.length > 0)

  return (
    <div
      className="relative border-t border-zinc-200 bg-white/80 px-3 py-3 backdrop-blur-md dark:border-white/10 dark:bg-bg-card/80"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-t-md border-2 border-dashed border-[#1e293b]/40 bg-white/80 backdrop-blur-sm dark:border-brand-gold-bright/40 dark:bg-bg-card/80">
          <p className="text-sm font-semibold text-[#1e293b] dark:text-brand-gold-bright">
            Upuść pliki żeby załączyć
          </p>
        </div>
      )}

      {replyTarget && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[#1e293b]/15 bg-[#1e293b]/[0.04] px-3 py-1.5 text-xs text-zinc-600 dark:border-brand-gold-bright/25 dark:bg-brand-gold-bright/[0.06] dark:text-zinc-300">
          <span className="min-w-0 truncate">
            Odpowiadasz <span className="font-semibold text-[#1e293b] dark:text-brand-gold-bright">{replyTarget.authorName}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Anuluj odpowiedź"
            className="shrink-0 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {archivedNotice && (
        <div className="mb-2 rounded-lg border border-amber-400/40 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-200">
          {archivedNotice}
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((p) => (
            <AttachmentChip key={p.id} pending={p} onRemove={() => removeChip(p.id)} />
          ))}
        </div>
      )}

      {mention.open && (
        <MentionDropdown
          results={mention.results}
          highlight={mention.highlight}
          onPick={pickMention}
        />
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending || !cohortId}
          aria-label="Dodaj załącznik"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition-colors hover:bg-black/[0.04] hover:text-[#1e293b] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-brand-gold-bright"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : []
            if (files.length > 0) addFiles(files)
            // reset, żeby ten sam plik można było wybrać ponownie
            e.target.value = ''
          }}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyUp={(e) => {
            const t = e.currentTarget
            updateMentionState(t.value, t.selectionStart ?? t.value.length)
          }}
          onClick={(e) => {
            const t = e.currentTarget
            updateMentionState(t.value, t.selectionStart ?? t.value.length)
          }}
          onBlur={() => {
            window.setTimeout(() => setMention({ open: false }), 120)
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={`Wiadomość w sali ${channelName ?? 'głównej'}…  (Ctrl+Enter wysyła, @ = wzmianka)`}
          disabled={disabled}
          className="max-h-40 min-h-[44px] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#1e293b] disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-brand-gold-bright"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Wyślij"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1e293b] text-white transition-colors hover:bg-[#1e293b]/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85"
        >
          {sending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <SendHorizonal size={18} />
          )}
        </button>
      </div>
    </div>
  )
}
