/** Editorial procedures from official UJ sources; never inferred obligations. */
export type GuideSlug =
  | 'stypendium-rektora'
  | 'akademik'
  | 'rejestracje-usos'
  | 'stypendium-socjalne'
  | 'zapomoga'
  | 'mlegitymacja'
  | 'wsparcie-psychologiczne'
  | 'dostosowanie-studiowania'
  | 'biblioteka-jagiellonska'
export type GuideCategory = 'finanse' | 'studia' | 'codziennosc' | 'wsparcie'
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
  category?: GuideCategory
  quickFacts?: readonly string[]
  primaryAction?: { label: string; url: string }
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
    category: 'finanse',
    quickFacts: ['Podstawowy termin już upłynął', 'Sprawdź wyjątki dla I roku', 'Wniosek w USOSweb'],
    primaryAction: {
      label: 'Sprawdź zasady stypendium',
      url: 'https://stypendia.uj.edu.pl/pomoc-materialna/stypendium-rektora',
    },
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
    category: 'codziennosc',
    quickFacts: ['Wybierz właściwy nabór', 'Ustaw preferencje pokoi', 'Osobne zasady CM'],
    primaryAction: {
      label: 'Sprawdź aktualny nabór',
      url: 'https://akademiki.uj.edu.pl/studenci/harmonogram',
    },
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
    category: 'studia',
    quickFacts: ['Terminy zależą od tury', 'Sprawdź przydział grupy', 'Potwierdź podpięcie'],
    primaryAction: {
      label: 'Przejdź do USOSweb',
      url: 'https://www.usosweb.uj.edu.pl/',
    },
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
  {
    slug: 'stypendium-socjalne',
    title: 'Jak ubiegać się o stypendium socjalne?',
    shortTitle: 'Stypendium socjalne',
    description: 'Sprawdź warunki, przygotuj dokumenty dochodowe i złóż wniosek.',
    category: 'finanse',
    quickFacts: ['Dochód rodziny', 'Wniosek na semestr', 'Termin zimowy już upłynął'],
    primaryAction: {
      label: 'Sprawdź warunki i dokumenty',
      url: 'https://stypendia.uj.edu.pl/pomoc-materialna/stypendium-socjalne',
    },
    academicYear: '2026/2027',
    checkedAt: '2026-11-12',
    scope: 'Studenci UJ · indywidualna ocena sytuacji materialnej',
    audience:
      'Osoby studiujące w trudnej sytuacji materialnej. Sprawdź aktualny próg dochodu, zasady ustalania rodziny i pozostałe warunki. Sam niski dochód nie rozstrzyga wszystkich uprawnień.',
    deadline:
      'UJ podaje 30 września dla semestru zimowego i 31 stycznia dla letniego. Podstawowy termin zimowy 2026/2027 już upłynął. Jeśli składasz później, ustal z koordynatorem, co to oznacza w Twojej sytuacji.',
    prepare: [
      'Dostęp do USOSweb i poczty studenckiej.',
      'Dokumenty dochodów i sytuacji rodziny wymagane w Twoim przypadku.',
      'Oryginały dokumentów elektronicznych lub czytelne skany dokumentów papierowych.',
    ],
    steps: [
      {
        id: 'conditions',
        title: 'Sprawdź warunki i termin',
        description: 'Porównaj swoją sytuację z aktualnymi zasadami UJ. Nietypowy dochód lub skład rodziny wyjaśnij z koordynatorem.',
        sourceIds: ['social'],
      },
      {
        id: 'documents',
        title: 'Zbierz dokumenty dochodowe',
        description: 'Skorzystaj z listy dokumentów UJ. Wielostronicowy dokument dołącz jako jeden plik.',
        sourceIds: ['social', 'applications'],
      },
      {
        id: 'submit',
        title: 'Wypełnij i złóż wniosek',
        description: 'W USOSweb wybierz właściwy semestr, uzupełnij wymagane dane i użyj funkcji „Podpisz i złóż elektronicznie”. Sam zapis wersji roboczej nie wystarczy.',
        sourceIds: ['social', 'applications'],
      },
      {
        id: 'follow-up',
        title: 'Sprawdzaj status i wezwania',
        description: 'Zaglądaj do wniosku oraz poczty studenckiej. Uzupełnienia przekazuj zgodnie z otrzymaną instrukcją.',
        sourceIds: ['applications'],
      },
    ],
    status: 'Wniosek i decyzję sprawdzaj w USOSweb. Lista UJverse nie ocenia dochodu ani prawa do świadczenia.',
    contact: {
      text: 'Koordynator ds. stypendialnych: USOSweb → Dla studentów → Obsługa. Pomoże ustalić dokumenty dla Twojej sytuacji.',
      url: 'https://dydaktyka.uj.edu.pl/centrum/dssp',
    },
    sources: [
      { id: 'social', title: 'UJ: stypendium socjalne — warunki, terminy i dokumenty', url: 'https://stypendia.uj.edu.pl/pomoc-materialna/stypendium-socjalne' },
      { id: 'applications', title: 'UJ: składanie wniosków o świadczenia', url: 'https://stypendia.uj.edu.pl/pomoc-materialna/wnioski' },
    ],
  },
  {
    slug: 'zapomoga',
    title: 'Jak złożyć wniosek o zapomogę?',
    shortTitle: 'Zapomoga',
    description: 'Jednorazowe wsparcie po zdarzeniu, które utrudniło studiowanie.',
    category: 'finanse',
    quickFacts: ['Jednorazowe wsparcie', 'Do 3 miesięcy od zdarzenia', 'Wniosek online'],
    primaryAction: {
      label: 'Sprawdź zasady zapomogi',
      url: 'https://stypendia.uj.edu.pl/pomoc-materialna/zapomoga',
    },
    academicYear: '2026/2027',
    checkedAt: '2026-11-12',
    scope: 'Studenci UJ · przejściowa trudna sytuacja życiowa',
    audience: 'Osoby, których studiowanie utrudniło zdarzenie życiowe, np. choroba lub utrata stałego dochodu. Decyzja zależy od indywidualnej sytuacji i dokumentów.',
    deadline: 'Nie zwlekaj: UJ wskazuje termin do 3 miesięcy od zdarzenia. Dokładne zasady i sposób liczenia terminu potwierdź w źródle lub z koordynatorem.',
    prepare: [
      'Krótki opis zdarzenia i datę, kiedy nastąpiło.',
      'Dokumenty potwierdzające zdarzenie oraz jego wpływ na Twoją sytuację.',
      'Dostęp do USOSweb i poczty studenckiej.',
    ],
    steps: [
      {
        id: 'check',
        title: 'Sprawdź, czy to właściwa pomoc',
        description: 'Przeczytaj zasady zapomogi i porównaj je ze swoją sytuacją. Wątpliwości dotyczące terminu wyjaśnij od razu.',
        sourceIds: ['aid'],
      },
      {
        id: 'document',
        title: 'Opisz i udokumentuj zdarzenie',
        description: 'Przygotuj wymagane załączniki. Nie przesyłaj dokumentów do UJverse — dołącz je wyłącznie w uczelnianej procedurze.',
        sourceIds: ['aid'],
      },
      {
        id: 'submit',
        title: 'Złóż wniosek w USOSweb',
        description: 'Wypełnij formularz zapomogi i użyj funkcji elektronicznego podpisania i złożenia. UJ nie wymaga wydruku tak złożonego wniosku.',
        sourceIds: ['aid', 'applications'],
      },
      {
        id: 'decision',
        title: 'Sprawdzaj wniosek i decyzję',
        description: 'Odczytuj wiadomości na poczcie studenckiej oraz ewentualne prośby o uzupełnienie dokumentów.',
        sourceIds: ['applications'],
      },
    ],
    status: 'Złożenie i rozstrzygnięcie potwierdzaj w USOSweb. Zaznaczenie punktu tutaj nie składa wniosku.',
    contact: { text: 'Koordynator ds. stypendialnych wskazany w USOSweb → Dla studentów → Obsługa.', url: 'https://dydaktyka.uj.edu.pl/centrum/dssp' },
    sources: [
      { id: 'aid', title: 'UJ: zapomoga — sytuacje, termin i dokumenty', url: 'https://stypendia.uj.edu.pl/pomoc-materialna/zapomoga' },
      { id: 'applications', title: 'UJ: składanie wniosków o świadczenia', url: 'https://stypendia.uj.edu.pl/pomoc-materialna/wnioski' },
    ],
  },
  {
    slug: 'mlegitymacja',
    title: 'Jak uruchomić mLegitymację studencką?',
    shortTitle: 'mLegitymacja',
    description: 'Dokument w telefonie: zamówienie, dodanie i sprawdzenie ważności.',
    category: 'codziennosc',
    quickFacts: ['PESEL i aktywny status', 'Aplikacja mObywatel', 'Przedłużenie nie jest automatyczne'],
    primaryAction: { label: 'Otwórz instrukcję UJ', url: 'https://usosownia.uj.edu.pl/usosweb/ogolne/mlegitymacja' },
    academicYear: '2026/2027',
    checkedAt: '2026-11-12',
    scope: 'Studenci UJ z numerem PESEL',
    audience: 'Osoby z aktywnym statusem studenta i numerem PESEL. UJ wymienia także potwierdzony Profil Zaufany oraz aplikację mObywatel.',
    deadline: 'Możesz rozpocząć po spełnieniu warunków UJ. Przed korzystaniem z dokumentu sprawdź jego ważność — przedłużenie na kolejny semestr nie jest automatyczne.',
    prepare: ['Dostęp do USOSweb lub mobilnego USOS.', 'Potwierdzony Profil Zaufany i aplikację mObywatel.'],
    steps: [
      {
        id: 'requirements',
        title: 'Sprawdź dane i wymagania',
        description: 'Upewnij się, że masz aktywny status i numer PESEL oraz spełniasz wymagania opisane w USOSowni.',
        sourceIds: ['mobile-id'],
      },
      {
        id: 'order',
        title: 'Zamów dokument przez USOS',
        description: 'Skorzystaj z USOSweb lub mobilnego USOS. Otwórz uczelnianą instrukcję i wykonaj wskazane czynności.',
        sourceIds: ['mobile-id'],
      },
      {
        id: 'activate',
        title: 'Dodaj dokument i sprawdź ważność',
        description: 'Dokończ dodawanie w mObywatelu według instrukcji. Przy zmianie telefonu potrzebne jest anulowanie starego dokumentu i zamówienie nowego.',
        sourceIds: ['mobile-id'],
      },
    ],
    status: 'Sprawdź dokument i jego aktualną ważność w mObywatelu. Ta lista nie zamawia ani nie przedłuża mLegitymacji.',
    contact: { text: 'Sprawy mLegitymacji: mlegitymacja@uj.edu.pl. Błędne dane w USOS zgłoś w sekretariacie swoich studiów.', url: 'https://usosownia.uj.edu.pl/kontakt' },
    sources: [{ id: 'mobile-id', title: 'USOSownia UJ: mLegitymacja — zamawianie i ważność', url: 'https://usosownia.uj.edu.pl/usosweb/ogolne/mlegitymacja' }],
  },
  {
    slug: 'wsparcie-psychologiczne',
    title: 'Jak umówić konsultację w SOWA?',
    shortTitle: 'Wsparcie psychologiczne',
    description: 'Pierwszy kontakt z uczelnianym ośrodkiem wsparcia, krok po kroku.',
    category: 'wsparcie',
    quickFacts: ['Formularz zgłoszeniowy', 'Logowanie kontem UJ', 'Termin ustala SOWA'],
    primaryAction: { label: 'Przejdź do zapisów SOWA', url: 'https://sowa.uj.edu.pl/skontaktujsieznami' },
    academicYear: '2026/2027',
    checkedAt: '2026-11-12',
    scope: 'Osoby studiujące na UJ · konsultacje SOWA',
    audience: 'Osoby studiujące, które potrzebują wsparcia psychologicznego. Do formularza potrzebne jest uczelniane konto; zasady SOWA rozróżniają studentów oraz pracowników i osoby ze szkół doktorskich.',
    deadline: 'Zgłoś się, gdy potrzebujesz wsparcia. Czas oczekiwania zależy od dostępności ośrodka — wysłanie formularza nie oznacza zarezerwowanego terminu. SOWA nie jest pogotowiem; w bezpośrednim zagrożeniu życia dzwoń pod 112.',
    prepare: ['Dostęp do konta i poczty w domenie UJ.', 'Krótki opis tego, z czym potrzebujesz pomocy, w oficjalnym formularzu.'],
    steps: [
      {
        id: 'open',
        title: 'Otwórz stronę zapisów SOWA',
        description: 'Wybierz formularz dla osób studiujących. Link i instrukcje znajdziesz na oficjalnej stronie ośrodka.',
        sourceIds: ['contact'],
      },
      {
        id: 'send',
        title: 'Zaloguj się i wyślij formularz',
        description: 'Użyj konta UJ, zapoznaj się z wymaganymi zgodami i przekaż zgłoszenie bezpośrednio do SOWA. Nie wpisuj danych zdrowotnych w UJverse.',
        sourceIds: ['contact', 'faq'],
      },
      {
        id: 'reply',
        title: 'Sprawdzaj pocztę studencką',
        description: 'Poczekaj na kontakt specjalisty. Jeśli formularz nie działa albo potrzebujesz przełożyć spotkanie, skorzystaj z instrukcji kontaktu SOWA.',
        sourceIds: ['contact', 'faq'],
      },
    ],
    status: 'Termin konsultacji potwierdza zespół SOWA. UJverse nie otrzymuje zgłoszenia ani informacji o zdrowiu.',
    contact: { text: 'Sekretariat SOWA: biuro.sowa@uj.edu.pl, tel. 12 663 36 83. Aktualne godziny i zasady kontaktu są na stronie ośrodka.', url: 'https://sowa.uj.edu.pl/skontaktujsieznami' },
    sources: [
      { id: 'contact', title: 'SOWA UJ: formularz i kontakt', url: 'https://sowa.uj.edu.pl/skontaktujsieznami' },
      { id: 'faq', title: 'SOWA UJ: zasady konsultacji i odpowiedzi na pytania', url: 'https://sowa.uj.edu.pl/faq' },
    ],
  },
  {
    slug: 'dostosowanie-studiowania',
    title: 'Jak uzyskać dostosowanie studiowania?',
    shortTitle: 'Dostosowanie studiowania',
    description: 'Gdy zdrowie lub szczególne potrzeby utrudniają zajęcia i egzaminy.',
    category: 'wsparcie',
    quickFacts: ['Najpierw konsultacja', 'Wniosek miesiąc wcześniej', 'Indywidualne rozwiązania'],
    primaryAction: { label: 'Zacznij od konsultacji w CD', url: 'https://cd.uj.edu.pl/pl_PL/dla-studentow/konsultacje-studenckie' },
    academicYear: '2026/2027',
    checkedAt: '2026-11-12',
    scope: 'Centrum Dostępności UJ · racjonalne usprawnienia procesu studiowania',
    audience: 'Osoby, których sytuacja zdrowotna lub psychofizyczna wpływa na studiowanie. Rozwiązania dobiera się indywidualnie, bez obniżania wymagań merytorycznych.',
    deadline: 'Wniosek z załącznikami składa się zasadniczo co najmniej miesiąc przed planowanym skorzystaniem z usprawnień. Wyjątki rozpatruje się indywidualnie. Najpierw umów konsultację w Centrum Dostępności.',
    prepare: ['Opis trudności na zajęciach lub egzaminach.', 'Dokumentację specjalistyczną wskazaną przez Centrum Dostępności.', 'Informację, od kiedy potrzebujesz wsparcia.'],
    steps: [
      {
        id: 'consultation',
        title: 'Umów konsultację w Centrum Dostępności',
        description: 'Wypełnij formularz wskazany przez CD i poczekaj na kontakt. Każdy wniosek poprzedza konsultacja.',
        sourceIds: ['consultation'],
      },
      {
        id: 'needs',
        title: 'Omów potrzeby i dokumentację',
        description: 'Ze specjalistą ustalisz możliwe rozwiązania i wymagane dokumenty. Dokumentacji medycznej nie przesyłaj do UJverse.',
        sourceIds: ['consultation'],
      },
      {
        id: 'application',
        title: 'Przejdź procedurę wniosku',
        description: 'Postępuj według wskazówek CD. Po opinii specjalisty decyzję podejmuje właściwy dziekan.',
        sourceIds: ['adjustments'],
      },
      {
        id: 'arrangements',
        title: 'Ustal szczegóły z prowadzącymi',
        description: 'Po uzyskaniu zgody uzgodnij realizację przyznanych rozwiązań na zajęciach i egzaminach.',
        sourceIds: ['adjustments'],
      },
    ],
    status: 'Przebieg sprawy ustalaj z CD i swoją jednostką. Samo zgłoszenie nie oznacza przyznania usprawnień.',
    contact: { text: 'Centrum Dostępności UJ — konsultacje i aktualne sposoby kontaktu na stronie jednostki.', url: 'https://cd.uj.edu.pl/pl_PL/kontakt/sposoby-kontaktu' },
    sources: [
      { id: 'consultation', title: 'CD UJ: konsultacje studenckie', url: 'https://cd.uj.edu.pl/pl_PL/dla-studentow/konsultacje-studenckie' },
      { id: 'adjustments', title: 'CD UJ: racjonalne usprawnienia i termin wniosku', url: 'https://cd.uj.edu.pl/pl_PL/dla-studentow/racjonalne-usprawnienia-procesu-studiowania' },
    ],
  },
  {
    slug: 'biblioteka-jagiellonska',
    title: 'Jak zapisać się do Biblioteki Jagiellońskiej?',
    shortTitle: 'Biblioteka Jagiellońska',
    description: 'Dokumenty, aktywacja karty i pierwsze korzystanie ze zbiorów.',
    category: 'studia',
    quickFacts: ['Sprawdź dokumenty', 'Zapis w Wypożyczalni BJ', 'Osobne zasady innych bibliotek'],
    primaryAction: { label: 'Sprawdź zasady zapisu do BJ', url: 'https://bj.uj.edu.pl/korzystanie-z-bj/jak-zostac-uzytkownikiem' },
    academicYear: '2026/2027',
    checkedAt: '2026-11-12',
    scope: 'Biblioteka Jagiellońska · zakres dokumentów zależy od kategorii czytelnika',
    audience: 'Osoby studiujące na UJ, które chcą korzystać z BJ. Dla studentów zagranicznych i innych kategorii czytelników obowiązują odrębne listy dokumentów.',
    deadline: 'Przed wizytą sprawdź aktualne godziny Wypożyczalni i dokumenty na bieżący semestr. Karta wymaga ważności lub prolongaty zgodnie z zasadami BJ.',
    prepare: ['Dokument tożsamości.', 'Ważną ELS zgodnie z listą dokumentów dla Twojej kategorii; jeśli masz tylko mLegitymację, najpierw zapytaj BJ o właściwą ścieżkę.'],
    steps: [
      {
        id: 'documents',
        title: 'Wybierz swoją kategorię czytelnika',
        description: 'Otwórz zasady zapisu i sprawdź listę dokumentów. Nie zakładaj, że procedura innej grupy dotyczy również Ciebie.',
        sourceIds: ['registration'],
      },
      {
        id: 'visit',
        title: 'Zapisz się w Wypożyczalni BJ',
        description: 'Okaż wymagane dokumenty. Dla uprawnionych studentów ELS jest aktywowana jako karta biblioteczna.',
        sourceIds: ['registration'],
      },
      {
        id: 'rules',
        title: 'Sprawdź swoje uprawnienia',
        description: 'Potwierdź możliwość wypożyczania i zasady korzystania z konta. Do innych bibliotek UJ trzeba zapisać się oddzielnie.',
        sourceIds: ['registration'],
      },
    ],
    status: 'Aktywację i ważność karty potwierdza Biblioteka. Lista UJverse nie zakłada konta czytelnika.',
    contact: { text: 'Wątpliwości dotyczące dokumentów lub karty wyjaśnij przez oficjalny formularz „Zapytaj bibliotekarza”.', url: 'https://bj.uj.edu.pl/uslugi/zapytaj-bibliotekarza-formularz' },
    sources: [
      { id: 'registration', title: 'BJ: jak zostać użytkownikiem — dokumenty i uprawnienia', url: 'https://bj.uj.edu.pl/korzystanie-z-bj/jak-zostac-uzytkownikiem' },
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
