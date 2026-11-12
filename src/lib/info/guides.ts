/** Editorial procedures from official UJ sources; never inferred obligations. */
export type GuideSlug = 'stypendium-rektora' | 'akademik' | 'rejestracje-usos'
export type GuideSource = { id: string; title: string; url: string }
export type GuideStep = {
  id: string
  title: string
  description: string
  sourceIds: readonly string[]
}
export type StudentGuide = {
  slug: GuideSlug
  title: string
  shortTitle: string
  description: string
  academicYear: string
  checkedAt: string
  scope: string
  audience: string
  deadline: string
  prepare: readonly string[]
  steps: readonly GuideStep[]
  status: string
  contact: { text: string; url: string }
  sources: readonly GuideSource[]
  exception?: { text: string; label: string; url: string }
}

export const STUDENT_GUIDES: readonly StudentGuide[] = [
  {
    slug: 'stypendium-rektora',
    title: 'Jak złożyć wniosek o stypendium rektora?',
    shortTitle: 'Stypendium rektora',
    description: 'Od sprawdzenia zasad do potwierdzenia złożenia wniosku.',
    academicYear: '2026/2027',
    checkedAt: '2026-11-11',
    scope: 'Studenci UJ · zasady i kontakt zależne od sytuacji studenta',
    audience:
      'Studenci I i II stopnia oraz jednolitych studiów magisterskich ubiegający się o świadczenie za wyniki lub osiągnięcia. Dla pierwszego roku I stopnia i studiów jednolitych obowiązują odrębne warunki. Sprawdź pełne kryteria, zanim zaczniesz.',
    deadline:
      'UJ wskazuje 20 października jako podstawowy termin. Na rok 2026/2027 już upłynął; źródło opisuje wyjątek dla uprawnionych studentów pierwszego roku I stopnia i studiów jednolitych. Swoją sytuację potwierdź z koordynatorem.',
    prepare: [
      'Dostęp do USOSweb i studenckiej poczty.',
      'Średnią ocen zweryfikowaną w sekretariacie oraz dokumenty osiągnięć, jeśli je zgłaszasz.',
      'Oryginalne pliki dokumentów elektronicznych; czytelne skany dokumentów papierowych. Dokument wielostronicowy w jednym pliku.',
    ],
    steps: [
      {
        id: 'criteria',
        title: 'Sprawdź kryteria i właściwy termin',
        description:
          'Otwórz zasady UJ i porównaj je ze swoją sytuacją, zwłaszcza gdy rozpoczynasz studia albo studiujesz na kolejnym stopniu.',
        sourceIds: ['rector'],
      },
      {
        id: 'documents',
        title: 'Przygotuj i sprawdź dokumenty',
        description:
          'Wyjaśnij rozbieżności średniej z sekretariatem. Dołącz potwierdzenia zgłaszanych osiągnięć przed złożeniem wniosku.',
        sourceIds: ['rector', 'applications'],
      },
      {
        id: 'form',
        title: 'Wypełnij właściwy wniosek w USOSweb',
        description:
          'Zaloguj się i odszukaj wnioski o świadczenia. Wybierz stypendium rektora dla właściwego kierunku i roku akademickiego, a następnie sprawdź dane i załączniki.',
        sourceIds: ['applications', 'usos'],
      },
      {
        id: 'submit',
        title: 'Podpisz i złóż elektronicznie',
        description:
          'Samo zapisanie wersji roboczej nie kończy sprawy. UJ wskazuje funkcję „Podpisz i złóż elektronicznie”; nie wymaga dodatkowego wydruku tak złożonego wniosku.',
        sourceIds: ['applications'],
      },
      {
        id: 'follow-up',
        title: 'Wróć do wniosku i sprawdzaj wiadomości',
        description:
          'Potwierdzenie złożenia i dalszy stan sprawdzaj w USOSweb. Jeśli status lub wymagane uzupełnienie jest niejasne, skontaktuj się z koordynatorem swojego wydziału.',
        sourceIds: ['applications', 'coordinator'],
      },
    ],
    status:
      'Potwierdzenie złożenia i dalszy stan sprawy sprawdzaj w USOSweb. Odhaczenie punktu tutaj nie składa wniosku ani nie potwierdza przyznania stypendium.',
    contact: {
      text: 'Koordynator ds. stypendialnych: USOSweb → Dla studentów → Obsługa. Dział Spraw Stypendialnych wskazuje tę ścieżkę jako pierwszy kontakt.',
      url: 'https://dydaktyka.uj.edu.pl/centrum/dssp',
    },
    sources: [
      {
        id: 'rector',
        title: 'UJ: stypendium rektora — kryteria i termin',
        url: 'https://stypendia.uj.edu.pl/pomoc-materialna/stypendium-rektora',
      },
      {
        id: 'applications',
        title: 'UJ: składanie wniosków o świadczenia',
        url: 'https://stypendia.uj.edu.pl/pomoc-materialna/wnioski',
      },
      {
        id: 'coordinator',
        title: 'Dział Spraw Stypendialnych: właściwy kontakt',
        url: 'https://dydaktyka.uj.edu.pl/centrum/dssp',
      },
      {
        id: 'usos',
        title: 'USOSweb UJ',
        url: 'https://www.usosweb.uj.edu.pl/',
      },
    ],
  },
  {
    slug: 'akademik',
    title: 'Jak ubiegać się o miejsce w akademiku?',
    shortTitle: 'Akademik',
    description: 'Właściwy nabór, wniosek i czynności po otrzymaniu miejsca.',
    academicYear: '2026/2027',
    checkedAt: '2026-11-11',
    scope: 'Akademiki UJ poza Collegium Medicum',
    audience:
      'Studenci ubiegający się o miejsce w domach studenckich UJ poza CM. Harmonogram rozróżnia grupy wnioskodawców; nie wybieraj formularza tylko na podstawie tego poradnika.',
    deadline:
      'Na stronie UJ nabór w trakcie roku 2026/2027 jest opisany od 15 września 2026 r., w miarę wolnych miejsc. Nabory i opłaty mają własne terminy. Sprawdź aktualny harmonogram dla swojej grupy.',
    prepare: [
      'Dostęp do USOSweb i poczty studenckiej.',
      'Preferowaną kolejność akademików i typów pokoi.',
      'Informacje i dokumenty wymagane w wybranym formularzu, w tym dotyczące dochodu, jeśli go wykazujesz.',
    ],
    steps: [
      {
        id: 'round',
        title: 'Wybierz nabór dla swojej grupy',
        description:
          'Sprawdź harmonogram: inne ścieżki mogą dotyczyć osób rozpoczynających studia, kontynuujących je, cudzoziemców i doktorantów. CM ma osobną procedurę.',
        sourceIds: ['schedule', 'housing'],
      },
      {
        id: 'form',
        title: 'Otwórz właściwy formularz',
        description:
          'W USOSweb przejdź do Dla wszystkich → Wnioski. Wybierz odpowiedni wniosek o miejsce w domu studenckim.',
        sourceIds: ['application', 'during-year'],
      },
      {
        id: 'preferences',
        title: 'Uzupełnij dane i preferencje',
        description:
          'Uszereguj akademiki i rodzaje pokoi. Dodaj dokumenty wymagane w Twojej ścieżce i dokończ rejestrację wniosku.',
        sourceIds: ['application'],
      },
      {
        id: 'verification',
        title: 'Sprawdzaj uwagi do wniosku',
        description:
          'Status i uwagi znajdziesz w szczegółach USOSweb. UJ może cofnąć wniosek do poprawy i wysłać wiadomość na pocztę studencką.',
        sourceIds: ['application'],
      },
      {
        id: 'allocation',
        title: 'Po przyznaniu miejsca sprawdź opłatę i skierowanie',
        description:
          'Odczytaj termin opłaty rezerwacyjnej, rachunek przekazany przez administrację oraz ważność skierowania. Niedotrzymanie terminu opłaty może oznaczać utratę miejsca.',
        sourceIds: ['allocation'],
      },
    ],
    status:
      'Miejsce i dalsze czynności sprawdzaj w szczegółach wniosku. Ta lista nie rezerwuje pokoju, nie wykonuje przelewu i nie zastępuje potwierdzenia w USOSweb.',
    contact: {
      text: 'Sprawy wniosku: Dział Spraw Stypendialnych i właściwa komisja wskazana w naborze. Po przyznaniu miejsca: administracja konkretnego domu studenckiego.',
      url: 'https://akademiki.uj.edu.pl/kontakt',
    },
    exception: {
      text: 'Studiujesz w Collegium Medicum? Powyższy harmonogram Cię nie obejmuje. Otwórz osobne zasady CM wskazane przez oficjalny serwis akademików UJ.',
      label: 'Akademiki Collegium Medicum',
      url: 'https://sdka.cm.uj.edu.pl/pl/akademiki/',
    },
    sources: [
      {
        id: 'housing',
        title: 'UJ: domy studenckie i ścieżki wnioskowania',
        url: 'https://akademiki.uj.edu.pl/',
      },
      {
        id: 'application',
        title: 'UJ: jak aplikować o akademik',
        url: 'https://akademiki.uj.edu.pl/studenci/aplikacja',
      },
      {
        id: 'schedule',
        title: 'UJ: harmonogram 2026/2027',
        url: 'https://akademiki.uj.edu.pl/studenci/harmonogram',
      },
      {
        id: 'during-year',
        title: 'UJ: aplikowanie w trakcie roku',
        url: 'https://akademiki.uj.edu.pl/studenci/aplikacja-srodroczna',
      },
      {
        id: 'allocation',
        title: 'UJ: czynności po przyznaniu miejsca',
        url: 'https://akademiki.uj.edu.pl/studenci/wyniki',
      },
    ],
  },
  {
    slug: 'rejestracje-usos',
    title: 'Jak zapisać się na przedmioty w USOSweb?',
    shortTitle: 'Rejestracje USOS',
    description: 'Znajdź swoją turę, sprawdź wynik zapisu i podpięcia.',
    academicYear: '2026/2027',
    checkedAt: '2026-11-11',
    scope: 'Studenci UJ · właściwe tury i zasady ustala jednostka',
    audience:
      'Studenci zapisujący się na przedmioty lub grupy. Sam wybór wydziału w UJverse nie oznacza uprawnienia do każdej rejestracji tej jednostki.',
    deadline:
      'Nie ma jednego terminu dla całego UJ. Datę otwarcia, zamknięcia i kolejne etapy sprawdź w konkretnej turze USOSweb oraz komunikatach swojej jednostki.',
    prepare: [
      'Działające konto USOSweb i właściwy program studiów.',
      'Program zajęć oraz listę potrzebnych przedmiotów i grup.',
      'Nazwę lub kod swojej rejestracji i jej harmonogram.',
    ],
    steps: [
      {
        id: 'find',
        title: 'Znajdź rejestrację, która Cię dotyczy',
        description:
          'Po zalogowaniu sprawdź Dla studentów → Rejestracje. Publiczny kalendarz pokazuje też inne jednostki; dostęp studenta wynika z jego uprawnień w USOS.',
        sourceIds: ['registrations'],
      },
      {
        id: 'rules',
        title: 'Sprawdź typ i etapy zapisów',
        description:
          'Rejestracja może być bezpośrednia, dwuetapowa lub żetonowa. Przeczytaj instrukcję i harmonogram swojej tury, zanim wybierzesz przedmioty lub grupy.',
        sourceIds: ['registrations'],
      },
      {
        id: 'enrol',
        title: 'Zapisz się w swojej turze',
        description:
          'Wykonaj czynności dostępne w USOSweb zgodnie z zasadami tury. Złożenie preferencji przy zapisach dwuetapowych nie jest tym samym co otrzymanie konkretnej grupy.',
        sourceIds: ['registrations'],
      },
      {
        id: 'result',
        title: 'Sprawdź wynik i następny etap',
        description:
          'Wróć do rejestracji po rozdzieleniu grup lub zakończeniu etapu. Jeśli właściwej rejestracji brakuje na Twoim koncie, zapytaj sekretariat obsługujący USOS.',
        sourceIds: ['registrations'],
      },
      {
        id: 'attach',
        title: 'Sprawdź podpięcie przedmiotu',
        description:
          'USOSownia zaleca podpinanie przedmiotów na bieżąco. Rodzaj podpięcia i terminy zależą od programu oraz aktualnych zasad; wątpliwości wyjaśnij w sekretariacie.',
        sourceIds: ['attachments'],
      },
    ],
    status:
      'Wynik zapisu, przydział grupy i podpięcie potwierdza USOSweb. Odhaczenie czynności tutaj nie zapisuje Cię na przedmiot.',
    contact: {
      text: 'Sekretariat lub dziekanat jednostki obsługującej Twoje studia i USOS. Jeśli nie widzisz właściwej rejestracji, zgłoś tam jej nazwę lub kod.',
      url: 'https://www.usosweb.uj.edu.pl/',
    },
    sources: [
      {
        id: 'registrations',
        title: 'USOSownia UJ: rejestracje i dostęp do tur',
        url: 'https://usosownia.uj.edu.pl/usosweb/dla-studentow/rejestracje',
      },
      {
        id: 'attachments',
        title: 'USOSownia UJ: podpięcia',
        url: 'https://usosownia.uj.edu.pl/podpiecia',
      },
    ],
  },
]

export const STUDENT_SUPPORT_RESOURCES = [
  {
    id: 'first-year',
    title: 'Pierwsze kroki na UJ',
    description: 'Oficjalny przewodnik dla osób rozpoczynających studia.',
    url: 'https://rekrutacja.uj.edu.pl/studia-i-stopnia/witaj-na-i-roku',
  },
  {
    id: 'stay',
    title: 'Stay With UJ',
    description: 'Uczelniany projekt wsparcia i przewodnik adaptacyjny.',
    url: 'https://staywithuj.uj.edu.pl/',
  },
  {
    id: 'sowa',
    title: 'Wsparcie psychologiczne SOWA',
    description: 'Sprawdź, jak umówić konsultację z zespołem UJ.',
    url: 'https://sowa.uj.edu.pl/skontaktujsieznami',
  },
] as const

export function findStudentGuide(
  slug: string | null | undefined,
): StudentGuide | undefined {
  return STUDENT_GUIDES.find((guide) => guide.slug === slug)
}

/** This marks editorial source review, never a new read of USOS or official endorsement. */
export function needsGuideReview(
  guide: Pick<StudentGuide, 'checkedAt'>,
  now = new Date(),
): boolean {
  const checked = Date.parse(`${guide.checkedAt}T00:00:00Z`)
  const age = now.getTime() - checked
  return !Number.isFinite(age) || age < -86_400_000 || age > 90 * 86_400_000
}

export type GuideProgress = Partial<Record<GuideSlug, string[]>>
export const GUIDE_PROGRESS_KEY = 'ujverse.guides.v1'

/** Accept only current editorial step ids; no account or application data is stored. */
export function parseGuideProgress(raw: string | null): GuideProgress {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const result: GuideProgress = {}
    for (const guide of STUDENT_GUIDES) {
      const steps = (value as Record<string, unknown>)[guide.slug]
      if (!Array.isArray(steps)) continue
      const valid = new Set(guide.steps.map((step) => step.id))
      result[guide.slug] = [
        ...new Set(
          steps.filter(
            (step): step is string =>
              typeof step === 'string' && valid.has(step),
          ),
        ),
      ]
    }
    return result
  } catch {
    return {}
  }
}
