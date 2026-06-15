/**
 * Welcome Opener — dynamiczny lead na empty state'cie czatu (`ChatHubView`,
 * `ChatAssistant`, `ChatAssistantFab`).
 *
 * Filozofia: zamiast statycznego „Witaj, Franek. W czym mogę dziś pomóc?"
 * (które po dwóch dniach brzmi jak voicemail), generujemy parę
 * (`headline`, `subline`) zależną od:
 *  - pory dnia (rano/przed południem/popołudnie/wieczór/późno)
 *  - dnia tygodnia (weekend vs roboczy)
 *  - imienia (jeśli mamy)
 *
 * Czysto klient-side. Zero LLM, zero round-tripa. Random pick w obrębie
 * bucketu daje wariancję między wejściami — user co rano widzi inną
 * formę „dzień dobry", a nie jednego klona.
 *
 * Polityka tonu: jak persona Versusia — luźno, na ty, czasem z dystansem.
 * Nie używamy „W czym mogę dziś pomóc" (korpo). Wolimy „Co tam u Ciebie?",
 * „Czego dziś szukasz?", „Co jedziemy?".
 */

export type WelcomeOpener = {
  headline: string
  subline: string
}

type DayBucket = 'workday' | 'weekend'
type TimeBucket = 'morning' | 'forenoon' | 'afternoon' | 'evening' | 'night'

/**
 * Granice czasowe dopasowane do rytmu studenta UJ:
 *  - 5-10 = morning (przed wykładami)
 *  - 10-13 = forenoon
 *  - 13-17 = afternoon
 *  - 17-22 = evening
 *  - 22-5  = night (też wlicza wczesny ranek przed 5)
 */
function timeBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 13) return 'forenoon'
  if (hour >= 13 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

function dayBucket(dayOfWeek: number): DayBucket {
  return dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : 'workday'
}

/**
 * Headline'y per czas + zwrot do imienia. Każda lista 3-4 wariantów dla
 * naturalnej rotacji. „{name}" placeholder podmieniany 1:1; gdy brak
 * imienia — zwrot bez niego (gracefully degraduje do neutralnego).
 */
const HEADLINES: Record<TimeBucket, readonly string[]> = {
  morning: [
    'Dzień dobry{nameComma}',
    'Cześć{nameComma}',
    'Hej{nameComma}',
  ],
  forenoon: [
    'Cześć{nameComma}',
    'Hej{nameComma}',
    'Witaj{nameComma}',
  ],
  afternoon: [
    'Cześć{nameComma}',
    'Hej{nameComma}',
    'Siema{nameComma}',
  ],
  evening: [
    'Dobry wieczór{nameComma}',
    'Cześć{nameComma}',
    'Hej{nameComma}',
    'Siema{nameComma}',
  ],
  night: [
    'Hej{nameComma}',
    'Cześć{nameComma}',
    'Czuwasz?',
  ],
}

/**
 * Sublines per (day, time) bucket. Workday = ton akcji (sprawdź, lecimy);
 * weekend = ton luzu. Wieczór z każdym dniem nieco luźniejszy.
 */
const SUBLINES: Record<`${DayBucket}:${TimeBucket}`, readonly string[]> = {
  'workday:morning': [
    'Co dziś jedziesz? Jakieś zajęcia, ogłoszenia, czy szukasz czegoś konkretnego?',
    'Co tam na dziś? Mogę sprawdzić plan, ogłoszenia albo zniżki.',
    'Jak wygląda Twój dzień? Pomogę ogarnąć plan i sprawy z UJ.',
  ],
  'workday:forenoon': [
    'Co tam u Ciebie? W czym mogę pomóc.',
    'Czego dziś szukasz? Plan, ogłoszenia, wydarzenia, zniżki — wybieraj.',
    'O co chodzi? Powiedz, a pokombinuję.',
  ],
  'workday:afternoon': [
    'Co tam? Pokażę zniżki na lunch albo sprawdzę co jeszcze masz dziś.',
    'Co potrzebujesz? Plan, ogłoszenia, jakieś wydarzenie?',
    'Jak idzie? Mogę pomóc z czymś z uczelni albo z miastem.',
  ],
  'workday:evening': [
    'Co planujesz? Mogę pokazać co się dzieje wieczorem albo zniżki.',
    'Wieczór, czas na wytchnienie. Coś znaleźć — wydarzenie, knajpę?',
    'Jak idzie? Sprawdzę co tam się dzieje albo plan na jutro.',
  ],
  'workday:night': [
    'Wciąż w robocie? Mów, w czym pomóc.',
    'Późno już, ale jak coś trzeba ogarnąć — jestem.',
    'O co chodzi? Plan, ogłoszenia, cokolwiek.',
  ],
  'weekend:morning': [
    'Weekend i wstałeś — szacun. Co planujesz?',
    'Sobota/niedziela rano. Coś znaleźć w mieście, czy luzik?',
    'Co jedziemy? Zniżki, wydarzenia, plan na poniedziałek?',
  ],
  'weekend:forenoon': [
    'Weekend, więc luźno. Coś szukasz w mieście?',
    'Co planujesz? Pokażę co się dzieje albo gdzie tani obiad.',
    'O co chodzi? Mogę podrzucić wydarzenie albo zniżkę.',
  ],
  'weekend:afternoon': [
    'Co tam u Ciebie? Coś znaleźć — wydarzenie, knajpę, plan?',
    'Jak weekend? Pokażę zniżki na obiad albo co się dzieje wieczorem.',
    'Co jedziemy? Mów, a pokombinuję.',
  ],
  'weekend:evening': [
    'Wieczór, weekend — co robimy? Mogę znaleźć imprezę albo knajpę.',
    'Co planujesz? Pokażę co się dzieje w mieście.',
    'Idziesz gdzieś czy tylko zniżki na pizzę?',
  ],
  'weekend:night': [
    'Późny weekend. Co potrzebujesz?',
    'Jeszcze coś szukasz? Mów, ogarnę.',
    'O co chodzi? Mogę szybko coś sprawdzić.',
  ],
}

function pickRandom<T>(arr: readonly T[]): T {
  const idx = Math.floor(Math.random() * arr.length)
  return arr[idx]!
}

/**
 * Wyciąga pierwsze imię z `displayName` ("Franciszek Kowalski" → "Franciszek").
 * Pusty input → empty string.
 */
function firstName(displayName: string | undefined | null): string {
  if (!displayName) return ''
  const trimmed = displayName.trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0] ?? ''
}

/**
 * Buduje powitanie dla aktualnej chwili. Pure function — rzucona losowo,
 * ale deterministycznie w ramach jednego renderu (caller użyje `useMemo`).
 *
 * Bezpieczne dla SSR — `new Date()` po stronie klienta da właściwą porę.
 *
 * @param displayName — pełna nazwa usera (z `myProfile.full_name` lub
 *   sesji); jeśli pusta, headlines bez „, imię".
 * @param now — opcjonalny override timestampu (testowanie). Domyślnie `Date.now()`.
 */
export function buildWelcomeOpener(
  displayName: string | undefined | null,
  now: Date = new Date(),
): WelcomeOpener {
  const name = firstName(displayName)
  const tBucket = timeBucket(now.getHours())
  const dBucket = dayBucket(now.getDay())

  const headlineTemplate = pickRandom(HEADLINES[tBucket])
  const subline = pickRandom(SUBLINES[`${dBucket}:${tBucket}`])

  const headline = headlineTemplate
    .replace('{nameComma}', name ? `, ${name}` : '')
    .replace('{name}', name)
    .trim()

  return {
    headline: headline.endsWith('?') || headline.endsWith('.') ? headline : `${headline}.`,
    subline,
  }
}
