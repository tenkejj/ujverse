/**
 * SystemPrompt — factory generująca treść wiadomości `system` dla Bielika,
 * wstrzykiwaną przez `ContextInjectedBielikAdapter` (wzorzec Decorator).
 *
 * Cel: dostarczyć do modelu krótką, aktualną wiedzę o kluczowych zdarzeniach
 * akademickich (ogłoszenia ISI) i pulsie społeczności (najnowsze posty),
 * bez wpychania pełnych rekordów — oszczędność tokenów jest tu wymogiem
 * (api/chat.ts limituje `content` do 4000 znaków).
 *
 * Funkcja czysta — żaden side-effect, żaden import Supabase / DataService.
 * Wejście: `UnifiedContent<...>` z fasady; wyjście: gotowy tekst PL z
 * sekcjami markdown-like, który model rozumie jako kontekst.
 */

import type {
  AnnouncementMeta,
  PostMeta,
  UnifiedContent,
} from '../../types/content'

/** Maks. liczba rekordów per kategoria. Po więcej i tak nie ma sensu sięgać w MVP. */
export const MAX_RECORDS = 10

/** Hard cap pojedynczego `body`, żeby całość zmieściła się w MAX_CONTENT_CHARS. */
const MAX_BODY_CHARS = 240

const BASE_INSTRUCTION =
  'Jesteś asystentem akademickim UJverse. Odpowiadasz po polsku, zwięźle, w Markdown. ' +
  'Poniżej znajduje się aktualny kontekst (ogłoszenia z ISI UJ + ostatnie posty użytkowników). ' +
  'Korzystaj z niego tylko wtedy, gdy pasuje do pytania; jeśli nie pasuje, odpowiedz na podstawie ogólnej wiedzy ' +
  'i wyraźnie zaznacz, że nie znalazłeś informacji w kontekście. Nie zmyślaj danych — jeśli czegoś nie ma, powiedz o tym.'

function formatDate(timestamp: string | null): string {
  if (!timestamp) return '???'
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return '???'
  return d.toISOString().slice(0, 10)
}

function truncateBody(body: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim()
  if (normalized.length <= MAX_BODY_CHARS) return normalized
  return `${normalized.slice(0, MAX_BODY_CHARS - 1)}…`
}

function statusLabel(status: AnnouncementMeta['status']): string {
  switch (status) {
    case 'cancelled':
      return 'odwołane'
    case 'remote':
      return 'zdalnie'
    case 'duty':
      return 'dyżur'
    default:
      return status
  }
}

function formatAnnouncement(
  item: UnifiedContent<AnnouncementMeta>,
): string | null {
  const author = item.author.displayName.trim()
  const body = truncateBody(item.body)
  if (!author && !body) return null
  const date = formatDate(item.timestamp)
  const dept = item.metadata.department?.trim()
  const status = statusLabel(item.metadata.status)
  const deptPart = dept ? ` (${dept})` : ''
  return `- [${date}] ${author}${deptPart} — ${status}: ${body}`
}

function formatPost(item: UnifiedContent<PostMeta>): string | null {
  const author = item.author.displayName.trim()
  const body = truncateBody(item.body)
  if (!body) return null
  const date = formatDate(item.timestamp)
  const dept = item.metadata.department?.trim()
  const deptPart = dept ? ` (${dept})` : ''
  return `- [${date}] ${author}${deptPart}: ${body}`
}

/**
 * Buduje gotowy `system` content. Bez założeń co do sortowania wejścia —
 * dla pewności tnie do `MAX_RECORDS` i pomija puste rekordy.
 */
export function generateSystemContext(
  announcements: ReadonlyArray<UnifiedContent<AnnouncementMeta>>,
  posts: ReadonlyArray<UnifiedContent<PostMeta>>,
): string {
  const annLines = announcements
    .slice(0, MAX_RECORDS)
    .map(formatAnnouncement)
    .filter((line): line is string => line !== null)

  const postLines = posts
    .slice(0, MAX_RECORDS)
    .map(formatPost)
    .filter((line): line is string => line !== null)

  const sections: string[] = [BASE_INSTRUCTION]

  if (annLines.length > 0) {
    sections.push(`## Ogłoszenia (najnowsze):\n${annLines.join('\n')}`)
  } else {
    sections.push('## Ogłoszenia (najnowsze):\n- brak danych')
  }

  if (postLines.length > 0) {
    sections.push(`## Posty społeczności (najnowsze):\n${postLines.join('\n')}`)
  } else {
    sections.push('## Posty społeczności (najnowsze):\n- brak danych')
  }

  return sections.join('\n\n')
}
