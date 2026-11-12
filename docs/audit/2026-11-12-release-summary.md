# UJverse — podsumowanie kandydata do wydania, 12 listopada 2026

**Snapshot przed wdrożeniem.** Dokument utrwala przygotowany zakres i dowody przed publikacją. Końcowy commit, identyfikator Vercel, alias i wynik kontroli po publikacji są zapisywane później w historii Vercel i końcowym raporcie dla użytkownika; ten plik nie wymaga kolejnego commita aplikacji, aby opisać własny SHA wydania.

Przygotowano zmiany po audycie z 11 listopada: użyteczne działania na Start, trzy poradniki, ograniczony pilotaż kierunków, dobrowolny pomiar lokalny oraz poprawki wyszukiwania i integralności Auli. Bieżące sprawdzenia lokalne przeszły: **150 testów w 39 zestawach, 34 sprawdzenia przeglądarkowe, build frontendu, publiczne RLS oraz 9 grup asercji Auli na tymczasowym PostgreSQL**.

Użytkownik 12 listopada potwierdził wykonanie migracji Auli bez błędów w Supabase SQL Editor i zezwolił na publikację produkcyjną. Ten dokument jest migawką kandydata wydania przed publikacją. Identyfikator gotowego wdrożenia, końcowy commit i wynik kontroli aliasu zostaną podane w raporcie po publikacji; historię można sprawdzić w [Vercel](https://vercel.com/tenkejjs-projects/ujverse/deployments). Pomyślny lokalny build ani potwierdzenie SQL nie zastępują kontroli wdrożenia.

## Zakres i punkt odniesienia

Audyt oceniał commit `1a29c249164c8fd7b0a098d78e653a2bfac50756` z `codex/info-ui-research`. Poprawki powstały na `codex/audit-2026-11-11`. Po pobraniu `origin/main` porównanie do tej bazy wykazało 0 commitów wyłącznie na `main` i 39 wyłącznie na gałęzi informacyjnej. To zapis punktu wyjścia; końcowy merge i commit wydania wymagają osobnego potwierdzenia.

Zachowano oryginalne logo UJverse, systemowy font oraz istniejące motywy jasny, ciemny i UJ. Informacje publiczne nadal nie wymagają konta. Funkcje osobiste i społecznościowe korzystają z sesji, a ich uprawnienia powinny być wymuszane przez bazę/API niezależnie od wyglądu interfejsu.

## Co zmieniło się dla studenta

**Start prowadzi najpierw do działania.** Sekcja „Nie przegap” znajduje się przed kompaktową pomocą Versusia. Pokazuje rejestracje oraz niedawne komunikaty o odwołanych lub zdalnych zajęciach, następny krok, oficjalne źródło i informacje o aktualności. Początkowo widać najwyżej trzy działania; kolejne można rozwinąć. Niedostępność jednego źródła nie usuwa pozostałych sekcji i nie jest przedstawiana jako brak spraw.

„Sprawdzone” zapisuje się na urządzeniu i można je cofnąć. Klucz uwzględnia treść działania, więc zmieniony komunikat nie powinien odziedziczyć starego potwierdzenia. Odhaczenie nie zapisuje na zajęcia, nie wysyła wniosku ani nie potwierdza, że sprawa dotyczy konkretnego studenta. Nieaktualny termin wymaga sprawdzenia w USOSweb; system nie tworzy zobowiązań ani terminów na podstawie odpowiedzi AI.

**Trzy publiczne poradniki** są dostępne przez `/poradniki`, na Start i w wyszukiwarce:

| Poradnik | Adres | Zakres |
| --- | --- | --- |
| Stypendium rektora | `/poradniki/stypendium-rektora` | Kryteria, przygotowanie dokumentów, wniosek, elektroniczne złożenie, status i właściwy kontakt. Podstawowy termin na rok 2026/2027 jest oznaczony jako miniony; wyjątki wymagają potwierdzenia. |
| Akademik | `/poradniki/akademik` | Właściwy nabór, formularz, preferencje, dalsze czynności i kontakt. Zakres dotyczy UJ poza CM; procedura CM jest wskazana osobno. |
| Rejestracje USOS | `/poradniki/rejestracje-usos` | Znalezienie właściwej tury, potwierdzenie uprawnień i terminu, zapis oraz kontrola wyniku. Brak jednego zmyślonego terminu dla całego UJ. |

Każdy poradnik wskazuje odbiorców, wymagane przygotowanie, kroki i powiązane oficjalne źródła. Daty weryfikacji redakcyjnej pozostają zgodne z rzeczywistym sprawdzeniem: **11 listopada 2026**. Lokalny postęp jest oddzielny dla procedur i działa z klawiatury. Gotowe odpowiedzi Versusia na dopasowane proste pytania proceduralne prowadzą do poradnika i źródła bez dodatkowego wywołania modelu; nie rozstrzygają indywidualnej kwalifikacji studenta.

**Pilotaż kierunku obejmuje tylko dwa potwierdzone programy stacjonarne:** elektroniczne przetwarzanie informacji na WZiKS oraz filozofię na Wydziale Filozoficznym. W obu przypadkach I stopień trwa 3 lata, II stopień 2 lata. Można wybrać stopień i rok; zmiana kierunku/stopnia resetuje niepasujące pola, a zmiana wydziału dezaktywuje kontekst innego wydziału. Wybór jest lokalny i nie nadpisuje danych konta.

Obecne komunikaty i rejestracje nie mają zweryfikowanego przypisania do kierunku, stopnia ani roku. **Wybór kierunku zapewnia kontekst, lecz nie dowodzi filtrowania terminów dla konkretnego programu.** Dane pozostają wydziałowe. Nie wywnioskowano odbiorców z podobieństwa tytułu ani z AI. Źródła struktury programów i ograniczenia opisuje [dokument pilotażu](../design/study-profile-pilot.md).

## Wyszukiwanie i ochrona danych

Wyszukiwanie przeglądarkowe korzysta teraz z normalnego klienta Supabase z rolą gościa lub sesją użytkownika. Usunięto konstrukcję klienta Meilisearch i użycie szerokiego klucza indeksu w przeglądarce. Publiczna wyszukiwarka obejmuje informacje, rejestracje, wydarzenia, narzędzia i poradniki; nie przeszukuje kont, wpisów ani Auli jako gość.

Wyszukiwanie kont i Auli używa zapytań podlegających RLS. Identyfikator rocznika zawęża wyniki, ale sam nie nadaje dostępu. Dodano ograniczenia liczby wyników i przesunięcia, bezpieczne wzorce zapytań oraz filtry usuniętych wiadomości, zbanowanych autorów i preferencji widoczności profili. Wyszukiwanie nazw plików sprawdza również rocznik wiadomości nadrzędnej. Narzędzie czatu `find_user` respektuje widoczność i omija współdzieloną pamięć podręczną tego wyszukiwania.

Preferencje `is_searchable` i `show_department` są respektowane przez wyszukiwanie. Nie stają się przez to ogólną poufnością kolumn profilu: istniejąca polityka odczytu profili dla zalogowanych jest szersza. Zmiana tego kontraktu wymagałaby osobnej migracji i dostosowania aplikacji.

Stary host Meilisearch odpowiadał `404 Application not found` zarówno na kontrolę stanu, jak i odczyt metadanych kluczy. Nie odczytywano prywatnych indeksów. Wyszukiwanie aplikacji działa przez bazę; nie oznacza to naprawy starej usługi ani unieważnienia dawniej udostępnionego klucza. Obecna ścieżka tekstowa nie zapewnia dawnej tolerancji literówek.

Prywatne skrypty eksportu/odtwarzania indeksów wycofano. Vercelowy webhook domyślnie pomija synchronizację i nie eksportuje wpisów, profili, wiadomości ani załączników. Ewentualne jawne włączenie dotyczy tylko komunikatów w osobnym publicznym indeksie; stare nazwy indeksów mieszanych/prywatnych są odrzucane. **Zmieniono również zgodnościowy kod Supabase `sync-search`. Odczyt produkcyjnego endpointu `functions/v1/sync-search` zwrócił HTTP 404 z kodem `NOT_FOUND` („requested function not found”): ta stara funkcja nie jest zainstalowana w skonfigurowanym projekcie, więc nie wymaga osobnego wdrożenia.** Publikacja Vercel nie aktualizuje funkcji Supabase. Produkcyjna zmienna `SEARCH_INDEX_SYNC_ENABLED` jest nieobecna, czyli opcjonalna synchronizacja pozostaje wyłączona.

## Aula: co obejmuje migracja

Migracja [`20261112120000_aula_scope_integrity.sql`](../../supabase/migrations/20261112120000_aula_scope_integrity.sql) wzmacnia relacje między rocznikami na poziomie bazy:

- Wiadomość, jej odpowiedź nadrzędna, sala i załącznik muszą należeć do właściwego rocznika.
- Nie można przenosić istniejącej wiadomości lub sali do innego rocznika.
- Edycja/usuwanie zależą również od bieżącego członkostwa, więc samo dawne autorstwo nie utrzymuje dostępu po opuszczeniu rocznika.
- Niespójne historyczne metadane załączników są ukrywane przed zwykłym odczytem; migracja nie usuwa ani automatycznie nie przepisuje istniejących danych.
- Uprzywilejowane operacje administracyjne zachowują swój zakres, ale nadal muszą utrzymywać spójność relacji.

Na tymczasowym PostgreSQL zastosowano migrację dwukrotnie i przeszło dziewięć grup asercji. Obejmowały oba kierunki izolacji roczników, gościa, podrobiony rocznik załącznika, obce odpowiedzi/sale, byłego członka, brak zmian po odmowie i poprawne utrzymanie administracyjne.

**Stan produkcyjny: wykonanie migracji potwierdził użytkownik 12 listopada po sukcesie w SQL Editor.** Agent nie wykonywał zdalnego DDL i nie odczytał niezależnie katalogu wdrożonych polityk. Nie przeprowadzono też pełnej produkcyjnej sesji dwóch uprawnionych kont z różnych roczników. To oddzielne dowody od testów lokalnych.

## Badania i dobrowolny pomiar

Przygotowano [materiały badań](../research/README.md): plan 15–20 wywiadów, protokół pilotażu 30–50 studentów z 2–3 wydziałów, zgodę oraz puste arkusze uczestników i obserwacji. Użytkownik potwierdził, że **nie ma jeszcze uczestników**. Stan: 0 zrekrutowanych, 0 przeprowadzonych wywiadów, 0 obserwacji i dobrowolnie przekazanych raportów. Nie wysyłano automatycznie zaproszeń. Nie ma wyników użyteczności, retencji ani potwierdzenia dopasowania produktu do potrzeb.

Panel „Pomóż sprawdzić UJverse” wymaga świadomego włączenia. Dane zostają w jednej przeglądarce na jednym urządzeniu przez maksymalnie 28 dni: dni odwiedzin, liczniki aktywacji źródeł i czas świadomie rozpoczętego zadania. Nie przechowuje pytań, wyszukiwań, adresów URL ani danych konta. Uczestnik może pobrać JSON i sam zdecydować o przekazaniu; wyłączenie usuwa lokalny pomiar. Istniejąca ogólna analityka witryny jest odrębnym mechanizmem.

Kliknięcie źródła nie dowodzi otwarcia strony, poprawnej odpowiedzi, zrozumienia ani wykonania formalności. To wymaga obserwacji prowadzącego. Jedna przeglądarka nie jest automatycznie jedną osobą. Powrót w dniach 1–7 i w dniach 7–13 to dwa jawnie zdefiniowane okna, a nie ścisła retencja dnia 7. Bez zakończonego okna i dobrowolnie zebranych raportów nie ma centralnego wyniku retencji kohorty.

## Dowody sprawdzeń

Wyniki dotyczą lokalnego drzewa zmian z 12 listopada, przed przypisaniem końcowego commita wydania. Artefakty znajdują się w `/workspace/work/audit-2026-11-11`.

| Sprawdzenie | Wynik i artefakt | Granica wniosku |
| --- | --- | --- |
| `npm test` | 150/150 testów, 39 zestawów, 0 błędów; `unit-regression.log` | Obejmuje moduły informacji, poradniki, radar, profil studiów, pomiar, zapytania i granice wyszukiwania/czatu. Ostrzeżenia opcjonalnego KV w lokalnym środowisku nie są dowodem działania produkcyjnego cache. |
| `npm run build` | Frontend TypeScript/Vite zakończony sukcesem; `frontend-build.log` | Pozostało ostrzeżenie o fragmentach JS powyżej 500 kB. Ten wynik nie twierdzi, że osobny builder funkcji API nie ma diagnostyki. |
| `scripts/audit-browser-checks.mjs` | 34/34, brak błędów strony i żądań do indeksu; `browser-regression.json` / `.log` | Prawdziwe publiczne odczyty jako gość przez lokalny zaufany proxy TLS. Kliknięcia źródeł z zablokowaną nawigacją zewnętrzną; bez prywatnych sesji, formularzy uczelni i Groq. |
| Produkcyjny artefakt Vercel | `vercel build --prod` zakończony kodem 0: 18 funkcji i 96 plików JS/CSS przeglądarki | Skan rzeczywistych wartości sekretów produkcyjnych: 0 wycieków; brak SDK Meilisearch i `MeiliSearchApiError`; poradniki i obsługa wyłączonej synchronizacji obecne w funkcjach. Builder nadal wypisał istniejący wcześniej TS2352 w `api/_lib/notificationHelpers.ts:123` — nie twierdzimy, że wszystkie API przeszły bez diagnostyki typów. |
| Responsywność | 320, 390, 768, 1440, 2560 px bez poziomego przepełnienia; zrzuty `final-home-*`, `final-guide-320.png` | Są to pomiary i scenariusze interfejsu, a nie badanie z użytkownikami. |
| `scripts/pivot-rls-check/run.sh` | Publiczna migracja zastosowana dwukrotnie; wszystkie asercje przeszły; `pivot-rls.log` | Tymczasowa lokalna baza, nie produkcyjny katalog polityk. |
| `scripts/aula-security-check/run.sh` | Migracja dwukrotnie, 9/9 grup; `aula-rls.log` | Syntetyczne konta/roczniki w PostgreSQL 17.11, bez odczytu prywatnych danych studentów. |
| Publiczne odczyty produkcyjne | Trzy domeny dostępne; gość nie widzi sprawdzanych danych prywatnych ani rejestracji spoza USOS; `public-services-probe.json` | Porównanie potwierdza istnienie danych administracyjnie bez publikowania ich treści/liczebności. Nie jest testem zdalnego zapisu ani pełnej izolacji kont. |

Przeglądarka sprawdzała m.in. kolejność działania przed asystentem, odhaczanie i trwałość radaru, wybór kierunku/roku i dezaktywację po zmianie wydziału, postęp poradników z klawiatury, miniony termin stypendium, odrębność CM, wyszukiwanie poradników, klawiaturę kalendarza, bramki `/moj-plan`, `/aula`, `/search`, zgodę pomiaru, dopasowanie źródła do zadania, dozwolone pola i usuwanie danych. Historycznych wyników 80/80 i 64/64 z 4 listopada nie przeniesiono na to wydanie.

## Zapis publikacji i pozostałe kroki

| Element | Stan przy przygotowaniu dokumentu |
| --- | --- |
| Zgoda na produkcję | Udzielona przez użytkownika 12 listopada |
| Końcowy commit i merge | Wynik po tym snapshocie: historia Vercel i końcowy raport użytkownika |
| Vercel deployment ID / adres | Wynik po tym snapshocie: historia Vercel i końcowy raport użytkownika |
| READY i alias `ujverse.vercel.app` | Kontrola po tym snapshocie: historia Vercel i końcowy raport użytkownika |
| Zgodność plików JS/CSS i kontrola publiczna po publikacji | Dowód po tym snapshocie: rzeczywisty artefakt i końcowy raport użytkownika |
| Migracja Auli | Sukces potwierdzony przez użytkownika w Supabase SQL Editor; brak niezależnego odczytu katalogu |
| Supabase `sync-search` | Zmienione źródło zgodnościowe; odczyt 404 `NOT_FOUND` potwierdził brak zainstalowanej starej funkcji w tym projekcie. Osobny rollout nie jest potrzebny. |

Raport końcowy po tym snapshocie obejmuje rzeczywiste wdrożenie i jego kontrolę. Osobnymi zadaniami pozostają: autoryzowana weryfikacja sesji dwóch roczników/katalogu polityk, rozwiązanie statusu historycznego klucza u dostawcy oraz osobne usunięcie istniejącej diagnostyki typów `notificationHelpers.ts`. Badania wymagają rekrutacji prawdziwych uczestników i upływu zdefiniowanego czasu. Kontekst dwóch kierunków można rozszerzać dopiero wraz z potwierdzonymi programami i metadanymi odbiorców komunikatów.

Bieżący rejestr techniczny: [status audytu](2026-11-11-status.md). Szczegóły granic wyszukiwania i migracji: [search-security.md](search-security.md).
