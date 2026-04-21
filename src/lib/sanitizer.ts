/**
 * UjverseSanitizer — jedyne źródło prawdy dla "walki z artefaktami LLM".
 *
 * Każdy adapter w `src/services/adapters` woła odpowiednie metody tej klasy
 * PRZED zbudowaniem `UnifiedContent`. Dzięki temu UI nigdy nie widzi surowych
 * danych ze scrapera / DB / promptów.
 *
 * Zasada: metody są czyste, deterministyczne i bezpieczne (nigdy nie rzucają,
 * zawsze zwracają string). Puste / null wejście -> pusty string.
 */

const ACADEMIC_TITLE_PATTERNS: RegExp[] = [
  // Standardowe polskie tytuły — wariantem odmienionym i ze skrótem/kropką.
  /\b(?:prof(?:\.|esor[a-z]*)?|dr(?:\.|a|em|owi|owie|ów|em|em)?|doc(?:\.|ent[a-z]*)?|mgr(?:\.|a|em|owi)?|inż(?:\.|ynier[a-z]*)?|lic(?:\.|encjat[a-z]*)?)\b/gi,
  // "hab." / "habilitowany" / "habilitowana" / "habilitowanego"
  /\bhab(?:\.|ilitowan[a-ząęółśżźćń]+)?\b/gi,
]

const LLM_NOISE_PREFIX_PATTERNS: RegExp[] = [
  /^\s*(?:Oto|Tutaj|Proszę|Sure|Here(?:'s| is))\b[^:]*:\s*/i,
  /^\s*(?:As an AI|Jako (?:model|asystent|AI))[^.]*\.\s*/i,
  /^\s*(?:Odpowied[źz]|Response|Answer)\s*[:\-–—]\s*/i,
]

const HTML_TAG_RE = /<\/?[a-z][^>]*>/gi
const MARKDOWN_CODE_FENCE_RE = /```[\s\S]*?```/g
const MARKDOWN_INLINE_CODE_RE = /`([^`]+)`/g
const MARKDOWN_BOLD_ITALIC_RE = /(\*{1,3}|_{1,3})([^*_]+)\1/g
const ARROW_RE = /\s*(?:->|=>|⇒|→)\s*/g
const BULLET_RE = /^[\s]*[•·▪◦‣⁃]\s+/gm
const MULTI_SPACE_RE = /[ \t]{2,}/g
const MULTI_NEWLINE_RE = /\n{3,}/g
const TRAILING_PUNCT_RE = /[\s,;:–—-]+$/
const LEADING_PUNCT_RE = /^[\s,;:–—-]+/
/**
 * Leading artifact filter — kasuje kropki, cyfry, myślniki, kule i spacje,
 * które LLM generuje przy listowaniu (np. `". Diana…"`, `"1. Jan..."`,
 * `"• Piotr..."`). Stosowany w cleanAuthor i cleanTitle, PRZED dedupem.
 */
const LEADING_ARTIFACT_RE = /^[.\s\-–—\d•·▪◦‣⁃]+/

/** Mapa bezpiecznej typografii (ASCII ↔ unicode, zawsze na „ładne" warianty). */
const TYPOGRAPHY_MAP: Array<[RegExp, string]> = [
  [/\.{3,}/g, '…'],
  [/--/g, '—'],
  [/\s+-\s+/g, ' — '],
  [/"([^"]+)"/g, '\u201E$1\u201D'], // polskie cudzysłowy „ ”
  [/(^|\s)'([^']+?)'(\s|$)/g, '$1\u2018$2\u2019$3'], // ‘ ’
  [/\s+([!?.,;:])/g, '$1'], // spacja przed interpunkcją usunięta
  [/ \u00A0/g, '\u00A0'],
]

function stripLlmPrefixes(input: string): string {
  let out = input
  for (const re of LLM_NOISE_PREFIX_PATTERNS) {
    out = out.replace(re, '')
  }
  return out
}

function stripMarkup(input: string): string {
  return input
    .replace(MARKDOWN_CODE_FENCE_RE, ' ')
    .replace(MARKDOWN_INLINE_CODE_RE, '$1')
    .replace(MARKDOWN_BOLD_ITALIC_RE, '$2')
    .replace(HTML_TAG_RE, ' ')
    .replace(/[<>`]/g, '')
}

function collapseWhitespace(input: string): string {
  return input
    .replace(MULTI_SPACE_RE, ' ')
    .replace(MULTI_NEWLINE_RE, '\n\n')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

/** Usuwa listingowe artefakty LLM z początku (kropki, cyfry, kule, myślniki). */
function stripLeadingArtifacts(input: string): string {
  return input.replace(LEADING_ARTIFACT_RE, '').trim()
}

/** Wymusza wielką literę na pierwszej literze — bezpieczny dla pustego wejścia. */
function capitalizeFirst(input: string): string {
  if (!input) return input
  return input.charAt(0).toUpperCase() + input.slice(1)
}

export class UjverseSanitizer {
  /**
   * Oczyszcza nazwę prowadzącego / autora — usuwa tytuły naukowe, strzałki,
   * markup, normalizuje wielkość liter i spacje. Zwraca string w mianowniku.
   *
   * Przykłady:
   *   "dr hab. Jan Kowalski"     -> "Jan Kowalski"
   *   "Prof. -> Anna Nowak"      -> "Anna Nowak"
   *   "mgr inż. Piotr **Test**"  -> "Piotr Test"
   */
  static cleanAuthor(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return ''
    let out = stripMarkup(raw).replace(ARROW_RE, ' ')
    for (const re of ACADEMIC_TITLE_PATTERNS) {
      out = out.replace(re, ' ')
    }
    out = out
      .replace(LEADING_PUNCT_RE, '')
      .replace(TRAILING_PUNCT_RE, '')
      .replace(MULTI_SPACE_RE, ' ')
      .trim()

    // Leading artifact filter — kasuje ". Diana", "1. Jan", "• Piotr" itp.
    // Uruchamiany przed dedupem, żeby porównanie "X Y X Y" działało też gdy
    // Llama poprzedziła echo kropką listingową.
    let cleanedAuthor = stripLeadingArtifacts(out)

    // GLOBAL DEDUPLICATION PREVENTER
    // LLM bywa zawiesza się w pętli typu "dr Magdalena Zych -> dr Magdalena Zych".
    // Po usunięciu strzałki i tytułów zostaje "X Y X Y" — zwijamy do "X Y".
    // Pętla obsługuje też wielokrotne powtórzenia ("A B A B A B A B" -> "A B").
    for (let guard = 0; guard < 4; guard += 1) {
      const words = cleanedAuthor.split(' ').filter((w) => w.length > 0)
      if (words.length < 2 || words.length % 2 !== 0) break
      const halfLen = words.length / 2
      const firstHalf = words.slice(0, halfLen).join(' ')
      const secondHalf = words.slice(halfLen).join(' ')
      if (firstHalf !== secondHalf) break
      cleanedAuthor = firstHalf
    }

    return capitalizeFirst(UjverseSanitizer.normalizeTypography(cleanedAuthor))
  }

  /**
   * Oczyszcza tytuł (np. tytuł posta / wydarzenia / komunikatu).
   * Taka sama pipelina jak `cleanAuthor` dla leading artifacts + typografia,
   * ale bez strippingu tytułów naukowych (tytuł treści może legalnie zawierać
   * słowo "profesor" w kontekście).
   */
  static cleanTitle(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return ''
    let out = stripMarkup(raw).replace(ARROW_RE, ' ')
    out = collapseWhitespace(out)
    out = stripLeadingArtifacts(out)
    return capitalizeFirst(UjverseSanitizer.normalizeTypography(out))
  }

  /**
   * Oczyszcza ciało wpisu — strzałki LLM, markdown noise, prompt-prefiksy,
   * HTML tagi, nadmiarowe white-space. NIE tłumaczy, NIE zmienia znaczenia.
   */
  static cleanBody(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return ''
    let out = stripLlmPrefixes(raw)
    out = stripMarkup(out)
    out = out.replace(ARROW_RE, ' ')
    out = out.replace(BULLET_RE, '• ')
    out = collapseWhitespace(out)
    return UjverseSanitizer.normalizeTypography(out)
  }

  /**
   * Bezpieczna typografia: polskie cudzysłowy, em-dash, elipsy, usunięcie
   * spacji przed interpunkcją. Nie ingeruje w znaczenie tekstu.
   */
  static normalizeTypography(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return ''
    let out = raw
    for (const [re, replacement] of TYPOGRAPHY_MAP) {
      out = out.replace(re, replacement)
    }
    return out.trim()
  }

  /**
   * Pełna pipelina — jedno wywołanie dla adaptera:
   *   author = cleanAuthor + normalizeTypography (już w środku cleanAuthor)
   *   body   = cleanBody   + normalizeTypography (już w środku cleanBody)
   *   title  = normalizeTypography + collapse whitespace
   */
  static sanitizeContent(input: {
    title?: string | null
    author?: string | null
    body?: string | null
  }): { title: string; author: string; body: string } {
    return {
      title: UjverseSanitizer.cleanTitle(input.title ?? ''),
      author: UjverseSanitizer.cleanAuthor(input.author ?? ''),
      body: UjverseSanitizer.cleanBody(input.body ?? ''),
    }
  }

  /**
   * Normalizacja identyfikatora (slug). Używane przez adaptery dla stabilnych
   * kluczy React i deduplikacji.
   */
  static slugify(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return ''
    return UjverseSanitizer.normalizeTypography(raw)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  /**
   * Normalizacja hashtag-style taga: `marketing` -> `#marketing`, usuwa znaki
   * specjalne, wymusza lower-case.
   */
  static normalizeTag(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return '#inne'
    const cleaned = UjverseSanitizer.normalizeTypography(raw)
      .toLowerCase()
      .replace(/[^a-z0-9#_-]/g, '')
    if (!cleaned) return '#inne'
    return cleaned.startsWith('#') ? cleaned : `#${cleaned}`
  }
}
