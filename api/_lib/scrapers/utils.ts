/**
 * UJverse — wspólne pomocnicze funkcje dla scraperów komunikatów.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wyciągnięte z `api/scrape-wziks.ts` (refactor 2026-07-15 na 16-source
 * scraper). Funkcje są bezstanowe — żeby każdy parser mógł je współdzielić
 * bez ryzyka cross-contamination.
 */
import crypto from 'node:crypto'
import type { AnnouncementStatus } from './types.js'

/** Chrome na macOS — wygląda jak zwykła przeglądarka (mniej „bot" w logach WAF). */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Tekst zastępczy gdy nie uda się wyciągnąć nazwiska wykładowcy. */
export const FALLBACK_LECTURER_NAME = 'Komunikat wydziałowy'

/** Zgodne z triggerem DB `md5(body)` — jawny klucz dla `upsert(..., onConflict: 'body_fingerprint')`. */
export function bodyFingerprintHex(body: string): string {
  return crypto.createHash('md5').update(body, 'utf8').digest('hex')
}

/** Normalizacja białych znaków — NBSP → spacja, CRLF → LF, trim końcówek linii. */
export function cleanWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Usuwa szum UI UJ (nagłówki widoku, okruszki), tabulatory i puste linie na początku. */
export function cleanupAnnouncementText(text: string): string {
  let t = text.replace(/\u00a0/g, ' ')
  const noise = [
    'Widok zawartości stron',
    'Nawigacja okruszkowa',
    'Pomiń baner',
    'Przejdź do głównej treści',
    'Web Accessibility plugin by DJ-Extensions.com',
    '\t\t\t\t            Komunikaty',
    '\t\t\tNawigacja okruszkowa',
  ]
  for (const phrase of noise) {
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(esc, 'gi'), '\n')
  }
  t = t.replace(/\t+/g, ' ')
  t = t.replace(/[ \t]+$/gm, '')
  t = t.replace(/^\s*\n+/, '')
  t = t.replace(/\n{3,}/g, '\n\n')
  return cleanWhitespace(t)
}

/** Wzorce typowych fraz przed nazwiskiem w tekście komunikatu (usuwanie szumu). */
const LECTURER_INTRO_PHRASES: RegExp[] = [
  /\bzajęcia\s+prowadzone\s+przez\s*:?\s*/gi,
  /\bzajecia\s+prowadzone\s+przez\s*:?\s*/gi,
  /\bzajęcia\s+poprowadzi\s*:?\s*/gi,
  /\bwykład\s+prowadzony\s+przez\s*:?\s*/gi,
  /\bwyklad\s+prowadzony\s+przez\s*:?\s*/gi,
]

export function stripLecturerIntroPhrases(text: string): string {
  let t = text
  for (const re of LECTURER_INTRO_PHRASES) t = t.replace(re, '')
  return cleanWhitespace(t)
}

/**
 * Po wyciągnięciu godności + nazwiska: obetnij przed „oraz", przecinkiem
 * przed prof. UJ, max ~4 słowa po tytule. Reuse z ISI parsera — działa
 * też dla Liferay/WP gdy treść wspomina osobę prowadzącą.
 */
export function clipLecturerPhrase(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim()
  s = s.split(/\s+oraz\b/i)[0]?.trim() ?? s
  s = s.split(/\s*,\s*prof\.\s*uj\b/i)[0]?.trim() ?? s
  s = s.replace(/,\s*$/, '').trim()

  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length <= 6) return s

  const titleLower = new Set([
    'dr',
    'dr.',
    'hab.',
    'prof.',
    'mgr',
    'mgr.',
    'inż.',
    'inz.',
    'inż',
    'inz',
    'uj',
  ])
  const out: string[] = []
  let i = 0
  while (i < parts.length) {
    const p = parts[i]
    const pl = p.toLowerCase()
    if (titleLower.has(pl) || /^[a-ząćęłńóśźż]{1,4}\.$/i.test(p)) {
      out.push(p)
      i++
      continue
    }
    break
  }
  let nameWords = 0
  const maxName = 3
  while (i < parts.length && nameWords < maxName) {
    out.push(parts[i])
    i++
    nameWords++
  }
  return out.join(' ') || s.slice(0, 120)
}

/**
 * Detekcja statusu komunikatu — używana tylko przez ISI parser (lecturer-
 * level absences), Liferay/WP zazwyczaj ustawiają 'info'.
 */
export function detectIsiStatus(block: string): 'cancelled' | 'remote' | 'duty' {
  const t = block.toLowerCase()
  if (/odwołan|odwolany|odwołane|zostają odwołane|zostaja odwolane|anulowan/.test(t)) return 'cancelled'
  if (/zdaln|zdalnie|tryb zdalny|ms teams|platformie pegaz|asynchroniczn/.test(t)) return 'remote'
  if (/dyżur|dyzur/.test(t)) return 'duty'
  return 'duty'
}

/**
 * Heurystyczna detekcja statusu dla komunikatów wydziałowych (Liferay/WP):
 *   - 'event' gdy tytuł/body wspomina konkretne wydarzenie/zaproszenie
 *     (konferencja, seminarium, spotkanie, warsztaty)
 *   - 'info' jako fallback (najczęstszy case na portalach wydziałowych)
 *
 * Tu NIE robimy detekcji cancelled/remote/duty — to się nie zdarza na
 * Liferay/WP w klasycznym sensie (te wydziały publikują głównie ogłoszenia
 * stypendialne / informacyjne, nie lecturer absences).
 */
export function detectGenericStatus(title: string | null, body: string): AnnouncementStatus {
  const t = `${title ?? ''} ${body}`.toLowerCase()
  const eventPatterns = [
    /\bseminari/,
    /\bkonferencj/,
    /\bsymposj/,
    /\bsympozj/,
    /\bwarsztat/,
    /\bdebat/,
    /\bzaprasza/,
    /\bspotkani/,
    /\bwykład\b/,
    /\bobrona\b/,
    /\binauguracj/,
  ]
  if (eventPatterns.some((re) => re.test(t))) return 'event'
  return 'info'
}

/**
 * Najbardziej common regex do wyciągania imienia i nazwiska z polską ortografią
 * (godność + 1–2 segmenty nazwiska, hyphenated forms supported).
 */
const POLISH_NAME_PART = String.raw`[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźż]+(?:-[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźż]+)?(?:\s+[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźż]+(?:-[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźż]+)?)?`

const LECTURER_REGEX_PATTERNS: RegExp[] = [
  new RegExp(String.raw`\b(dr\s+hab\.\s+${POLISH_NAME_PART}(?:\s*,\s*prof\.\s+UJ)?)`, 'i'),
  new RegExp(String.raw`\b(dr\.?\s+inż\.?\s+${POLISH_NAME_PART})`, 'i'),
  new RegExp(String.raw`\b(dr\.?\s+${POLISH_NAME_PART})`),
  new RegExp(String.raw`\b(prof\.?\s+${POLISH_NAME_PART})`, 'i'),
  new RegExp(String.raw`\b(mgr\.?\s+${POLISH_NAME_PART})`, 'i'),
]

/**
 * Wyciąga lecturer name z bloku tekstu używając polskich regexów (godność +
 * imię/nazwisko). Zwraca FALLBACK_LECTURER_NAME jeśli nic nie pasuje.
 */
export function extractLecturer(block: string, fallback = FALLBACK_LECTURER_NAME): string {
  const oneLine = block.replace(/\s+/g, ' ').trim()
  for (const re of LECTURER_REGEX_PATTERNS) {
    const m = oneLine.match(re)
    if (m?.[1]) return clipLecturerPhrase(m[1])
  }
  return fallback
}

/**
 * Wykrywa techniczny śmieć w bloku tekstu (JavaScript, CSS, Liferay UI
 * fragmenty). Wyciągnięte z ISI parsera bo Liferay potrafi mieć identyczny
 * shape junku.
 */
export function isTechnicalJunkBlock(block: string): boolean {
  const t = block
  if (/jQuery\s*\(/i.test(t)) return true
  if (/document\.ready/i.test(t)) return true
  if (/\.hidden\s*\{/i.test(t)) return true
  if (/\.placeholder\s*\{/i.test(t) && /\.resizing/i.test(t)) return true
  if (/var\s+vid_w\s*=/i.test(t)) return true
  if (/\bfunction\s*\([^)]*\)\s*\{/.test(t) && t.includes('jQuery')) return true
  if (/@media\s+all\s+and/i.test(t) && /\{\s*display\s*:/i.test(t)) return true
  if (/html\.aui|#p_p_id_/i.test(t)) return true
  return false
}

/** Junk block check: kombinuje technical junk + len threshold + URL flood. */
export function junkBlock(block: string, opts: { minLength?: number } = {}): boolean {
  const minLength = opts.minLength ?? 30
  if (block.length < minLength) return true
  if (isTechnicalJunkBlock(block)) return true
  const urls = block.match(/https?:\/\//g)
  if (urls && urls.length >= 4 && block.length < 500) return true
  if (/^\s*[-•*]\s+\[/.test(block) && block.includes('rekrutacja')) return true
  return false
}

/**
 * Standardowy fetch HTML dla wszystkich scraperów wydziałowych —
 * identyczne nagłówki (BROWSER_USER_AGENT, polski accept-language) i timeout.
 * Wyniesione żeby parsery nie powielały konfiguracji axiosa.
 *
 * Rzuca przy non-200 / pustym body — caller (orkiestrator) łapie i loguje
 * per source, więc jeden padnięty wydział nie zatrzymuje pozostałych.
 */
export async function fetchHtml(url: string): Promise<string> {
  const axios = (await import('axios')).default
  const { data, status } = await axios.get<string>(url, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    timeout: 30000,
    responseType: 'text',
    transformResponse: [(d) => d],
  })

  if (status !== 200 || typeof data !== 'string' || data.length === 0) {
    throw new Error(`Bad response (status=${status}, type=${typeof data}, len=${typeof data === 'string' ? data.length : 0})`)
  }

  return data
}

/**
 * Normalizacja URL do absolutnego — Liferay portal generuje czasem
 * relatywne linki na index article. Caller podaje base URL (np. URL strony
 * scraper'owanej), funkcja zwraca pełny `https://...`.
 *
 * Zwraca null jeśli href jest pusty/javascript:/anchor — wtedy `source_url`
 * jest po prostu null w wyniku parsera.
 */
export function absoluteUrl(href: string | undefined, baseUrl: string): string | null {
  if (!href) return null
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:')) return null
  try {
    return new URL(trimmed, baseUrl).toString()
  } catch {
    return null
  }
}
