/**
 * UJverse — parser komunikatów ISI UJ (Drupal-based portal WZiKS).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wyciągnięty z oryginalnego `api/scrape-wziks.ts` (refactor 2026-07-15
 * pod multi-faculty scraper). Działa wyłącznie dla portalu
 * `isi.uj.edu.pl/studenci/news/komunikaty` — ISI UJ ma własny shape
 * (lecturer-block ogłoszeń odzielonych myślnikami), inny niż 12 wydziałów
 * na Liferayu i 3 na WordPressie CM.
 *
 * Co charakterystycznego dla ISI:
 *   1. Komunikaty NIE mają tytułów ani osobnych article URL — to lista
 *      paragrafów (lecturer-level absences) oddzielonych liniami
 *      myślników. Stąd `title: null` i `source_url: null` w wyniku.
 *   2. Status komunikatu wyciąga się z treści (cancelled/remote/duty),
 *      a nie z meta-tagów strony.
 *   3. Lecturer name jest podstawową wartością — większość komunikatów
 *      ma formę "Szanowni Państwo, zajęcia dr. X są odwołane…".
 */
import { load, type CheerioAPI } from 'cheerio'
import {
  cleanWhitespace,
  cleanupAnnouncementText,
  detectIsiStatus,
  extractLecturer,
  junkBlock,
  stripLecturerIntroPhrases,
} from './utils.js'
import type { ParsedAnnouncement } from './types.js'

const SCRAPER_DEBUG_RAW = process.env.SCRAPER_DEBUG_RAW === '1'

/**
 * Linia-separator: krótsze ciągi myślników/underscore itd. (≥5 znaków),
 * przy czym znacząca część znaku to „kreski" (strona ISI bywa niespójna).
 */
function isSeparatorLine(line: string): boolean {
  const t = line.trim()
  if (t.length < 5) return false
  const dashLike = (t.match(/[-─–—_.=~·]+/g) ?? []).join('').length
  return dashLike / t.length >= 0.55
}

/** Dzielenie po liniach z samymi (głównie) myślnikami — bez wymogu \n przed/po. */
function splitBlocksByDashLines(text: string): string[] {
  const lines = text.split(/\n/)
  const blocks: string[] = []
  let cur: string[] = []

  for (const line of lines) {
    if (isSeparatorLine(line)) {
      const chunk = cur.join('\n').trim()
      if (chunk.length >= 20) blocks.push(chunk)
      cur = []
    } else {
      cur.push(line)
    }
  }
  const last = cur.join('\n').trim()
  if (last.length >= 20) blocks.push(last)
  return blocks
}

function fallbackRootText($: CheerioAPI): string {
  const root =
    $('main').first().length > 0
      ? $('main').first()
      : $('[role="main"]').first().length > 0
        ? $('[role="main"]').first()
        : $('article').first().length > 0
          ? $('article').first()
          : $('.layout-content, .region-content, .node__content').first().length > 0
            ? $('.layout-content, .region-content, .node__content').first()
            : $('body')

  return cleanWhitespace(root.text())
}

/**
 * Tekst z treści komunikatów: najpierw typowe klasy ISI / Drupal,
 * potem ogólny main / article.
 */
function extractBlocksFromHtml(html: string): string[] {
  const $ = load(html)

  const itemSelectors = '.news-item, .views-row, .node--type-news, .article-list-item, .news-list-item'
  const newsItems = $(itemSelectors)
  if (newsItems.length > 0) {
    const fromItems = newsItems
      .map((i, el) => {
        const rawHtml = $(el).html() ?? ''
        const text = cleanWhitespace($(el).text())
        if (SCRAPER_DEBUG_RAW) {
          console.log(`[SCRAPER_DEBUG_RAW][isi:item:${i}] RAW_HTML_START`)
          console.log(rawHtml)
          console.log(`[SCRAPER_DEBUG_RAW][isi:item:${i}] RAW_HTML_END`)
          console.log(`[SCRAPER_DEBUG_RAW][isi:item:${i}] RAW_TEXT_START`)
          console.log(text)
          console.log(`[SCRAPER_DEBUG_RAW][isi:item:${i}] RAW_TEXT_END`)
        }
        return text
      })
      .get()
      .filter((t) => t.length >= 20)
    if (fromItems.length > 0) return Array.from(new Set(fromItems))
  }

  const articleRoots = $('.article-content, .field--name-body, .node__content, .article .content')
  if (articleRoots.length > 0) {
    const combined = cleanWhitespace(
      articleRoots
        .map((_, el) => $(el).text())
        .get()
        .join('\n'),
    )
    if (combined.length >= 20) {
      const dashed = splitBlocksByDashLines(combined)
      if (dashed.length > 0) return dashed
      return [combined]
    }
  }

  const text = fallbackRootText($)
  return Array.from(new Set(splitBlocksByDashLines(text)))
}

const ANNOUNCEMENT_START_RE = /(Szanowni Państwo|Drogie Studentki,\s*Drodzy Studenci)/gi

function splitCandidateAnnouncements(block: string): string[] {
  const starts = Array.from(block.matchAll(ANNOUNCEMENT_START_RE))
  if (starts.length === 0) return [block]
  const slices: string[] = []
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]?.index ?? 0
    const nextStart = starts[i + 1]?.index ?? block.length
    const chunk = block.slice(start, nextStart).trim()
    if (chunk.length >= 20) slices.push(chunk)
  }
  return slices.length > 0 ? slices : [block]
}

/**
 * Parser ISI UJ — sygnatura zgodna z `ScraperFn` (orkiestrator wywoła
 * `parseIsiDrupal(html, source)` dla każdego source typu 'isi_drupal').
 */
export function parseIsiDrupal(
  html: string,
  ctx: { department: string; source: string },
): ParsedAnnouncement[] {
  const blocks = extractBlocksFromHtml(html)
  const rows: ParsedAnnouncement[] = []

  for (let i = 0; i < blocks.length; i++) {
    const raw = blocks[i]
    if (SCRAPER_DEBUG_RAW) {
      console.log(`[SCRAPER_DEBUG_RAW][isi:block:${i}] PRE_FILTER_START`)
      console.log(raw)
      console.log(`[SCRAPER_DEBUG_RAW][isi:block:${i}] PRE_FILTER_END`)
    }

    const cleaned = cleanupAnnouncementText(raw)
    const candidates = splitCandidateAnnouncements(cleaned)

    for (let c = 0; c < candidates.length; c++) {
      const body = stripLecturerIntroPhrases(candidates[c] ?? '')
      if (junkBlock(body)) {
        if (SCRAPER_DEBUG_RAW) {
          console.log(`[SCRAPER_DEBUG_RAW][isi:block:${i}][candidate:${c}] SKIPPED_AS_JUNK`)
        }
        continue
      }
      rows.push({
        body,
        title: null,
        source_url: null,
        lecturer_name: extractLecturer(body),
        status: detectIsiStatus(body),
        department: ctx.department,
        source: ctx.source,
        source_kind: 'isi_drupal',
      })
    }
  }

  return rows
}
