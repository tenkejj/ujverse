/**
 * Dopina markdown linki do odpowiedzi, gdy Llama przeredagowała fakty
 * i wycięła linki z linii tool-result.
 */

import {
  getItemsArray,
  pickString,
  pickStringOrNull,
} from './toolFormatHelpers.js'

function textHasLink(text: string, needle: string): boolean {
  if (!needle) return true
  return text.includes(needle)
}

export function enrichWithEntityLinks(
  toolName: string,
  result: unknown,
  text: string,
): string {
  if (!text || typeof result === 'string') return text
  const items = getItemsArray(result)
  if (!items || items.length === 0) return text

  const links: string[] = []

  for (const item of items.slice(0, 5)) {
    if (toolName === 'get_latest_posts') {
      const id = pickString(item, 'id')
      const author = (typeof item === 'object' && item !== null
        ? (item as Record<string, unknown>).author
        : null) as Record<string, unknown> | null
      const username =
        (author && typeof author.username === 'string' && author.username) ||
        'post'
      if (id && !textHasLink(text, `/thread/${id}`)) {
        links.push(`[wpis @${username}](/thread/${encodeURIComponent(id)})`)
      }
    }

    if (toolName === 'search_events') {
      const id = pickString(item, 'id')
      const title = pickString(item, 'title') || 'wydarzenie'
      if (id && !textHasLink(text, `/events?open=`)) {
        links.push(
          `[${title}](/events?open=${encodeURIComponent(id)})`,
        )
      }
    }

    if (
      toolName === 'search_discounts' ||
      toolName === 'get_trending_discounts'
    ) {
      const url = pickStringOrNull(item, 'website_url')
      const business = pickString(item, 'business_name') || 'lokal'
      if (url && !textHasLink(text, url)) {
        links.push(`[${business}](${url})`)
      }
    }

    if (toolName === 'get_latest_announcements') {
      const id = pickString(item, 'id')
      const lecturer =
        pickString(item, 'lecturer_name_nominative') ||
        pickString(item, 'lecturer_name') ||
        'ogłoszenie'
      if (id && !textHasLink(text, `/moj-plan?announcement=`)) {
        links.push(
          `[${lecturer}](/moj-plan?announcement=${encodeURIComponent(id)})`,
        )
      }
    }
  }

  if (links.length === 0) return text
  return `${text.trim()}\n\n${links.join(' · ')}`
}
