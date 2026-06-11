import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GraduationCap, Loader2, Paperclip, Search, UserRound } from 'lucide-react'
import { SearchService } from '../../services/SearchService'
import type { AulaSearchHit } from '../../types/search'
import type { ChannelKind } from '../../types/database'
import BaseCard from '../ui/BaseCard'
import { relativeTime } from '../../lib/utils'
import ChannelKindPill, { CHANNEL_KINDS } from '../aula/ChannelKindPill'

/**
 * Defensywne mapowanie raw `channelKind` z search hita na `ChannelKind`.
 * Legacy dokumenty bez `channelKind` lub z nieznaną wartością → `inne`.
 */
function asChannelKind(raw: string | null | undefined): ChannelKind {
  if (typeof raw === 'string' && (CHANNEL_KINDS as readonly string[]).includes(raw)) {
    return raw as ChannelKind
  }
  return 'inne'
}

const PAGE_SIZE = 12

type Props = {
  query: string
  cohortId: string | null
  currentUserId: string | null
  onPickMessage: (messageId: number) => void
}

type LocalFilter = {
  hasAttachments: boolean
  onlyMe: boolean
  /** Sortowane alfabetycznie żeby `filterKey` był stabilny. */
  kinds: ChannelKind[]
}

const INITIAL_FILTER: LocalFilter = { hasAttachments: false, onlyMe: false, kinds: [] }

/**
 * Pełna lista wyników Auli w `/search?tab=aula`. Filtry redukują zbiór
 * server-side przez `SearchService.searchAula({ hasAttachments, authorId })`.
 * Paginacja przez `offset` (Meili limit/offset, finitePagination=true z klienta
 * nie ma znaczenia bo idziemy przez `multiSearch`).
 */
export default function AulaResultsSection({
  query,
  cohortId,
  currentUserId,
  onPickMessage,
}: Props) {
  const [filter, setFilter] = useState<LocalFilter>(INITIAL_FILTER)
  const [hits, setHits] = useState<AulaSearchHit[]>([])
  const [estimatedTotal, setEstimatedTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const reqIdRef = useRef(0)

  // Reset paginacji gdy zmienia się query / filtry — `useEffect` poniżej
  // ładuje od page=0.
  const kindsKey = filter.kinds.join(',')
  const filterKey = `${filter.hasAttachments ? '1' : '0'}_${filter.onlyMe ? '1' : '0'}_${kindsKey}`

  useEffect(() => {
    if (!cohortId || query.trim().length === 0) {
      setHits([])
      setEstimatedTotal(0)
      setError(null)
      setLoading(false)
      return
    }
    const reqId = ++reqIdRef.current
    setLoading(true)
    setError(null)
    void SearchService.searchAula(query, {
      cohortId,
      limit: PAGE_SIZE,
      offset: 0,
      hasAttachments: filter.hasAttachments || undefined,
      authorId: filter.onlyMe && currentUserId ? currentUserId : undefined,
      channelKinds: filter.kinds.length > 0 ? filter.kinds : undefined,
    })
      .then((result) => {
        if (reqId !== reqIdRef.current) return
        setHits(result.hits)
        setEstimatedTotal(result.estimatedTotalHits)
      })
      .catch((err: unknown) => {
        if (reqId !== reqIdRef.current) return
        setError(err instanceof Error ? err.message : 'Błąd wyszukiwania w Auli')
        setHits([])
        setEstimatedTotal(0)
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false)
      })
  }, [query, cohortId, currentUserId, filter.hasAttachments, filter.onlyMe, filterKey, filter.kinds])

  const loadMore = useCallback(async () => {
    if (!cohortId || loadingMore) return
    if (hits.length >= estimatedTotal) return
    setLoadingMore(true)
    try {
      const result = await SearchService.searchAula(query, {
        cohortId,
        limit: PAGE_SIZE,
        offset: hits.length,
        hasAttachments: filter.hasAttachments || undefined,
        authorId: filter.onlyMe && currentUserId ? currentUserId : undefined,
        channelKinds: filter.kinds.length > 0 ? filter.kinds : undefined,
      })
      setHits((previous) => {
        const seen = new Set(previous.map((h) => h.messageId))
        const merged = previous.slice()
        for (const hit of result.hits) {
          if (!seen.has(hit.messageId)) merged.push(hit)
        }
        return merged
      })
      setEstimatedTotal(result.estimatedTotalHits)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania kolejnej strony')
    } finally {
      setLoadingMore(false)
    }
  }, [cohortId, query, hits.length, estimatedTotal, loadingMore, filter, currentUserId])

  const canLoadMore = hits.length < estimatedTotal

  if (!cohortId) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-white/65 px-6 py-8 text-center dark:border-white/15 dark:bg-black/20">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white/70 text-zinc-400 dark:border-white/10 dark:bg-black/30 dark:text-zinc-500">
          <GraduationCap size={22} strokeWidth={1.75} />
        </div>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Brak przypisanego rocznika.
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Uzupełnij studia w ustawieniach, żeby wyszukiwać wiadomości Auli.
        </p>
      </div>
    )
  }

  const toggleKind = useCallback((kind: ChannelKind) => {
    setFilter((previous) => {
      const has = previous.kinds.includes(kind)
      const next = has
        ? previous.kinds.filter((k) => k !== kind)
        : [...previous.kinds, kind].sort()
      return { ...previous, kinds: next }
    })
  }, [])

  const anyFilterActive =
    filter.hasAttachments || filter.onlyMe || filter.kinds.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={filter.hasAttachments}
          onToggle={() =>
            setFilter((previous) => ({ ...previous, hasAttachments: !previous.hasAttachments }))
          }
          icon={<Paperclip size={12} strokeWidth={2.25} />}
          label="Tylko z plikami"
        />
        <FilterChip
          active={filter.onlyMe}
          onToggle={() =>
            setFilter((previous) => ({ ...previous, onlyMe: !previous.onlyMe }))
          }
          icon={<UserRound size={12} strokeWidth={2.25} />}
          label="Tylko ja"
          disabled={!currentUserId}
        />
        <span className="mx-1 hidden h-4 w-px bg-zinc-200 dark:bg-white/10 sm:inline-block" />
        {CHANNEL_KINDS.map((k) => (
          <ChannelKindPill
            key={k}
            kind={k}
            size="md"
            active={filter.kinds.includes(k)}
            onClick={() => toggleKind(k)}
            title={`Filtruj: ${k}`}
          />
        ))}
        {anyFilterActive && (
          <button
            type="button"
            onClick={() => setFilter(INITIAL_FILTER)}
            className="ml-auto text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-[#1e293b] dark:hover:text-brand-gold-bright"
          >
            Wyczyść filtry
          </button>
        )}
      </div>

      {loading && hits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-white/65 px-6 py-6 text-center dark:border-white/15 dark:bg-black/20">
          <p className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <Loader2 size={14} className="animate-spin" /> Szukam w Auli...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-white/65 px-6 py-6 text-center dark:border-white/15 dark:bg-black/20">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </div>
      ) : hits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-white/65 px-6 py-8 text-center dark:border-white/15 dark:bg-black/20">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white/70 text-zinc-400 dark:border-white/10 dark:bg-black/30 dark:text-zinc-500">
            <Search size={22} strokeWidth={1.75} />
          </div>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Brak wyników w Auli dla „{query}”.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {hits.map((hit) => (
            <li key={hit.id}>
              <AulaHitRow hit={hit} onPick={onPickMessage} />
            </li>
          ))}
        </ul>
      )}

      {canLoadMore && hits.length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-4 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-black/35 dark:text-zinc-200 dark:hover:bg-black/55"
          >
            {loadingMore ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Wczytywanie...
              </>
            ) : (
              <>Wczytaj więcej ({estimatedTotal - hits.length})</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onToggle,
  icon,
  label,
  disabled = false,
}: {
  active: boolean
  onToggle: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ' +
        'disabled:cursor-not-allowed disabled:opacity-50 ' +
        (active
          ? 'border-[#1e293b]/45 bg-[#1e293b]/10 text-[#1e293b] dark:border-brand-gold-bright/45 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright'
          : 'border-zinc-200 bg-white/60 text-zinc-600 hover:border-zinc-300 hover:bg-white/80 dark:border-white/10 dark:bg-black/25 dark:text-zinc-400 dark:hover:bg-black/40')
      }
    >
      {icon}
      {label}
    </button>
  )
}

function AulaHitRow({
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
  const fileNamesHtml = hit.fileNamesSnippetHTML
  return (
    <BaseCard
      as="button"
      type="button"
      variant="inner"
      interactive
      onClick={() => onPick(hit.messageId)}
      className="w-full text-left"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white/70 text-[#1e293b] dark:border-white/10 dark:bg-black/30 dark:text-brand-gold-bright">
          <GraduationCap size={16} strokeWidth={2} />
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
          </div>
          {snippetHtml ? (
            <p
              className="mt-1 line-clamp-3 text-sm text-zinc-700 dark:text-zinc-200 [&_mark]:rounded [&_mark]:bg-brand-gold/35 [&_mark]:px-0.5 [&_mark]:text-zinc-900 dark:[&_mark]:bg-brand-gold-bright/30 dark:[&_mark]:text-zinc-50"
              dangerouslySetInnerHTML={{ __html: snippetHtml }}
            />
          ) : null}
          {hit.hasAttachments && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600 dark:border-white/10 dark:bg-black/30 dark:text-zinc-300">
                <Paperclip size={10} strokeWidth={2.25} />
                {hit.fileNames.length} {hit.fileNames.length === 1 ? 'plik' : 'plików'}
              </span>
              {fileNamesHtml ? (
                <span
                  className="truncate text-[11px] text-zinc-500 dark:text-zinc-400 [&_mark]:rounded [&_mark]:bg-brand-gold/35 [&_mark]:px-0.5 [&_mark]:text-zinc-900 dark:[&_mark]:bg-brand-gold-bright/30 dark:[&_mark]:text-zinc-50"
                  dangerouslySetInnerHTML={{ __html: fileNamesHtml }}
                />
              ) : (
                <span className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  {hit.fileNames.join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseCard>
  )
}

function escapeFallback(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
