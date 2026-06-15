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
  getCurrentAcademicYearStart,
  isBodyJunk,
  isHeadlineJunk,
  junkBlock,
  parsePolishDate,
  stripChromeFromDom,
} from './utils.js'
import type { ParsedAnnouncement } from './types.js'

/**
 * Selektory artykułów na portalu Liferay UJ — uporządkowane od
 * najbardziej specyficznych do najbardziej generycznych. Pierwsza
 * znaleziona grupa wygrywa.
 *
 * UJ używa 3 różnych themes Liferaya, każdy z osobnym markupem listingu:
 *   1. `.post-excerpt` — karta na listings z `__title`, `__text`, `__sub-title`,
 *      `__image`, `__link`. Najczęstszy na wydziałach (wpia, chemia, fais,
 *      matinf, polonistyka, wbbib, wsmip, biologia, filozoficzny).
 *   2. `.journal-content-article` — generyczny wrapper Liferaya, czasem
 *      zawiera całą listę jako wnętrze (więc lepiej `.post-excerpt` najpierw).
 *      Używany jako stand-alone na WZiKS / niektórych innych wydziałach.
 *   3. `.asset-abstract` / `.asset-entry` — Asset Publisher portlet.
 */
const ARTICLE_SELECTORS = [
  // UJ "post-excerpt" theme — KARTA na listings (multiple per page).
  // MUSI być pierwszy, bo te karty są zwykle wewnątrz
  // `.journal-content-article` (wrapper) — bez tego parser zlepi wszystkie
  // 8 kart w jeden komunikat.
  '.post-excerpt',
  // WZiKS / starsze themes — całe portlety treści jako osobne karty.
  '.journal-content-article',
  // Asset Publisher (Liferay native lista artykułów).
  '.asset-abstract, .asset-entry',
  // Generic Liferay article shell.
  'article.journal-article, .article-content',
  // Fallback dla starszych themów.
  '.portlet-body .ui-card, .portlet-body article',
] as const

/** Selektory tytułu wewnątrz artykułu (uporządkowane od najlepszego). */
const TITLE_SELECTORS = [
  '.post-excerpt__title a, .post-excerpt__title',
  '.asset-title a, .asset-title',
  '.journal-content-article-title',
  'h2 a, h2',
  'h3 a, h3',
  '.entry-title a, .entry-title',
] as const

/** Selektory body wewnątrz artykułu — preferujemy dedykowany excerpt. */
const BODY_SELECTORS = [
  '.post-excerpt__text',
  '.post-excerpt__sub-title + .post-excerpt__text',
  '.asset-summary',
  '.journal-content-article-text',
] as const

/** Selektor linku — pierwszy `<a href>` wewnątrz artykułu. */
const LINK_SELECTORS = [
  '.post-excerpt__title a',
  '.post-excerpt__link',
  '.post-excerpt__image a',
  '.asset-title a',
  'h2 a',
  'h3 a',
  'a',
] as const

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

      // Preferujemy dedykowany excerpt (np. `.post-excerpt__text`) gdy istnieje
      // — czyste body bez nagłówków / dat / "więcej". Fallback do całego tekstu
      // węzła i obcięcia tytułu z przodu.
      const explicitBody = pickFirstText($el, BODY_SELECTORS)
      let body: string
      if (explicitBody && explicitBody.length >= 30) {
        body = cleanupAnnouncementText(explicitBody)
      } else {
        const fullText = cleanupAnnouncementText($el.text())
        body = title && fullText.startsWith(title)
          ? cleanWhitespace(fullText.slice(title.length))
          : fullText
      }

      if (junkBlock(body, { minLength: 40 })) return
      // Liferay listing często ma duplikat tytułu w body + 1-2 słowa typu
      // "więcej o…" — odrzucamy jeśli body to praktycznie sam tytuł.
      if (title && body.length < title.length + 20) return
      // Tytuł lub body to nawigacja / footer / paginacja — odrzucamy
      // zamiast tworzyć fake komunikat (np. "Strona 140", "Facebook / Youtube").
      if (isHeadlineJunk(title)) return
      if (isBodyJunk(body)) return

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
    // Paginacja Liferaya: `?strona=N` / `?page=N` — nie artykuł, tylko
    // kolejna strona listings. Bez tego scraper wciągał "Strona 140" itp.
    if (/[?&](strona|page|p|paged)=\d+/i.test(url)) return
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
    // Pomijamy nagłówki nawigacyjne / fallback (np. "Komunikat wydziałowy",
    // "Strona 140", "Aktualności", social linki).
    if (isHeadlineJunk(title)) return

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
 * Fallback parser dla stron typu wgig — statyczna strona z listą
 * komunikatów w `<p>` z linkami do PDF (`<p>Komunikat wydziałowy
 * <a href="...">nr 5/2026 ...</a></p>`). Każdy `<p>` z linkiem to
 * osobny komunikat.
 *
 * Wywoływany tylko gdy `extractFromArticles` zwróciło 0 lub 1 row —
 * heurystyka: 0 rows = brak markup'u kart, 1 row = pewnie zlepiona
 * cała lista z jakiegoś wrapper'a, lepiej rozbić po `<p>`.
 */
function extractFromParagraphLinks(
  $: CheerioAPI,
  baseUrl: string,
  ctx: { department: string; source: string },
): ParsedAnnouncement[] {
  const main =
    $('.article__content, .article-content, #content, [role="main"], main').first().length > 0
      ? $('.article__content, .article-content, #content, [role="main"], main').first()
      : $('body')

  const rows: ParsedAnnouncement[] = []
  const seenUrls = new Set<string>()
  // Statyczne strony archiwum (np. wgig) trzymają komunikaty z 5+ lat wstecz.
  // Pokazujemy tylko bieżący rok akademicki (od 1 października) — starsze
  // wpisy zaśmiecają feed, a i tak są dostępne na portalu źródłowym.
  const academicYearStart = getCurrentAcademicYearStart()
  // Hard cap na wypadek gdyby data nie parsowała się (mojibake, custom format)
  // — paragrafy są chronologicznie od najnowszych, więc top 25 nigdy nie
  // zawiera archiwum sprzed 2 lat.
  const MAX_ROWS = 25

  main.find('p').each((_, p) => {
    if (rows.length >= MAX_ROWS) return false
    const $p = $(p)
    const $a = $p.find('a').first()
    if ($a.length === 0) return
    const href = $a.attr('href')
    const url = absoluteUrl(href ?? undefined, baseUrl)
    if (!url || seenUrls.has(url)) return
    if (/^(mailto:|tel:|#)/.test(href ?? '')) return
    if (/[?&](strona|page|p|paged)=\d+/i.test(url)) return

    // Body = cały paragraf (zwykle "Komunikat wydziałowy nr X/2026 ...").
    const body = cleanupAnnouncementText($p.text())
    if (junkBlock(body, { minLength: 50 })) return
    if (isBodyJunk(body)) return

    // Cutoff po dacie: parsujemy "z dnia D miesiąca YYYY" z body i
    // odrzucamy komunikaty starsze niż początek roku akademickiego.
    // Brak daty = traktujemy jako świeży (paragraf bez daty zwykle to
    // bieżąca informacja, nie archiwum).
    const announcementDate = parsePolishDate(body)
    if (announcementDate && announcementDate < academicYearStart) return

    // Tytuł — tniemy na NATURALNYM brzegu (kropka, " w sprawie:", " z dnia"),
    // bo paragraf jest jednym długim zdaniem ("Komunikat wydziałowy nr X/2026
    // z dnia ... wydany przez Dziekana ... w sprawie: ...").
    // Granice są w kolejności preferencji — pierwsza która zmieści się w 130
    // znakach wygrywa, fallback na pierwszą spację po 80.
    let title: string | null = null
    if (body.length > 0) {
      if (body.length <= 130) {
        title = body
      } else {
        const breakPoints = [
          body.search(/\s+w\s+sprawie\s*:/i),
          body.search(/\.\s/),
          body.indexOf('\n'),
          body.indexOf(' ', 80),
        ].filter((p) => p > 30 && p <= 140)
        const cut = breakPoints.length > 0 ? Math.min(...breakPoints) : 130
        title = body.slice(0, cut).replace(/[,;:\s]+$/, '') + '…'
      }
    }
    if (isHeadlineJunk(title)) return

    seenUrls.add(url)
    rows.push({
      body,
      title,
      source_url: url,
      lecturer_name: FALLBACK_LECTURER_NAME,
      status: detectGenericStatus(title, body),
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
  // Wyrzucamy nawigację / footer / paginację / widget dostępności PRZED
  // parsowaniem żeby `$('article')` i fallback `extractFromLinks` nie
  // łapały "Strona 140" z paginacji ani "Facebook / Youtube" z footer'a.
  stripChromeFromDom($)
  const fromArticles = extractFromArticles($, ctx.baseUrl, ctx)
  // Jeśli mamy ≥2 articles — to layout kart (zaufaj). Jeden article to
  // zwykle wrapper który zlepił całą listę — spróbuj rozbić po paragrafach.
  if (fromArticles.length >= 2) return fromArticles

  const fromParagraphs = extractFromParagraphLinks($, ctx.baseUrl, ctx)
  if (fromParagraphs.length >= 2) return fromParagraphs

  // Zostały te 0-1 articles albo extractFromLinks fallback do anchor-only.
  if (fromArticles.length === 1) return fromArticles
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
