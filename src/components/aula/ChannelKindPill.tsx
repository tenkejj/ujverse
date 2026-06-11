/**
 * UJverse — ChannelKindPill: kolorowy badge typu sali (wyk/ćw/lab/sem/...).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Single source of truth dla wyglądu pilla typu zajęć — reużywany w
 * `ChannelRail` / `ChannelHeader` / `CreateChannelModal` / search hits.
 *
 * Krytyczne: DB trzyma `cw` (ASCII), display tu mapuje na `ćw`. Zmiana
 * listy `CHANNEL_KINDS` = update CHECK constraint w
 * [supabase/migrations/20260613110000_aula_channels_kind.sql](supabase/migrations/20260613110000_aula_channels_kind.sql)
 * w lockstep.
 */
import type { ChannelKind } from '../../types/database'

export const CHANNEL_KINDS = ['wyk', 'cw', 'lab', 'sem', 'proj', 'inne'] as const

type Meta = {
  /** Krótki label do pilla (czystego skrótu) — `cw` → `ćw`, reszta pass-through. */
  label: string
  /** Pełna nazwa do tooltipów / selectora w modal. */
  long: string
  /** Background tint (Tailwind). */
  tint: string
  /** Text color (Tailwind). */
  text: string
}

export const CHANNEL_KIND_META: Record<ChannelKind, Meta> = {
  wyk: {
    label: 'wyk',
    long: 'Wykład',
    tint: 'bg-sky-500/15 dark:bg-sky-400/15',
    text: 'text-sky-700 dark:text-sky-300',
  },
  cw: {
    label: 'ćw',
    long: 'Ćwiczenia',
    tint: 'bg-emerald-500/15 dark:bg-emerald-400/15',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  lab: {
    label: 'lab',
    long: 'Laboratorium',
    tint: 'bg-violet-500/15 dark:bg-violet-400/15',
    text: 'text-violet-700 dark:text-violet-300',
  },
  sem: {
    label: 'sem',
    long: 'Seminarium',
    tint: 'bg-amber-500/15 dark:bg-amber-400/15',
    text: 'text-amber-700 dark:text-amber-300',
  },
  proj: {
    label: 'proj',
    long: 'Projekt',
    tint: 'bg-pink-500/15 dark:bg-pink-400/15',
    text: 'text-pink-700 dark:text-pink-300',
  },
  inne: {
    label: 'inne',
    long: 'Inne',
    tint: 'bg-zinc-500/15 dark:bg-zinc-400/15',
    text: 'text-zinc-700 dark:text-zinc-300',
  },
}

type Size = 'sm' | 'md'

type Props = {
  kind: ChannelKind
  size?: Size
  /**
   * Override sufiks `title` (tooltip). Domyślnie używa `CHANNEL_KIND_META.long`.
   * Przekaż `null` żeby wyłączyć tooltip.
   */
  title?: string | null
  className?: string
  /**
   * Interactive mode. Gdy `onClick` jest set, pigułka staje się przyciskiem
   * (filter toggle pattern). `active` rysuje pełny tint, `active === false`
   * przyciemnia (outline-only). `active === undefined` = static display.
   */
  onClick?: () => void
  active?: boolean
  /** Forwards `aria-pressed` semantykę (toggle button). */
  ariaPressed?: boolean
}

/**
 * Mapowanie skrótu na pełną nazwę typu zajęć — wykorzystywane też w copy
 * empty states / archived notices ("Pusta sala: Wykład X").
 */
export function kindLongName(kind: ChannelKind): string {
  return CHANNEL_KIND_META[kind].long
}

export function kindLabel(kind: ChannelKind): string {
  return CHANNEL_KIND_META[kind].label
}

export default function ChannelKindPill({
  kind,
  size = 'sm',
  title,
  className,
  onClick,
  active,
  ariaPressed,
}: Props) {
  const meta = CHANNEL_KIND_META[kind]
  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-0.5 text-xs'
  const resolvedTitle =
    title === null ? undefined : title ?? meta.long

  const baseClasses =
    'inline-flex shrink-0 items-center rounded-full font-semibold uppercase tracking-wide'

  // Static (legacy) mode — gdy nie ma onClick.
  if (!onClick) {
    return (
      <span
        title={resolvedTitle}
        className={[baseClasses, meta.tint, meta.text, sizeClasses, className ?? ''].join(' ')}
      >
        {meta.label}
      </span>
    )
  }

  // Interactive mode — toggle button. Active = pełny tint, inactive = outline.
  // (Nie używamy dynamicznego `hover:${meta.tint}` bo Tailwind v4 nie wykryje
  // klas z interpolacji.)
  const isActive = active !== false
  const visualClasses = isActive
    ? `${meta.tint} ${meta.text} hover:opacity-80`
    : `bg-transparent ${meta.text} opacity-60 ring-1 ring-inset ring-current/30 hover:opacity-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]`
  return (
    <button
      type="button"
      title={resolvedTitle}
      onClick={onClick}
      aria-pressed={ariaPressed ?? isActive}
      className={[
        baseClasses,
        sizeClasses,
        visualClasses,
        'cursor-pointer transition-colors',
        className ?? '',
      ].join(' ')}
    >
      {meta.label}
    </button>
  )
}
