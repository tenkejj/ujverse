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

const BYE_PATTERNS: readonly RegExp[] = [/^pa[\s!.?,]*$/i, /^pa pa[\s!.?,]*$/i]

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

const REPLIES: Record<Bucket, string> = {
  greeting:
    'Cześć! Co chcesz sprawdzić na UJ? Możesz zapytać o komunikaty, rejestracje lub wydarzenia.',
  thanks: 'Nie ma za co! Jeśli pojawi się kolejne pytanie, pisz.',
  bye: 'Do zobaczenia!',
  ack: 'Jasne. Jeśli chcesz coś jeszcze sprawdzić, napisz.',
  slang: 'Jestem tutaj. Co chcesz sprawdzić?',
}

/**
 * Zwraca gotową odpowiedź Versusia lub `null` gdy wiadomość nie jest czystym small-talkiem.
 */
export function trySmallTalkReply(userMessage: string): string | null {
  const text = userMessage.trim()
  if (text.length === 0 || text.length > 36) return null

  const bucket = classify(text)
  if (!bucket) return null

  return REPLIES[bucket]
}
