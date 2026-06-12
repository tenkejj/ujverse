/**
 * UJverse — SlashCommandMenu: popup nad composerem asystenta AI z listą
 * preset queries (Discord/Linear/ChatGPT-plugins pattern).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Kontrakt:
 *   - `commands` — przefiltrowana lista (parent zarządza filtracją)
 *   - `activeIndex` / `onActiveIndexChange` — selected item (parent przyjmuje
 *     ArrowUp/Down żeby klawiatura była dzielona z textarea Enter handler).
 *     `onSelect` — klik na pozycji lub Enter z aktywną pozycją
 *   - `onClose` — Escape / klik poza menu / spacja w drafcie (parent decyduje)
 *
 * UX:
 *   - Anchorowane nad input dock (parent rendering: `position: absolute`)
 *   - Skok do top przy zmianie listy (np. po doprecyzowaniu filtra)
 *   - Hover ustawia activeIndex (mouse-driven UX dla desktopa)
 *   - Icons w kolorowych pillach (visual hierarchy)
 *   - Pusty stan: krótka informacja "Brak komendy z tym prefiksem"
 */
import { useEffect, useRef } from 'react'
import type { SlashCommand } from '../../lib/chatSlashCommands'

type Props = {
  commands: SlashCommand[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (command: SlashCommand) => void
  onClose: () => void
}

export default function SlashCommandMenu({
  commands,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onClose,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // Scroll-into-view dla aktywnej pozycji (klawiatura).
  useEffect(() => {
    const el = itemRefs.current.get(activeIndex)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Klik poza menu = zamknij. Listener mountuje się raz; `onClose` musi być
  // stabilną referencją po stronie callera (useCallback).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (commands.length === 0) {
    return (
      <div
        ref={listRef}
        role="listbox"
        className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 text-center text-xs text-zinc-500 shadow-2xl dark:border-white/10 dark:bg-bg-card dark:text-zinc-400"
      >
        Brak komendy z tym prefiksem.
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Komendy asystenta"
      className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-bg-card"
    >
      <div className="border-b border-zinc-200/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-white/10 dark:text-zinc-500">
        Komendy
      </div>
      <div className="custom-scrollbar max-h-72 overflow-y-auto">
        {commands.map((cmd, index) => {
          const Icon = cmd.icon
          const isActive = index === activeIndex
          return (
            <button
              key={cmd.slug}
              type="button"
              role="option"
              aria-selected={isActive}
              ref={(el) => {
                if (el) itemRefs.current.set(index, el)
                else itemRefs.current.delete(index)
              }}
              onMouseEnter={() => onActiveIndexChange(index)}
              onClick={() => onSelect(cmd)}
              className={[
                'flex w-full items-start gap-3 px-3 py-2 text-left transition-colors',
                isActive
                  ? 'bg-logo-navy/5 dark:bg-brand-gold-bright/10'
                  : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]',
              ].join(' ')}
            >
              <span
                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cmd.iconBg}`}
              >
                <Icon size={14} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-fg-primary">
                    {cmd.label}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                    /{cmd.slug}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {cmd.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
      <div className="border-t border-zinc-200/70 px-3 py-1.5 text-[10px] text-zinc-400 dark:border-white/10 dark:text-zinc-500">
        ↑ ↓ aby wybrać · ⏎ aby uruchomić · Esc aby zamknąć
      </div>
    </div>
  )
}
