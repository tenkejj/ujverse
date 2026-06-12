import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  Check,
  CornerUpLeft,
  Languages,
  Lightbulb,
  Pencil,
  Pin,
  PinOff,
  Scissors,
  SmilePlus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import UserAvatar from '../UserAvatar'
import { relativeTime } from '../../lib/utils'
import { MENTION_REGEX } from '../../lib/aulaMentions'
import type { CohortMessageNode } from '../../hooks/useCohortMessages'
import type { ReactionAggregate } from '../../hooks/useCohortReactions'
import type { CohortMessageAttachment, CohortPollAggregate } from '../../types/database'
import ReactionBar from './ReactionBar'
import EmojiReactionPicker from './EmojiReactionPicker'
import MessageAttachments from './MessageAttachments'
import PollDisplay from './PollDisplay'

const MENTION_URI_PREFIX = 'mention://'

/**
 * Pre-process treści: zamień `@username` (z prefixem whitespace/BOL) na
 * markdown link `[@username](mention://username)`. Custom renderer `a`
 * niżej rozpoznaje schemat i renderuje przycisk-mention zamiast linka.
 */
function preprocessMentions(content: string): string {
  if (!content) return ''
  const re = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
  return content.replace(re, (_full, username: string, offset: number, src: string) => {
    // Zachowaj poprzedzający whitespace (jeśli był) — regex go zjada w match'u.
    const prefixChar = offset > 0 ? src[offset] : ''
    const leading = prefixChar && /\s/.test(prefixChar) ? prefixChar : ''
    return `${leading}[@${username}](${MENTION_URI_PREFIX}${username.toLowerCase()})`
  })
}

function MessageBody({ content }: { content: string }) {
  const navigate = useNavigate()
  const processed = useMemo(() => preprocessMentions(content), [content])

  const components = useMemo<Components>(
    () => ({
      p: ({ children }) => (
        <p className="my-0 whitespace-pre-wrap leading-relaxed wrap-break-word">{children}</p>
      ),
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      code: ({ children }) => (
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px] dark:bg-white/10">
          {children}
        </code>
      ),
      ul: ({ children }) => (
        <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>
      ),
      li: ({ children }) => <li className="leading-snug">{children}</li>,
      a: ({ href, children }) => {
        if (href && href.startsWith(MENTION_URI_PREFIX)) {
          const username = href.slice(MENTION_URI_PREFIX.length)
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/u/${encodeURIComponent(username)}`)
              }}
              className="rounded px-0.5 font-semibold text-[#1e293b] underline-offset-2 hover:underline dark:text-brand-gold-bright"
            >
              {children}
            </button>
          )
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1e293b] underline underline-offset-2 hover:opacity-80 dark:text-brand-gold-bright"
          >
            {children}
          </a>
        )
      },
    }),
    [navigate],
  )

  return (
    <div className="mt-0.5 text-sm text-fg-primary/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        disallowedElements={['img', 'iframe', 'script', 'style', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td']}
        unwrapDisallowed
        skipHtml
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}

type Props = {
  node: CohortMessageNode
  currentUserId: string
  depth?: number
  highlightId?: number | null
  /** Rejestracja DOM-refów po `id` — używana przez AulaView do scroll-to (deep-link). */
  registerRef?: (id: number, el: HTMLDivElement | null) => void
  onReply: (id: number, authorName: string) => void
  onEdit: (id: number, content: string) => void
  onDelete: (id: number) => void
  /** Reaktywne. */
  reactionsByMessage?: Map<number, ReactionAggregate[]>
  onToggleReaction?: (messageId: number, emoji: string) => void
  /** Mapa userId → display name (do tooltipów reakcji). */
  userNames?: Map<string, string>
  onTogglePin?: (messageId: number) => void
  /** Set userId obecnie online — kropka na avatarze. */
  onlineIds?: Set<string>
  /** Załączniki per messageId — przekazywane z hooka useCohortAttachments. */
  attachmentsByMessage?: Map<number, CohortMessageAttachment[]>
  /** Cache signed URLs z hooka useCohortAttachments. */
  getSignedUrl?: (path: string) => string | null
  /** Hard-delete pojedynczego załącznika (własnego). */
  onDeleteAttachment?: (attachment: CohortMessageAttachment) => void
  /** Polls per messageId — z useCohortPolls. */
  pollsByMessage?: Map<number, CohortPollAggregate>
  /** Optimistic vote (single-select, optionIndex=null = cofnij głos). */
  onVotePoll?: (messageId: number, optionIndex: number | null) => void
  /** Zamknij poll (creator only — RPC i tak enforce'uje). */
  onClosePoll?: (messageId: number) => void
  /**
   * AI quick action na treści wiadomości. Tryb `'explain' | 'simplify' |
   * 'translate'`. Brak handlera = przycisk AI w hover-actions nie pojawia się
   * (graceful degradation gdy AI niedostępne / wyłączone na danym widoku).
   * Wywoływane tylko dla NIE-usuniętych wiadomości z niepustą treścią.
   */
  onAiAction?: (
    action: 'explain' | 'simplify' | 'translate',
    payload: { messageId: number; text: string; authorName: string },
  ) => void
}

const MAX_DEPTH = 2

export default function AulaMessageItem({
  node,
  currentUserId,
  depth = 0,
  highlightId,
  registerRef,
  onReply,
  onEdit,
  onDelete,
  reactionsByMessage,
  onToggleReaction,
  userNames,
  onTogglePin,
  onlineIds,
  attachmentsByMessage,
  getSignedUrl,
  onDeleteAttachment,
  pollsByMessage,
  onVotePoll,
  onClosePoll,
  onAiAction,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.content)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const aiMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!aiMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aiMenuOpen])

  const author = node.profiles ?? null
  const authorName = author?.full_name || author?.username || 'Użytkownik'
  const isOwn = node.user_id === currentUserId
  const isDeleted = node.deleted_at != null
  const isHighlighted = highlightId != null && highlightId === node.id
  const isPinned = node.pinned_at != null && !isDeleted
  const isAuthorOnline = !!onlineIds?.has(node.user_id)
  const reactions = reactionsByMessage?.get(node.id) ?? []
  const attachments = attachmentsByMessage?.get(node.id) ?? []
  const pollAggregate = pollsByMessage?.get(node.id) ?? null

  const saveEdit = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onEdit(node.id, trimmed)
    setEditing(false)
  }

  const handleEditKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      setEditing(false)
      setDraft(node.content)
    }
  }

  return (
    <div
      ref={(el) => registerRef?.(node.id, el)}
      data-message-id={node.id}
      className={depth > 0 ? 'mt-2 border-l-2 border-zinc-200 pl-3 dark:border-white/10' : ''}
    >
      <div
        className={`group relative flex gap-2.5 rounded-xl px-2 py-1.5 transition-colors ${
          isHighlighted
            ? 'bg-brand-gold/15 dark:bg-brand-gold-bright/10'
            : isPinned
              ? 'bg-[#1e293b]/[0.025] dark:bg-brand-gold-bright/[0.04]'
              : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
        }`}
      >
        <div className="relative shrink-0">
          <UserAvatar
            profile={author}
            name={authorName}
            className="h-8 w-8 ring-1 ring-zinc-900/10 dark:ring-white/10"
            textSize="text-xs"
          />
          {isAuthorOnline && (
            <span
              aria-label="Online"
              className="pointer-events-none absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-bg-card"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-fg-primary">{authorName}</span>
            <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-500">
              {relativeTime(node.created_at)}
              {node.edited_at && !isDeleted ? ' · edytowano' : ''}
            </span>
            {isPinned && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1e293b]/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#1e293b] dark:bg-brand-gold-bright/[0.12] dark:text-brand-gold-bright"
                title="Przypięte"
              >
                <Pin size={9} strokeWidth={2.5} />
                Pin
              </span>
            )}
          </div>

          {isDeleted ? (
            <p className="mt-0.5 text-sm italic text-zinc-400 dark:text-zinc-500">
              Wiadomość usunięta.
            </p>
          ) : editing ? (
            <div className="mt-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleEditKey}
                rows={2}
                className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5 text-base text-zinc-900 outline-none focus:border-[#1e293b] sm:text-sm dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-brand-gold-bright"
                autoFocus
              />
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1e293b] px-2.5 py-1 text-xs font-semibold text-white dark:bg-brand-gold dark:text-black"
                >
                  <Check size={13} /> Zapisz
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraft(node.content) }}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
                >
                  <X size={13} /> Anuluj
                </button>
              </div>
            </div>
          ) : (
            <MessageBody content={node.content} />
          )}

          {!isDeleted && attachments.length > 0 && getSignedUrl && (
            <MessageAttachments
              attachments={attachments}
              getSignedUrl={getSignedUrl}
              isOwner={isOwn}
              onDelete={onDeleteAttachment}
            />
          )}

          {!isDeleted && pollAggregate && onVotePoll && (
            <PollDisplay
              aggregate={pollAggregate}
              currentUserId={currentUserId}
              userNames={userNames}
              onVote={onVotePoll}
              onClose={onClosePoll}
            />
          )}

          {!isDeleted && reactions.length > 0 && (
            <ReactionBar
              reactions={reactions}
              onToggle={(emoji) => onToggleReaction?.(node.id, emoji)}
              userNames={userNames}
            />
          )}

          {!isDeleted && !editing && (
            // Mobile (sm-): zawsze widoczne (touch nie ma hovera!).
            // Desktop (sm+): hover/focus-within reveal — czysto wizualnie.
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              {depth < MAX_DEPTH && (
                <button
                  type="button"
                  onClick={() => onReply(node.id, authorName)}
                  className="inline-flex min-h-[28px] items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-[#1e293b] dark:text-zinc-400 dark:hover:text-brand-gold-bright"
                >
                  <CornerUpLeft size={12} /> Odpowiedz
                </button>
              )}
              {onToggleReaction && (
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={pickerOpen}
                  className="inline-flex min-h-[28px] items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-[#1e293b] dark:text-zinc-400 dark:hover:text-brand-gold-bright"
                >
                  <SmilePlus size={12} /> Reaguj
                </button>
              )}
              {onTogglePin && (
                <button
                  type="button"
                  onClick={() => onTogglePin(node.id)}
                  className="inline-flex min-h-[28px] items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-[#1e293b] dark:text-zinc-400 dark:hover:text-brand-gold-bright"
                >
                  {isPinned ? (
                    <>
                      <PinOff size={12} /> Odepnij
                    </>
                  ) : (
                    <>
                      <Pin size={12} /> Przypnij
                    </>
                  )}
                </button>
              )}
              {onAiAction && node.content.trim().length > 0 && (
                <div ref={aiMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAiMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={aiMenuOpen}
                    title="AI: wyjaśnij / streść / przetłumacz"
                    className="inline-flex min-h-[28px] items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-violet-300"
                  >
                    <Sparkles size={12} /> AI
                  </button>
                  {aiMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-bg-card"
                    >
                      <AiMenuItem
                        icon={<Lightbulb size={13} />}
                        label="Wyjaśnij prościej"
                        onClick={() => {
                          setAiMenuOpen(false)
                          onAiAction('explain', {
                            messageId: node.id,
                            text: node.content,
                            authorName,
                          })
                        }}
                      />
                      <AiMenuItem
                        icon={<Scissors size={13} />}
                        label="Streść w 2 zdaniach"
                        onClick={() => {
                          setAiMenuOpen(false)
                          onAiAction('simplify', {
                            messageId: node.id,
                            text: node.content,
                            authorName,
                          })
                        }}
                      />
                      <AiMenuItem
                        icon={<Languages size={13} />}
                        label="Przetłumacz na EN"
                        onClick={() => {
                          setAiMenuOpen(false)
                          onAiAction('translate', {
                            messageId: node.id,
                            text: node.content,
                            authorName,
                          })
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              {isOwn && (
                <>
                  <button
                    type="button"
                    onClick={() => { setDraft(node.content); setEditing(true) }}
                    className="inline-flex min-h-[28px] items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-[#1e293b] dark:text-zinc-400 dark:hover:text-brand-gold-bright"
                  >
                    <Pencil size={12} /> Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(node.id)}
                    className="inline-flex min-h-[28px] items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400"
                  >
                    <Trash2 size={12} /> Usuń
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {pickerOpen && onToggleReaction && (
          <EmojiReactionPicker
            onPick={(emoji) => onToggleReaction(node.id, emoji)}
            onClose={() => setPickerOpen(false)}
            positionClass="absolute -top-9 right-2"
          />
        )}
      </div>

      {node.children.length > 0 && (
        <div className={depth + 1 <= MAX_DEPTH ? '' : 'pl-0'}>
          {node.children.map((child) => (
            <AulaMessageItem
              key={child.id}
              node={child}
              currentUserId={currentUserId}
              depth={Math.min(depth + 1, MAX_DEPTH)}
              highlightId={highlightId}
              registerRef={registerRef}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              reactionsByMessage={reactionsByMessage}
              onToggleReaction={onToggleReaction}
              userNames={userNames}
              onTogglePin={onTogglePin}
              onlineIds={onlineIds}
              attachmentsByMessage={attachmentsByMessage}
              getSignedUrl={getSignedUrl}
              onDeleteAttachment={onDeleteAttachment}
              pollsByMessage={pollsByMessage}
              onVotePoll={onVotePoll}
              onClosePoll={onClosePoll}
              onAiAction={onAiAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AiMenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-violet-500/10 hover:text-violet-700 dark:text-zinc-200 dark:hover:bg-violet-400/10 dark:hover:text-violet-200"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center text-violet-500 dark:text-violet-300">
        {icon}
      </span>
      {label}
    </button>
  )
}
