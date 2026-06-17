/**
 * Small-Talk Reply — zero-tokenowe odpowiedzi na czyste przywitania / podziękowania.
 *
 * Gdy `shouldUseTools()` zwraca false, zamiast wołać Llamę 8B (small-talk path)
 * odpowiadamy z rotacji pre-baked tekstów w tonie Versusia. Oszczędność:
 * ~800–1200 tok input + ~50–150 tok output per „cześć" / „dzięki".
 */

type Bucket = 'greeting' | 'thanks' | 'bye' | 'ack' | 'slang'

const GREETING_PATTERNS: readonly RegExp[] = [
  /^cześć[\s!.?,]*$/i,
  /^cześć wam[\s!.?,]*$/i,
  /^hej[\s!.?,]*$/i,
  /^siema[\s!.?,]*$/i,
  /^witaj[\s!.?,]*$/i,
  /^witam[\s!.?,]*$/i,
  /^dzień dobry[\s!.?,]*$/i,
  /^dobry wieczór[\s!.?,]*$/i,
  /^dobranoc[\s!.?,]*$/i,
  /^hi[\s!.?,]*$/i,
  /^hello[\s!.?,]*$/i,
  /^hey[\s!.?,]*$/i,
  /^yo[\s!.?,]*$/i,
  /^elo[\s!.?,]*$/i,
  /^halo[\s!.?,]*$/i,
]

const THANKS_PATTERNS: readonly RegExp[] = [
  /^dzięki[\s!.?,]*$/i,
  /^dziękuję[\s!.?,]*$/i,
  /^dziekuje[\s!.?,]*$/i,
  /^thanks[\s!.?,]*$/i,
  /^thank you[\s!.?,]*$/i,
]

const BYE_PATTERNS: readonly RegExp[] = [
  /^pa[\s!.?,]*$/i,
  /^pa pa[\s!.?,]*$/i,
]

const ACK_PATTERNS: readonly RegExp[] = [
  /^ok[\s!.?,]*$/i,
  /^okej[\s!.?,]*$/i,
  /^okay[\s!.?,]*$/i,
  /^tak[\s!.?,]*$/i,
  /^nie[\s!.?,]*$/i,
  /^spoko[\s!.?,]*$/i,
  /^dobra[\s!.?,]*$/i,
  /^git[\s!.?,]*$/i,
  /^fair[\s!.?,]*$/i,
  /^aha[\s!.?,]*$/i,
  /^no[\s!.?,]*$/i,
]

const SLANG_PATTERNS: readonly RegExp[] = [
  /^test[\s!.?,]*$/i,
  /^aight\s*bet[\s!.?,]*$/i,
  /^bet[\s!.?,]*$/i,
  /^lol[\s!.?,]*$/i,
  /^haha[\s!.?,]*$/i,
  /^nice[\s!.?,]*$/i,
  /^cool[\s!.?,]*$/i,
  /^z dupy[\s!.?,]*$/i,
]

function classify(text: string): Bucket | null {
  for (const p of GREETING_PATTERNS) if (p.test(text)) return 'greeting'
  for (const p of THANKS_PATTERNS) if (p.test(text)) return 'thanks'
  for (const p of BYE_PATTERNS) if (p.test(text)) return 'bye'
  for (const p of ACK_PATTERNS) if (p.test(text)) return 'ack'
  for (const p of SLANG_PATTERNS) if (p.test(text)) return 'slang'
  return null
}

function partOfDay(hour: number): 'morning' | 'day' | 'evening' | 'night' {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 18) return 'day'
  if (hour >= 18 && hour < 23) return 'evening'
  return 'night'
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

const GREETINGS: Record<ReturnType<typeof partOfDay>, readonly string[]> = {
  morning: [
    'Dzień dobry! Versuś tu — plan na dziś, ogłoszenia, zniżki — mów co ogarnąć.',
    'Hej, rano już w robocie? Mogę sprawdzić plan albo co nowego z ISI.',
    'Cześć! Strzelaj pytaniem albo /plan jeśli chcesz od razu w temat.',
  ],
  day: [
    'Hej! Versuś na służbie — zajęcia, feed, wydarzenia, zniżki. Co sprawdzamy?',
    'Siema! Pisz normalnie albo slash — /zniski, /oglosznia, /feed.',
    'Cześć! Co tam — plan, ogłoszenia, coś z miasta?',
  ],
  evening: [
    'Hej! Wieczór, ale działam — wydarzenia, zniżki na kolację, plan na jutro.',
    'Cześć! Versuś tu. Coś znaleźć na wieczór albo ogarnąć jutrzejszy plan?',
    'Siema! Strzelaj — sprawdzę co siedzi w bazie.',
  ],
  night: [
    'Hej, późno już — ale jak coś trzeba, ogarnę plan albo ogłoszenia.',
    'Czuwasz? Versuś tu. Mów, co sprawdzić.',
    'Cześć nocna! Plan, ogłoszenia, cokolwiek — jestem.',
  ],
}

const THANKS: readonly string[] = [
  'Spoko! Jak coś jeszcze — pisz.',
  'Nie ma sprawy. Wracaj jak trzeba.',
  'Jasne. Versuś tu jak będziesz potrzebować.',
  'Luz. Do zobaczenia przy następnym pytaniu.',
]

const BYE: readonly string[] = [
  'Pa! Jak coś — wiesz gdzie mnie znaleźć.',
  'Na razie! Versuś będzie tu jak wrócisz.',
  'Trzymaj się — wracaj z pytaniami.',
]

const ACK: readonly string[] = [
  'OK. Co dalej — plan, zniżki, ogłoszenia?',
  'Spoko. Strzelaj jak masz kolejne pytanie.',
  'Jasne. Versuś czeka na następny temat.',
  'Git. Jak coś — pisz.',
]

const SLANG: readonly string[] = [
  'Heh, fair. Coś konkretnego sprawdzamy?',
  'No spoko. Jak masz pytanie z UJ — lecę do bazy.',
  'Versuś tu, nie bot od small-talku. Plan, zniżki, ogłoszenia?',
  'OK OK. Strzelaj tematem jak chcesz coś ogarnąć.',
]

/**
 * Zwraca gotową odpowiedź Versusia lub `null` gdy wiadomość nie jest czystym small-talkiem.
 */
export function trySmallTalkReply(userMessage: string): string | null {
  const text = userMessage.trim()
  if (text.length === 0 || text.length > 36) return null

  const bucket = classify(text)
  if (!bucket) return null

  if (bucket === 'greeting') {
    const pod = partOfDay(new Date().getHours())
    return pick(GREETINGS[pod])
  }
  if (bucket === 'thanks') return pick(THANKS)
  if (bucket === 'bye') return pick(BYE)
  if (bucket === 'ack') return pick(ACK)
  return pick(SLANG)
}
