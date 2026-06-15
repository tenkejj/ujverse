/**
 * Helpery do wyciągania pól z surowych wyników toolów + drobne utility do
 * formatowania dat. Wydzielone z `api/chat.ts` żeby `synthesizer.ts` mógł
 * z nich korzystać przy budowaniu faktów dla LLM (zob. `buildToolFacts`).
 *
 * Wszystkie funkcje są CZYSTE (nie czytają env, nie sieją w globalu) i
 * deterministyczne — bezpieczne do snapshot-testów.
 */

/** Bezpieczne obcinanie do `max` znaków + ellipsis. */
export function clip(text: string, max: number): string {
  const t = (text ?? '').toString()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

/**
 * Formatuje wartość ISO daty na krótki, czytelny format `YYYY-MM-DD HH:mm`
 * (lub samo `YYYY-MM-DD` gdy czas to 00:00). Świadomie BEZ
 * `Intl.DateTimeFormat('pl-PL', …)` — Vercel Edge bywa zbudowany bez pełnego
 * ICU i wtedy zwraca en-US zamiast polskich nazw miesięcy.
 */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return 'brak daty'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'brak daty'
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const HH = String(d.getUTCHours()).padStart(2, '0')
  const MM = String(d.getUTCMinutes()).padStart(2, '0')
  if (HH === '00' && MM === '00') return `${yyyy}-${mm}-${dd}`
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}`
}

/**
 * Formatuje datę jako tekst RELATYWNY do "teraz" — w stylu chatu /
 * mediów społecznościowych ("3 godz. temu", "wczoraj", "2 dni temu").
 */
export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return 'brak daty'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'brak daty'
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return formatDateShort(iso)
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'przed chwilą'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min temu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} godz. temu`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'wczoraj'
  if (day < 7) return `${day} dni temu`
  return formatDateShort(iso)
}

/**
 * Heurystyka „post jest spamem / pusty" — używana w `buildPostsFacts` żeby
 * nie zaśmiecać odpowiedzi asystenta postami testowymi typu `#pomoc`,
 * `#ankiet`, pojedynczymi linkami bez kontekstu albo postami <20 znaków.
 */
export function isSpamPost(body: string, tags: string[]): boolean {
  const trimmed = (body ?? '').trim()
  if (trimmed.length === 0) return true
  const withoutTags = trimmed.replace(/#[\p{L}\p{N}_-]+/gu, '').trim()
  if (withoutTags.length < 20) {
    if (tags.length > 0 && withoutTags.length === 0) return true
    if (withoutTags.length === 0) return true
    if (withoutTags.length < 10) return true
  }
  const urlOnly = /^https?:\/\/\S+$/i.test(withoutTags)
  if (urlOnly) return true
  return false
}

/**
 * Type guard'y dla wyników tools. Świadomie luźne (`any`-by-shape), bo wynik
 * narzędzia w runtime przychodzi jako `unknown` z `runToolCall` — TS nie wie
 * który tool to wywołał, tylko że to coś co `JSON.stringify`-uje się.
 */
export function isToolErrorObject(
  value: unknown,
): value is { ok: false; error?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in (value as Record<string, unknown>) &&
    (value as { ok?: unknown }).ok === false
  )
}

export function getItemsArray(value: unknown): unknown[] | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'items' in (value as Record<string, unknown>)
  ) {
    const items = (value as { items?: unknown }).items
    if (Array.isArray(items)) return items
  }
  return null
}

export function pickString(obj: unknown, key: string): string {
  if (typeof obj !== 'object' || obj === null) return ''
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : ''
}

export function pickStringOrNull(obj: unknown, key: string): string | null {
  if (typeof obj !== 'object' || obj === null) return null
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function pickBool(obj: unknown, key: string): boolean {
  if (typeof obj !== 'object' || obj === null) return false
  return Boolean((obj as Record<string, unknown>)[key])
}

export function pickStringArray(obj: unknown, key: string): string[] {
  if (typeof obj !== 'object' || obj === null) return []
  const v = (obj as Record<string, unknown>)[key]
  if (!Array.isArray(v)) return []
  return v.filter((s): s is string => typeof s === 'string' && s.length > 0)
}

export function pickNumber(obj: unknown, key: string): number | null {
  if (typeof obj !== 'object' || obj === null) return null
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Sufiks kontekstowy dla daty wydarzenia. W przeciwieństwie do
 * `formatRelativeDate` (które patrzy WSTECZ — „2 godz. temu"), tu
 * patrzymy W PRZÓD: „za 3 dni", „jutro", „dziś", „już minęło".
 *
 * Wynik to fragment do doklejenia w nawiasie obok absolutnej daty, np.:
 *   `2026-06-12 18:00 (jutro)`
 *   `2026-06-15 (za 7 dni)`
 *   `2025-12-04 (już minęło)`
 *
 * Bez sufiksu (pusty string) gdy data jest > 30 dni do przodu.
 */
export function eventDateContext(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = d.getTime() - Date.now()
  if (diffMs < -24 * 3600_000) return 'już minęło'
  if (diffMs < 0) return 'było dziś'
  const hr = Math.floor(diffMs / 3600_000)
  if (hr < 12) return 'dziś'
  const day = Math.floor(diffMs / (24 * 3600_000))
  if (day === 0) return 'dziś'
  if (day === 1) return 'jutro'
  if (day < 7) return `za ${day} dni`
  if (day < 14) return 'za tydzień'
  if (day < 30) return `za ${day} dni`
  return ''
}
