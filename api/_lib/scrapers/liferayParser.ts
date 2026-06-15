/**
 * UJverse — parser komunikatów dla 12 wydziałów na portalu Liferay UJ.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Pokrywa wydziały:
 *   Filozoficzny (phils), Prawa i Administracji (wpia), Historyczny,
 *   Filologiczny (filg), Polonistyki, Fizyki/Astronomii/Informatyki
 *   Stosowanej (fais), Matematyki i Informatyki (matinf), Chemii,
 *   Biologii, Studiów Międzynarodowych i Politycznych (wsmip),
 *   Geografii i Geologii (wgig), Biochemii/Biofizyki/Biotechnologii
 *   (wbbib).
 *
 * Liferay UJ ma w miarę spójny markup — list ogłoszeń jako serię
 * `.journal-content-article` lub `.asset-entry`, każdy z `<h2>`/`<h3>`
 * jako tytułem, `<a>` jako linkiem do pełnego artykułu i blokiem treści.
 * Strony różnią się w detalach (różne wersje themu Liferaya), więc
 * scraper jedzie z fallback chain selektorów.
 *
 * Strategia parsowania:
 *   1. Próbujemy znaleźć "artykułowe" węzły (najbardziej common klasy).
 *   2. Z każdego węzła wyciągamy: title (<h2>/<h3>/.asset-title), link
 *      (<a href>), excerpt/body (cały tekst węzła).
 *   3. Po wyciągnięciu listy filtrujemy junk (krótkie/techniczne bloki).
 *   4. Fallback: jeśli nic nie złapaliśmy z artykułów, zbieramy linki
 *      do podstron komunikatów i robimy z każdego mini-card.
 */
import { load, type Cheerio, type CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import {
  absoluteUrl,
  cleanWhitespace,
  cleanupAnnouncementText,
  detectGenericStatus,
  extractLecturer,
  FALLBACK_LECTURER_NAME,
  junkBlock,
} from './utils.js'
import type { ParsedAnnouncement } from './types.js'

/**
 * Selektory artykułów na portalu Liferay UJ — uporządkowane od
 * najbardziej specyficznych do najbardziej generycznych. Pierwsza
 * znaleziona grupa wygrywa.
 */
const ARTICLE_SELECTORS = [
  // Najbardziej common — Liferay journal content (główny case na UJ)
  '.journal-content-article',
  // Asset publisher (drugi główny case — lista artykułów)
  '.asset-abstract, .asset-entry',
  // Generic Liferay article shell
  'article.journal-article, .article-content',
  // Fallback dla starszych themów
  '.portlet-body .ui-card, .portlet-body article',
] as const

/** Selektory tytułu wewnątrz artykułu (uporządkowane od najlepszego). */
const TITLE_SELECTORS = [
  '.asset-title a, .asset-title',
  '.journal-content-article-title',
  'h2 a, h2',
  'h3 a, h3',
  '.entry-title a, .entry-title',
] as const

/** Selektor linku — pierwszy `<a href>` wewnątrz artykułu. */
const LINK_SELECTORS = ['.asset-title a', 'h2 a', 'h3 a', 'a'] as const

/**
 * Wyciąga pierwszy match z listy selektorów (selectorów próbujemy w kolejności).
 */
function pickFirstText($el: Cheerio<Element>, selectors: readonly string[]): string | null {
  for (const sel of selectors) {
    const found = $el.find(sel).first()
    if (found.length > 0) {
      const txt = cleanWhitespace(found.text())
      if (txt.length > 0) return txt
    }
  }
  return null
}

function pickFirstHref($el: Cheerio<Element>, selectors: readonly string[]): string | null {
  for (const sel of selectors) {
    const found = $el.find(sel).first()
    if (found.length > 0) {
      const href = found.attr('href')
      if (href && href.length > 0) return href
    }
  }
  return null
}

/**
 * Pierwsza próba — szuka klastrów artykułowych po selektorach Liferaya.
 * Zwraca pustą tablicę gdy żaden selektor nic nie złapał (caller robi
 * fallback do `extractFromLinks`).
 */
function extractFromArticles(
  $: CheerioAPI,
  baseUrl: string,
  ctx: { department: string; source: string },
): ParsedAnnouncement[] {
  for (const selector of ARTICLE_SELECTORS) {
    const articles = $(selector)
    if (articles.length === 0) continue

    const rows: ParsedAnnouncement[] = []
    articles.each((_, el) => {
      const $el = $(el)
      const title = pickFirstText($el, TITLE_SELECTORS)
      const href = pickFirstHref($el, LINK_SELECTORS)
      const url = absoluteUrl(href ?? undefined, baseUrl)

      // Bierzemy cały tekst węzła ALE bez powtórzenia tytułu na początku.
      const fullText = cleanupAnnouncementText($el.text())
      let body = fullText
      if (title && fullText.startsWith(title)) {
        body = cleanWhitespace(fullText.slice(title.length))
      }

      if (junkBlock(body, { minLength: 40 })) return
      // Liferay listing często ma duplikat tytułu w body + 1-2 słowa typu
      // "więcej o…" — odrzucamy jeśli body to praktycznie sam tytuł.
      if (title && body.length < title.length + 20) return

      const lecturer = extractLecturer(body, FALLBACK_LECTURER_NAME)
      rows.push({
        body,
        title,
        source_url: url,
        lecturer_name: lecturer,
        status: detectGenericStatus(title, body),
        department: ctx.department,
        source: ctx.source,
        source_kind: 'liferay',
      })
    })

    if (rows.length > 0) return rows
  }

  return []
}

/**
 * Fallback parser — gdy żaden artykuł nie został wykryty, zbieramy
 * linki do podstron komunikatów (np. `/komunikat/123`,
 * `/aktualnosci/-/journal_content/...`). Każdy link → osobny wpis
 * z minimum kontekstu (tytuł = anchor text, body = zwykle ten sam).
 *
 * Tu jeszcze NIE pobieramy pełnej podstrony (nie chcemy 50 dodatkowych
 * requestów per source); jeśli treść z listy okaże się za chuda, UI
 * pokaże tylko tytuł + link.
 */
function extractFromLinks(
  $: CheerioAPI,
  baseUrl: string,
  ctx: { department: string; source: string },
): ParsedAnnouncement[] {
  const main =
    $('#content, .layout-content, [role="main"], main, body').first().length > 0
      ? $('#content, .layout-content, [role="main"], main, body').first()
      : $('body')

  const rows: ParsedAnnouncement[] = []
  const seenUrls = new Set<string>()

  main.find('a[href]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    const url = absoluteUrl(href ?? undefined, baseUrl)
    if (!url || seenUrls.has(url)) return
    // Pomijamy oczywiste navigację, anchor links itd.
    if (/^(mailto:|tel:|#)/.test(href ?? '')) return
    // Linki musimy odsiać — bierzemy tylko te które wyglądają jak
    // pojedynczy artykuł (zawierają `/journal_content/`, `/komunikat`,
    // `/aktualnos`, lub mają `instance` w ścieżce).
    const looksLikeArticle =
      /\/journal_content\//.test(url) ||
      /\/komunikat/.test(url) ||
      /\/aktualnosci\//.test(url) ||
      /_INSTANCE_/.test(url)
    if (!looksLikeArticle) return

    const title = cleanWhitespace($a.text())
    if (!title || title.length < 8 || title.length > 400) return

    seenUrls.add(url)
    rows.push({
      body: title,
      title,
      source_url: url,
      lecturer_name: FALLBACK_LECTURER_NAME,
      status: detectGenericStatus(title, title),
      department: ctx.department,
      source: ctx.source,
      source_kind: 'liferay',
    })
  })

  return rows
}

/**
 * Główna funkcja parsera — orkiestrator wywołuje
 * `parseLiferay(html, { baseUrl, department, source })` dla każdego
 * source typu 'liferay'.
 */
export function parseLiferay(
  html: string,
  ctx: { baseUrl: string; department: string; source: string },
): ParsedAnnouncement[] {
  const $ = load(html)
  const fromArticles = extractFromArticles($, ctx.baseUrl, ctx)
  if (fromArticles.length > 0) return fromArticles
  return extractFromLinks($, ctx.baseUrl, ctx)
}

/**
 * Selektory głównego content-elementu na PODSTRONIE artykułu Liferay UJ.
 * Te selektory chwytają większą porcję treści (cały body artykułu),
 * przeciwnie do `ARTICLE_SELECTORS` które działają na listings (card).
 *
 * Kolejność: od najbardziej specyficznego (jeden konkretny artykuł na
 * stronie) do najbardziej generycznego (cały main content).
 */
const FULL_ARTICLE_SELECTORS = [
  '.journal-content-article',
  'article.journal-article',
  '.article-content',
  '.portlet-asset-publisher .asset-content',
  '.portlet-body article',
  '[role="main"] article',
  '[role="main"]',
  '#content article',
  '#content',
  'main',
] as const

/**
 * Drugi pass scrapera — pobiera HTML PODSTRONY artykułu (z `source_url`)
 * i wyciąga pełną treść. Zwraca `null` gdy nic sensownego nie znaleźliśmy
 * (caller powinien zostawić body z listings nieruszone).
 *
 * Strategia: idziemy po `FULL_ARTICLE_SELECTORS`, bierzemy pierwszy z
 * minimalnym budżetem długości (300+ znaków po czyszczeniu). Krótsze =
 * pewnie złapaliśmy nawigację albo widget.
 */
export function parseFullLiferayArticle(html: string): string | null {
  const $ = load(html)

  for (const selector of FULL_ARTICLE_SELECTORS) {
    const el = $(selector).first()
    if (el.length === 0) continue
    // Usuń typowe „chrome" - menu, share, breadcrumbs - przed wyciągnięciem tekstu.
    el.find(
      'nav, .breadcrumbs, .breadcrumb, .social-share, .share-buttons, .portlet-title, script, style, header, footer',
    ).remove()
    const text = cleanupAnnouncementText(el.text())
    if (text.length >= 300) return text
  }

  // Ostatecznie spróbuj samego body i nadziej się że pomoże.
  const body = $('body').first()
  if (body.length === 0) return null
  body
    .find('nav, header, footer, script, style, .navbar, .breadcrumbs, .breadcrumb')
    .remove()
  const text = cleanupAnnouncementText(body.text())
  return text.length >= 300 ? text : null
}
