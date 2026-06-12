/**
 * UJverse — ChannelHeader: pasek nad chatem z pillem typu, name, description
 * i gear menu.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Sala główna (virtual, `channel == null`) → static label + description +
 * ikona GraduationCap zamiast pilla, brak gear menu (nikt nie jest creatorem).
 *
 * Gear dropdown widoczny tylko gdy `canManage` (caller decyduje na podstawie
 * `channel.created_by === currentUserId`). Akcje: Edytuj name/opis/typ,
 * Archiwizuj / Przywróć. Hard-delete NIE jest dostępny (RLS deny).
 */
import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellMinus,
  BellOff,
  ChevronDown,
  GraduationCap,
  Pencil,
  Settings,
  StickyNote,
} from 'lucide-react'
import type { ChannelMuteMode, CohortChannel } from '../../types/database'
import type { TypingUser } from '../../hooks/useChannelTyping'
import ChannelKindPill from './ChannelKindPill'
import ChannelMuteMenu, { describeMute } from './ChannelMuteMenu'

type Props = {
  channel: CohortChannel | null
  canManage: boolean
  onEdit: () => void
  onArchive: () => void
  onUnarchive: () => void
  /**
   * Mute prefs dla AKTYWNEGO kanału (= ten widoczny w headerze). `null`
   * channel = Sala główna, mute dotyczy `channel_id IS NULL`.
   */
  muteMode?: ChannelMuteMode
  mutedUntil?: Date | null
  onChangeMute?: (mode: ChannelMuteMode, snoozeHours: number | null) => void
  /**
   * Aktywni typers (już bez `currentUserId` — hook filtruje). Gdy lista
   * niepusta zamiast description renderujemy "X pisze..." (Discord/Slack
   * pattern; po wygaśnięciu wraca description bez skoku layoutu, bo
   * obie wersje to 1 linia).
   */
  typingUsers?: TypingUser[]
  /** Toggle prawego panelu notatek (desktop) / mobile sheet. */
  notesOpen?: boolean
  onToggleNotes?: () => void
}

function formatTypingLabel(users: TypingUser[]): string {
  if (users.length === 0) return ''
  if (users.length === 1) return `${users[0].name} pisze`
  if (users.length === 2) return `${users[0].name} i ${users[1].name} piszą`
  return `${users[0].name} i ${users.length - 1} innych pisze`
}

const GENERAL_DESCRIPTION = 'Domyślna sala Twojego rocznika. Wszyscy tu są.'

export default function ChannelHeader({
  channel,
  canManage,
  onEdit,
  onArchive,
  onUnarchive,
  muteMode = 'all',
  mutedUntil = null,
  onChangeMute,
  typingUsers,
  notesOpen = false,
  onToggleNotes,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [muteMenuOpen, setMuteMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const muteWrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const name = channel?.name ?? 'Sala główna'
  const description = channel?.description ?? (channel ? null : GENERAL_DESCRIPTION)
  const archived = channel?.archived_at != null

  const muteIcon =
    muteMode === 'none' ? (
      <BellOff size={14} />
    ) : muteMode === 'mentions_only' ? (
      <BellMinus size={14} />
    ) : (
      <Bell size={14} />
    )
  const muteIsActive = muteMode !== 'all'

  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2.5 dark:border-white/10">
      {channel ? (
        <ChannelKindPill kind={channel.kind} size="md" />
      ) : (
        <GraduationCap
          size={16}
          className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h2 className="truncate text-sm font-bold text-fg-primary">{name}</h2>
          {archived && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              <Archive size={10} />
              Archiwum
            </span>
          )}
        </div>
        {typingUsers && typingUsers.length > 0 ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs italic text-zinc-500 dark:text-zinc-400">
            <span className="truncate">{formatTypingLabel(typingUsers)}</span>
            <span aria-hidden className="inline-flex shrink-0 items-end gap-[2px] pl-0.5">
              <span className="inline-block h-1 w-1 animate-typing-dot rounded-full bg-current [animation-delay:0ms]" />
              <span className="inline-block h-1 w-1 animate-typing-dot rounded-full bg-current [animation-delay:150ms]" />
              <span className="inline-block h-1 w-1 animate-typing-dot rounded-full bg-current [animation-delay:300ms]" />
            </span>
          </p>
        ) : description ? (
          <p className="mt-0.5 truncate text-xs text-fg-secondary">{description}</p>
        ) : null}
      </div>

      {onToggleNotes && (
        <button
          type="button"
          onClick={onToggleNotes}
          aria-pressed={notesOpen}
          aria-label={notesOpen ? 'Zamknij notatki' : 'Otwórz wspólne notatki sali'}
          title={notesOpen ? 'Zamknij notatki' : 'Wspólne notatki sali'}
          className={[
            'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 transition-colors',
            notesOpen
              ? 'bg-[#1e293b]/10 text-[#1e293b] dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright'
              : 'text-zinc-500 hover:bg-black/[0.05] hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200',
          ].join(' ')}
        >
          <StickyNote size={14} />
        </button>
      )}

      {onChangeMute && (
        <div ref={muteWrapRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMuteMenuOpen((v) => !v)}
            aria-label={
              muteIsActive ? 'Zmień wyciszenie powiadomień' : 'Wycisz powiadomienia'
            }
            aria-expanded={muteMenuOpen}
            title={describeMute(muteMode, mutedUntil)}
            className={[
              'inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors',
              muteIsActive
                ? 'text-amber-600 hover:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-300/10'
                : 'text-zinc-500 hover:bg-black/[0.05] hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200',
            ].join(' ')}
          >
            {muteIcon}
          </button>
          {muteMenuOpen && (
            <ChannelMuteMenu
              currentMode={muteMode}
              mutedUntil={mutedUntil}
              channelLabel={name}
              onChange={(mode, snoozeHours) => onChangeMute(mode, snoozeHours)}
              onClose={() => setMuteMenuOpen(false)}
            />
          )}
        </div>
      )}

      {channel && canManage && (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Ustawienia sali"
            aria-expanded={menuOpen}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-zinc-500 hover:bg-black/[0.05] hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
          >
            <Settings size={14} />
            <ChevronDown size={11} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-bg-card">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onEdit()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
              >
                <Pencil size={13} />
                Edytuj nazwę / typ / opis
              </button>
              {archived ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onUnarchive()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                >
                  <ArchiveRestore size={13} />
                  Przywróć salę
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onArchive()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-300/10"
                >
                  <Archive size={13} />
                  Archiwizuj salę
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
