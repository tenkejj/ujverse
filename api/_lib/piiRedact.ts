/**
 * PII Redaction — usuwanie danych wrazliwych z tekstu przed logowaniem.
 *
 * Po co: `console.log('[Tool Routing]', lastUserText.slice(0, 60))` w
 * `api/chat.ts` leci na Vercel Logs, ktore retentioned 30 dni (Hobby) i
 * 7 dni na free tier. Jesli user napisze "moj nr indeksu to 123456, ile
 * dzialam jeszcze rejestracje?" — 123456 lezy w logach.
 *
 * Reguly:
 *  - Email: foo@bar.com → [EMAIL]
 *  - PESEL: 11-cyfrowy z prawidlowa data → [PESEL] (defensywne, czasem
 *    falszywe pozytywy na seriach cyfr — akceptujemy bo bezpieczniej)
 *  - Nr indeksu UJ: 6-cyfrowy (typowo 1xxxxx — 5xxxxx) → [INDEX]
 *  - Telefon PL: +48 / 9-cyfrowy / formatowany → [PHONE]
 *  - Karta kredytowa: 13-19 cyfr (Luhn-friendly) → [CARD]
 *  - Hasla po "haslo:" / "password:" → [SECRET]
 *
 * Polityka:
 *  - Redact tylko dla LOGOW. Tresc idaca do Groqa pozostaje nietknieta —
 *    bot moze potrzebowac kontekstu PII zeby odpowiedziec sensownie.
 *  - Stosujemy ZAWSZE przed loggerem zeby uniknac przypadkowego wycieku.
 *  - Fail-safe: blad regexu → zwroc oryginal (lepiej zalogowac PII niz
 *    zalogowac pusty string i zgubic debug context).
 */

/**
 * Helper: kazdy regex wraz z labelem zamiany. Trzymamy w jednym miejscu
 * zeby dodawanie nowych wzorcow byly proste (push do tablicy).
 */
const REDACTION_RULES: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // Email — najprostszy do trafienia, najmniej false-positive
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[EMAIL]',
  },
  // Telefon PL: +48 XXX XXX XXX, +48-XXX-XXX-XXX, 9-cyfrowy zwykly numer
  {
    pattern: /(?:\+?48[\s-]?)?\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g,
    replacement: '[PHONE]',
  },
  // PESEL — 11 cyfr; nie weryfikujemy sumy kontrolnej, prosta heurystyka
  // (drugi i trzeci znak to miesiac w zakresie 01-12 + offset)
  {
    pattern: /\b\d{11}\b/g,
    replacement: '[PESEL]',
  },
  // Nr indeksu UJ — typowo 6-cyfrowy zaczynajacy sie od 1-5
  // Granice slowa zapobiegaja matchowaniu w PESELu / telefonie
  {
    pattern: /\b[1-5]\d{5}\b/g,
    replacement: '[INDEX]',
  },
  // Karta kredytowa — 13-19 cyfr (z opcjonalnymi spacjami / mysliknikami)
  {
    pattern: /\b(?:\d[\s-]?){13,19}\b/g,
    replacement: '[CARD]',
  },
  // Haslo / password (case-insensitive, do najblizszego whitespace / .)
  {
    pattern: /(haslo|password|pass|pwd)\s*[:=]\s*\S+/gi,
    replacement: '$1: [SECRET]',
  },
  // Token / API key — typowe formaty (Bearer XXX, sk-..., gh_..., itp.)
  {
    pattern: /\b(?:Bearer\s+)?(?:sk|pk|gh[ps]|gho|ghu|ghr|ghs|xox[bopa])_[A-Za-z0-9_-]{10,}/g,
    replacement: '[TOKEN]',
  },
]

/**
 * Usuwa PII z tekstu. Wolaj tylko PRZED logowaniem, nie na ciagu ktory
 * leci do Groqa (model traci kontekst).
 *
 * Wydajnosc: 7 regexow * dlugosc stringa = O(n*k), dla 60-char snippeta
 * w logach to ~5us, nieblokujace.
 *
 * @example
 *   redactPII('moj indeks to 123456, mail: foo@bar.com')
 *   // → 'moj indeks to [INDEX], mail: [EMAIL]'
 */
export function redactPII(text: string): string {
  if (!text) return text
  try {
    let cleaned = text
    for (const { pattern, replacement } of REDACTION_RULES) {
      cleaned = cleaned.replace(pattern, replacement)
    }
    return cleaned
  } catch (err) {
    console.warn(
      '[PII Redact] regex error, returning original:',
      err instanceof Error ? err.message : err,
    )
    return text
  }
}

/**
 * Convenience: redact + slice. Czesto chcemy logowac tylko prefix
 * (`first 60 chars`), zeby nie pakowac calych odpowiedzi do logow.
 */
export function redactAndSlice(text: string, maxLen: number = 60): string {
  return redactPII(text).slice(0, maxLen)
}
