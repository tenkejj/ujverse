/**
 * Troll Handler — pre-LLM detector na bluzgi/zaczepki/troll-input.
 *
 * Po co: gdy user wali „spierdalaj" / „debil jesteś" / „kurwa", default flow
 * to:
 *   1. Tool decision do Groqa (zmarnowane ~1k tokenów, model i tak nic nie
 *      wybierze)
 *   2. Synthesis z surowymi faktami albo fallback do generic message
 *   3. Czasem 429 bo zmarnowaliśmy budżet RPM
 *
 * Lepiej: złapać te wiadomości regexem PRZED dotknięciem Groqa i odpowiedzieć
 * z pre-baked rotacji witty come-back'ów. Versuś nie obraża się, nie pyskuje
 * (politycznie poprawne), ale ma dystans i nie traktuje siebie zbyt
 * poważnie. Jak kumpel co odbiera „spierdalaj" jako żart i jedzie dalej.
 *
 * Polityka:
 *  - Detector celowo SZEROKI — wolimy false-positive (żart przeszedł jako
 *    bluzg) niż false-negative (bluzg poszedł do Groqa). Edge case typu
 *    „cytat z piosenki" jest akceptowalny.
 *  - Nie obrażamy w odwrocie. Nie używamy bluzgów. Dystans, nie atak.
 *  - Rotacja losowa → dwa „spierdalaj" pod rząd dają różne odpowiedzi.
 *  - Brak wpływu na rate-limit / circuit breaker → nie liczymy tego jako
 *    Groq call (bo nim nie jest).
 *
 * Zysk per troll-message:
 *  - 0 tokenów Groqa (~1300 saved)
 *  - 0 quota użyte (free tier breathing room)
 *  - Latency: ~5ms vs ~1500ms (pure regex match + random pick)
 *  - Lepsze UX: kumpelska reakcja zamiast „System przeciążony"
 */

/**
 * Lista regexów łapiących typowe formy. Celowo non-exhaustive — szukamy
 * intent „atak/zaczepka", nie pełnej listy słów.
 *
 * `\b` granice słowa zapobiegają matchowaniu w środku innych słów
 * (np. „skurwysyn" matchuje, ale „kurwilenia" — fikcyjne — nie). Dla
 * polskich diakrytyków regex `\b` działa OK w Node 20 (Unicode).
 */
const INSULT_PATTERNS: readonly RegExp[] = [
  /\b(spierdal|spierdol|wypierd|odwal\s*si[ęe]|odpierdol)/i,
  /\b(kurw[ay]|kurwo|skurwys|chuj|pierdol|jeba[ćc]|jebany|jebana)/i,
  /\b(debil|kretyn|idiota|matol|gnoj|gnój|frajer|cwel)/i,
  /\b(do\s*dupy|gówn|gowno|nienawidz[ęe]\s*ci[ęe])/i,
  /\b(bot\s*jest[\s\w]*beznadziejny|bezuzyteczn|do\s*niczego)/i,
]

/**
 * Pre-baked come-back'i. Versuś z dystansem — nie obraża się, nie odpyskuje
 * w tym samym tonie, ale ma luźną odpowiedź i prosi o konkret. Wszystkie
 * krótkie — to ma być beka, nie wykład.
 */
const COMEBACKS: readonly string[] = [
  'Też cię lubię. Na czym kończyliśmy?',
  'Spoko, każdemu wolno mieć gorszy dzień. Mówisz, jak mogę pomóc?',
  'Heh, zostawmy ten fragment dla siebie. Czego potrzebujesz?',
  'Dzięki za feedback. Coś konkretnego mam sprawdzić?',
  'Twoja prawda. Gadamy o czymś, czy lecimy z tematem dalej?',
  'Notuję, oddaję do działu skarg. W międzyczasie — w czym mogę pomóc?',
  'Zaakceptowane. Co tam u Ciebie, jakieś zniżki, ogłoszenia, plan na dziś?',
  'OK, tłumaczy to wiele. Wracamy do roboty — czego szukasz?',
]

export type TrollDetectionResult =
  | { detected: true; comeback: string; matched: string }
  | { detected: false }

/**
 * Sprawdza czy wiadomość pasuje do wzorca bluzgu/troll-input.
 * Zwraca losowy come-back z rotacji albo `{ detected: false }`.
 *
 * Edge case: wiadomość zawiera bluzg + sensowne pytanie („spierdalaj, ale
 * powiedz mi gdzie kebab"). Obecnie też wpada w come-back. Świadoma
 * decyzja — skala usera < skala benefitu z prostoty i braku Groq calla.
 * Można zrefaktorować na „strip + retry" jak będzie potrzeba.
 */
export function detectTroll(userMessage: string): TrollDetectionResult {
  const text = userMessage.trim()
  if (!text) return { detected: false }
  // Bardzo krótkie (≤2 znaki) NIE traktujemy jako troll nawet gdy regex
  // by trafił — np. „g" / „k" same w sobie nic nie znaczą.
  if (text.length <= 2) return { detected: false }

  for (const pattern of INSULT_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const idx = Math.floor(Math.random() * COMEBACKS.length)
      return {
        detected: true,
        comeback: COMEBACKS[idx] ?? COMEBACKS[0]!,
        matched: match[0],
      }
    }
  }
  return { detected: false }
}
