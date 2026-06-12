/**
 * UJverse — ChannelRail: lewy pasek z listą Sal Auli (rebrand z Discord).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Renderuje:
 *   - Sala główna (virtual, NULL channel_id) na samej górze, z ikoną
 *     GraduationCap (zamiast pilla typu — to "siedziba" rocznika).
 *   - aktywne sale jako `<KindPill> <name>` (sorted by `created_at DESC`
 *     z hooka)
 *   - "Archiwum" accordion (collapsed default)
 *   - "+ Stwórz salę" CTA na samym dole
 *
 * Każdy item jest klikalny → `onSelect(id | null)`. Aktywny ma highlight.
 */
import { useMemo, useState } from 'react'
import { Archive, BellMinus, BellOff, ChevronDown, ChevronRight, GraduationCap, Plus, X } from 'lucide-react'
import type { ChannelKind, ChannelMuteMode, CohortChannel } from '../../types/database'
import type { ActiveChannelId } from '../../hooks/useCohortChannels'
import ChannelKindPill, { CHANNEL_KINDS } from './ChannelKindPill'

type Props = {
  channels: CohortChannel[]
  archived: CohortChannel[]
  activeChannelId: ActiveChannelId
  onSelect: (id: ActiveChannelId) => void
  onCreate: () => void
  /** Optional className — pozwala parent ustawić width/height. */
  className?: string
  /**
   * Sale z nowymi wiadomościami od ostatniego zobaczenia. `null` = Sala
   * główna. Pochodzi z `useChannelUnread`; pusty Set = wszystko przeczytane.
   */
  unreadChannels?: ReadonlySet<number | null>
  /**
   * Filter po typach zajęć (multi-select OR). Pusty Set = bez filtru.
   * Source of truth = `useCohortChannels.kindFilter`.
   */
  kindFilter?: ReadonlySet<ChannelKind>
  /**
   * Set typów obecnie używanych w cohorcie (aktywne sale). Pigułki
   * wyświetlamy tylko gdy `size >= 2` (chronimy przed bezsensownym UI).
   */
  availableKinds?: ReadonlySet<ChannelKind>
  /** Toggle pojedynczej pigułki. */
  onToggleKind?: (kind: ChannelKind) => void
  /** Czyści cały filter (button "X" obok pigułek). */
  onClearKindFilter?: () => void
  /**
   * Mute mode per kanał (z `useCohortChannelMutes.getMuteMode`). `null` =
   * Sala główna. Brak callbacka = pomijamy renderowanie ikon (legacy mode).
   */
  getMuteMode?: (channelId: number | null) => ChannelMuteMode
}

export default function ChannelRail({
  channels,
  archived,
  activeChannelId,
  onSelect,
  onCreate,
  className,
  unreadChannels,
  kindFilter,
  availableKinds,
  onToggleKind,
  onClearKindFilter,
  getMuteMode,
}: Props) {
  const [archivedOpen, setArchivedOpen] = useState(false)

  const isUnread = (id: number | null): boolean =>
    unreadChannels ? unreadChannels.has(id) : false

  const muteModeFor = (id: number | null): ChannelMuteMode =>
    getMuteMode ? getMuteMode(id) : 'all'

  const filterActive = (kindFilter?.size ?? 0) > 0
  const showKindFilterRow =
    !!onToggleKind && !!availableKinds && availableKinds.size >= 2

  // Lokalny filter — `useCohortChannels.channels` pozostaje pełną listą,
  // żeby mention autocomplete / search / deep linking miały komplet.
  const filteredChannels = useMemo(() => {
    if (!filterActive || !kindFilter) return channels
    return channels.filter((c) => kindFilter.has(c.kind))
  }, [channels, kindFilter, filterActive])

  const filteredArchived = useMemo(() => {
    if (!filterActive || !kindFilter) return archived
    return archived.filter((c) => kindFilter.has(c.kind))
  }, [archived, kindFilter, filterActive])

  // Empty state — pokazujemy gdy filter aktywny ale 0 aktywnych sal pasuje
  // (zarchiwizowane też nie liczą się tu — accordion otwiera user osobno).
  const showFilterEmptyState =
    filterActive && filteredChannels.length === 0

  return (
    <div
      className={[
        'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-bg-card/70',
        className ?? '',
      ].join(' ')}
    >
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-2 text-[#1e293b] dark:text-brand-gold-bright">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em]">Sale</span>
          <button
            type="button"
            onClick={onCreate}
            aria-label="Stwórz salę"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#1e293b]/70 hover:bg-black/[0.06] hover:text-[#1e293b] dark:text-brand-gold-bright/70 dark:hover:bg-white/[0.06] dark:hover:text-brand-gold-bright"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {showKindFilterRow && (
        <div className="border-b border-zinc-200/60 px-3 py-2 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-1">
            {CHANNEL_KINDS.filter((k) => availableKinds!.has(k)).map((k) => (
              <ChannelKindPill
                key={k}
                kind={k}
                size="sm"
                active={kindFilter?.has(k) ?? false}
                onClick={() => onToggleKind?.(k)}
                title={`Filtruj: ${k}`}
              />
            ))}
            {filterActive && onClearKindFilter && (
              <button
                type="button"
                onClick={onClearKindFilter}
                aria-label="Wyczyść filter typów"
                title="Wyczyść filter"
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-500 hover:bg-black/[0.06] hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <GeneralRoomItem
          active={activeChannelId === null}
          unread={isUnread(null)}
          muteMode={muteModeFor(null)}
          onClick={() => onSelect(null)}
        />
        {filteredChannels.map((c) => (
          <ChannelItem
            key={c.id}
            channel={c}
            active={activeChannelId === c.id}
            unread={isUnread(c.id)}
            muteMode={muteModeFor(c.id)}
            onClick={() => onSelect(c.id)}
          />
        ))}

        {showFilterEmptyState && (
          <div className="mx-1 mt-2 rounded-md border border-dashed border-zinc-300 px-3 py-3 text-center text-[11px] text-zinc-500 dark:border-white/15 dark:text-zinc-400">
            <p>Brak sal pasujących do filtra.</p>
            {onClearKindFilter && (
              <button
                type="button"
                onClick={onClearKindFilter}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e293b] underline-offset-2 hover:underline dark:text-brand-gold-bright"
              >
                <X size={10} />
                Wyczyść filter
              </button>
            )}
          </div>
        )}

        {filteredArchived.length > 0 && (
          <div className="mt-3 border-t border-zinc-200/60 pt-2 dark:border-white/10">
            <button
              type="button"
              onClick={() => setArchivedOpen((v) => !v)}
              aria-expanded={archivedOpen}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.05]"
            >
              {archivedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Archive size={11} />
              Archiwum ({filteredArchived.length})
            </button>
            {archivedOpen && (
              <div className="mt-1 space-y-0.5">
                {filteredArchived.map((c) => (
                  <ChannelItem
                    key={c.id}
                    channel={c}
                    active={activeChannelId === c.id}
                    unread={isUnread(c.id)}
                    muteMode={muteModeFor(c.id)}
                    archived
                    onClick={() => onSelect(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="m-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-black/[0.04] dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
      >
        <Plus size={13} />
        Stwórz salę
      </button>
    </div>
  )
}

function GeneralRoomItem({
  active,
  unread,
  muteMode = 'all',
  onClick,
}: {
  active: boolean
  unread?: boolean
  muteMode?: ChannelMuteMode
  onClick: () => void
}) {
  const showUnread = unread && !active
  const isMuted = muteMode !== 'all'
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        isMuted
          ? muteMode === 'none'
            ? 'Sala główna — wyciszona'
            : 'Sala główna — tylko wzmianki'
          : 'Sala główna — domyślny kanał rocznika'
      }
      className={[
        'group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active
          ? 'bg-[#1e293b]/[0.08] font-semibold text-[#1e293b] dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright'
          : showUnread
            ? 'font-semibold text-fg-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
            : 'text-fg-secondary hover:bg-black/[0.04] hover:text-fg-primary dark:hover:bg-white/[0.05]',
        isMuted && !active ? 'opacity-70' : '',
      ].join(' ')}
    >
      <GraduationCap
        size={14}
        className="shrink-0 text-[#1e293b]/70 dark:text-brand-gold-bright/80"
      />
      <span className="min-w-0 flex-1 truncate">Sala główna</span>
      <MuteIcon mode={muteMode} />
      {showUnread && (
        <span
          aria-label="Nowe wiadomości"
          className="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 dark:bg-brand-gold-bright"
        />
      )}
    </button>
  )
}

function ChannelItem({
  channel,
  active,
  archived,
  unread,
  muteMode = 'all',
  onClick,
}: {
  channel: CohortChannel
  active: boolean
  archived?: boolean
  unread?: boolean
  muteMode?: ChannelMuteMode
  onClick: () => void
}) {
  // Unread NIE bumpuje wagi gdy sala jest aktywna — auto-mark useEffect i
  // tak zaraz wyczyści state, ale chronimy przed jednoramkowym mignięciem.
  const showUnread = unread && !active
  const isMuted = muteMode !== 'all'
  return (
    <button
      type="button"
      onClick={onClick}
      title={channel.description ?? undefined}
      className={[
        'group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active
          ? 'bg-[#1e293b]/[0.08] font-semibold text-[#1e293b] dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright'
          : showUnread
            ? 'font-semibold text-fg-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
            : 'text-fg-secondary hover:bg-black/[0.04] hover:text-fg-primary dark:hover:bg-white/[0.05]',
        archived ? 'opacity-60' : '',
        isMuted && !archived && !active ? 'opacity-70' : '',
      ].join(' ')}
    >
      <ChannelKindPill kind={channel.kind} size="sm" />
      <span className="min-w-0 flex-1 truncate">{channel.name}</span>
      <MuteIcon mode={muteMode} />
      {showUnread && (
        <span
          aria-label="Nowe wiadomości"
          className="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 dark:bg-brand-gold-bright"
        />
      )}
      {archived && (
        <Archive
          size={10}
          className="shrink-0 text-zinc-400 dark:text-zinc-500"
          aria-label="Zarchiwizowana"
        />
      )}
    </button>
  )
}

/** Subtelna ikonka wyciszenia (BellOff / BellMinus) — pomija się dla 'all'. */
function MuteIcon({ mode }: { mode: ChannelMuteMode }) {
  if (mode === 'all') return null
  if (mode === 'mentions_only') {
    return (
      <BellMinus
        size={10}
        aria-label="Tylko wzmianki"
        className="shrink-0 text-amber-500 dark:text-amber-300"
      />
    )
  }
  return (
    <BellOff
      size={10}
      aria-label="Wyciszone"
      className="shrink-0 text-zinc-400 dark:text-zinc-500"
    />
  )
}
