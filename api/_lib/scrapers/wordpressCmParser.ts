/**
 * UJverse — parser komunikatów dla 3 wydziałów Collegium Medicum
 * (WordPress-based portale: Wydział Lekarski, Wydział Nauk o Zdrowiu,
 * Wydział Farmaceutyczny).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Strony CM używają klasycznego WP markupu — `<article class="post">`
 * z `<h2 class="entry-title">` i `<div class="entry-content">`.
 * Niektóre instalacje dorzucają `<time class="entry-date">` dla daty
 * publikacji (nie zapisujemy do bazy — `created_at` z DB wystarcza),
 * oraz `<a class="more-link">` jako "Czytaj więcej".
 *
 * Strategia parsowania:
 *   1. Lista postów = `article.post, article.type-post, .post-card`.
 *   2. Title = `.entry-title a, h2 a, h3 a`.
 *   3. Body = `.entry-content, .entry-summary` (jeśli oba — bierzemy
 *      pierwszy niepusty).
 *   4. URL = href tytułu lub `.more-link`.
 *
 * Wszystkie 3 wydziały CM publikują przeważnie ogłoszenia
 * informacyjne / stypendialne, więc default status = 'info'.
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
 * Selektory artykułów - uporządkowane od najbardziej specyficznych do generycznych.
 *
 * 3 portale CM (wl, wnz, farmacja) używają plugina Spectra/UAGB (Ultimate
 * Addons for Gutenberg), który wystawia listings przez block `uagb-post-grid`
 * z elementami `<article class="uagb-post__inner-wrap">`. Standardowe WP
 * theme'y (np. Astra base bez plugina) dają klasyczne `article.post`.
 * Trzymamy oba żeby parser działał uniwersalnie - jeśli wydział zmieni
 * plugin, zostanie wykryty drugim setem.
 */
const POST_SELECTORS = [
  // Spectra/UAGB plugin (3 portale CM: wl, wnz, farmacja).
  'article.uagb-post__inner-wrap',
  // Klasyczny WordPress (post archive / blog index).
  'article.post',
  'article.type-post',
  // Inne custom WP card layouts.
  '.post-card',
  '.news-card',
  '.posts-list .post',
] as const

const TITLE_SELECTORS = [
  // Spectra/UAGB - tytuł w h4 z linkiem.
  '.uagb-post__title a, .uagb-post__title',
  // Klasyczny WordPress.
  '.entry-title a, .entry-title',
  'h2.post-title a, h2.post-title',
  'h3.post-title a, h3.post-title',
  'h2 a, h2',
  'h3 a, h3',
] as const

const BODY_SELECTORS = [
  // Spectra/UAGB - excerpt dedykowany przez plugin.
  '.uagb-post__excerpt',
  '.uagb-post__text.uagb-post__excerpt',
  // Klasyczny WordPress.
  '.entry-content',
  '.entry-summary',
  '.post-content',
  '.post-excerpt',
] as const

const LINK_SELECTORS = [
  // Spectra/UAGB.
  '.uagb-post__title a',
  // Klasyczny WordPress.
  '.entry-title a',
  'h2 a',
  'h3 a',
  '.more-link',
  'a.read-more',
] as const

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

function extractFromPosts(
  $: CheerioAPI,
  baseUrl: string,
  ctx: { department: string; source: string },
): ParsedAnnouncement[] {
  for (const selector of POST_SELECTORS) {
    const posts = $(selector)
    if (posts.length === 0) continue

    const rows: ParsedAnnouncement[] = []
    posts.each((_, el) => {
      const $el = $(el)
      const title = pickFirstText($el, TITLE_SELECTORS)
      const href = pickFirstHref($el, LINK_SELECTORS)
      const url = absoluteUrl(href ?? undefined, baseUrl)

      // Body z dedykowanej sekcji jeśli jest, inaczej cały tekst węzła.
      const explicitBody = pickFirstText($el, BODY_SELECTORS)
      let body: string
      if (explicitBody && explicitBody.length >= 40) {
        body = cleanupAnnouncementText(explicitBody)
      } else {
        const fullText = cleanupAnnouncementText($el.text())
        body =
          title && fullText.startsWith(title)
            ? cleanWhitespace(fullText.slice(title.length))
            : fullText
      }

      if (junkBlock(body, { minLength: 40 })) return
      // Card-style listings często mają sam tytuł + " Czytaj więcej" —
      // odrzucamy jeśli body to praktycznie sam tytuł.
      if (title && body.length < title.length + 20) return

      rows.push({
        body,
        title,
        source_url: url,
        lecturer_name: extractLecturer(body, FALLBACK_LECTURER_NAME),
        status: detectGenericStatus(title, body),
        department: ctx.department,
        source: ctx.source,
        source_kind: 'wordpress_cm',
      })
    })

    if (rows.length > 0) return rows
  }

  return []
}

/**
 * Fallback dla stron WP CM gdzie listing nie zawiera `<article>` tylko
 * customowy układ (np. `#main h2` jako tytuły, `#main p` jako body).
 * Bierzemy wszystkie `<h2>`/`<h3>` w mainie, parę paragrafów pod każdym.
 */
function extractFromHeadings(
  $: CheerioAPI,
  baseUrl: string,
  ctx: { department: string; source: string },
): ParsedAnnouncement[] {
  const main =
    $('#main, #content, main, [role="main"]').first().length > 0
      ? $('#main, #content, main, [role="main"]').first()
      : $('body')

  const rows: ParsedAnnouncement[] = []
  main.find('h2, h3').each((_, el) => {
    const $h = $(el)
    const titleText = cleanWhitespace($h.text())
    if (titleText.length < 8 || titleText.length > 400) return

    // Link — bierzemy z linku w nagłówku lub z najbliższego siblinga.
    const innerLink = $h.find('a').first()
    const href = innerLink.attr('href') ?? $h.next('a').attr('href')
    const url = absoluteUrl(href, baseUrl)

    // Body — 1-2 paragrafy bezpośrednio po nagłówku.
    const bodyParts: string[] = []
    let sibling = $h.next()
    let safetyCounter = 0
    while (sibling.length > 0 && safetyCounter < 4) {
      const tagName = sibling.get(0)?.tagName?.toLowerCase()
      if (tagName === 'h2' || tagName === 'h3') break
      if (tagName === 'p' || tagName === 'div') {
        const txt = cleanWhitespace(sibling.text())
        if (txt.length >= 20) bodyParts.push(txt)
      }
      sibling = sibling.next()
      safetyCounter += 1
    }

    const body = cleanupAnnouncementText(bodyParts.join('\n\n') || titleText)
    if (junkBlock(body, { minLength: 30 })) return
    if (body === titleText && !url) return

    rows.push({
      body,
      title: titleText,
      source_url: url,
      lecturer_name: extractLecturer(body, FALLBACK_LECTURER_NAME),
      status: detectGenericStatus(titleText, body),
      department: ctx.department,
      source: ctx.source,
      source_kind: 'wordpress_cm',
    })
  })

  return rows
}

export function parseWordpressCm(
  html: string,
  ctx: { baseUrl: string; department: string; source: string },
): ParsedAnnouncement[] {
  const $ = load(html)
  const fromPosts = extractFromPosts($, ctx.baseUrl, ctx)
  if (fromPosts.length > 0) return fromPosts
  return extractFromHeadings($, ctx.baseUrl, ctx)
}

/**
 * Selektory głównego content-elementu na PODSTRONIE artykułu WordPress CM.
 * Większość WP themes używa `.entry-content` jako głównego pojemnika treści;
 * starsze CM themes mają `.post-content` lub generyczny `#main article`.
 */
const FULL_ARTICLE_SELECTORS = [
  'article.post .entry-content',
  'article .entry-content',
  '.entry-content',
  '.post-content',
  '#main article',
  '#content article',
  '[role="main"] article',
  'article',
  'main',
] as const

/**
 * Drugi pass scrapera — pobiera HTML PODSTRONY artykułu WordPress CM
 * (z `source_url`) i wyciąga pełną treść. Patrz `parseFullLiferayArticle`
 * dla rationale i konwencji zwracanej wartości.
 */
export function parseFullWordpressCmArticle(html: string): string | null {
  const $ = load(html)

  for (const selector of FULL_ARTICLE_SELECTORS) {
    const el = $(selector).first()
    if (el.length === 0) continue
    el.find(
      'nav, .nav-links, .post-navigation, .share-buttons, .sharedaddy, script, style, header, footer, .comments-area',
    ).remove()
    const text = cleanupAnnouncementText(el.text())
    if (text.length >= 300) return text
  }

  const body = $('body').first()
  if (body.length === 0) return null
  body
    .find('nav, header, footer, script, style, .site-header, .site-footer, .widget-area, .comments-area')
    .remove()
  const text = cleanupAnnouncementText(body.text())
  return text.length >= 300 ? text : null
}
