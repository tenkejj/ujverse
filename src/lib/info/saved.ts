/**
 * „Zapisz na później" — lista przechowywana wyłącznie na urządzeniu.
 *
 * Zapisujemy migawkę (tytuł, link, kontekst, termin), żeby element dało się
 * pokazać nawet wtedy, gdy wypadnie z bieżącego okna danych.
 */
import { safeExternalUrl } from './links'
import type { InfoItem, InfoKind } from './types'

export const SAVED_STORAGE_KEY = 'ujverse.saved.v1'
export const SAVED_LIMIT = 50

export type SavedItem = {
  kind: InfoKind
  id: string
  title: string
  url: string | null
  context: string | null
  /** ISO terminu (rejestracja) albo klucz dnia `YYYY-MM-DD` (wydarzenie). */
  dueAt: string | null
  savedAt: string
}

const KINDS = new Set<string>(['announcement', 'registration', 'event'])

function parseOne(raw: unknown): SavedItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.kind !== 'string' || !KINDS.has(o.kind)) return null
  if (typeof o.id !== 'string' || o.id.length === 0) return null
  if (typeof o.title !== 'string' || o.title.trim().length === 0) return null
  const savedAt = typeof o.savedAt === 'string' && !Number.isNaN(Date.parse(o.savedAt)) ? o.savedAt : null
  if (!savedAt) return null
  return {
    kind: o.kind as InfoKind,
    id: o.id,
    title: o.title.slice(0, 300),
    url: safeExternalUrl(typeof o.url === 'string' ? o.url : null),
    context: typeof o.context === 'string' ? o.context.slice(0, 200) : null,
    dueAt: typeof o.dueAt === 'string' ? o.dueAt : null,
    savedAt,
  }
}

export function parseSaved(raw: string | null | undefined): SavedItem[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []
  const o = parsed as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.items)) return []
  const seen = new Set<string>()
  const out: SavedItem[] = []
  for (const entry of o.items) {
    const item = parseOne(entry)
    if (!item) continue
    const key = savedKey(item.kind, item.id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= SAVED_LIMIT) break
  }
  return out
}

export function serializeSaved(items: readonly SavedItem[]): string {
  return JSON.stringify({ version: 1, items })
}

export function savedKey(kind: InfoKind, id: string): string {
  return `${kind}:${id}`
}

export function isSaved(items: readonly SavedItem[], kind: InfoKind, id: string): boolean {
  return items.some((item) => item.kind === kind && item.id === id)
}

export function toSavedItem(info: InfoItem, now: Date = new Date()): SavedItem {
  const savedAt = now.toISOString()
  switch (info.kind) {
    case 'announcement':
      return {
        kind: 'announcement',
        id: info.id,
        title: info.title,
        url: info.sourceUrl,
        context: [info.facultyShort ?? info.faculty, info.sourceLabel].filter(Boolean).join(' · ') || null,
        dueAt: null,
        savedAt,
      }
    case 'registration':
      return {
        kind: 'registration',
        id: info.id,
        title: info.title,
        url: info.url,
        context: info.unitName,
        dueAt: info.closesAt ?? info.opensAt,
        savedAt,
      }
    case 'event':
      return {
        kind: 'event',
        id: info.id,
        title: info.title,
        url: info.url,
        context: info.sourceName,
        dueAt: info.dayKey,
        savedAt,
      }
  }
}

/** Dodaje (na początek) albo usuwa element; limit `SAVED_LIMIT`. */
export function toggleSavedItem(items: readonly SavedItem[], item: SavedItem): SavedItem[] {
  if (isSaved(items, item.kind, item.id)) {
    return items.filter((entry) => !(entry.kind === item.kind && entry.id === item.id))
  }
  return [item, ...items].slice(0, SAVED_LIMIT)
}
