<p align="center">
  <strong>Polski</strong> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="public/logo.png" alt="UJverse" width="140">
</p>

<h1 align="center">UJverse</h1>

<p align="center">
  Wszystko, co ważne na UJ, w jednym miejscu.
</p>

<p align="center">
  <a href="https://ujverse.vercel.app/">ujverse.vercel.app</a>
  ·
  <a href="mailto:franciszek.dranka@student.uj.edu.pl">franciszek.dranka@student.uj.edu.pl</a>
  ·
  <a href="./LICENSE">License</a>
</p>

---

UJverse to niezależny serwis informacyjny dla studentów Uniwersytetu Jagiellońskiego. Zbiera komunikaty wydziałów, rejestracje z USOSweb i wydarzenia uczelni z oficjalnych źródeł, pozwala wybrać swój wydział i znaleźć to, czego potrzebujesz — **bez zakładania konta**. Konto przydaje się dopiero do funkcji osobistych (plan zajęć, Aula, społeczność).

Projekt nie jest powiązany z UJ, sponsorowany ani zatwierdzony przez uczelnię. Informacje pobieramy automatycznie z publicznych stron UJ — w sprawach ważnych zawsze sprawdź w źródle.

Audyt z 11 listopada 2026 r. dotyczył wdrożonego commita `1a29c24` z gałęzi `codex/info-ui-research`. Stan prac po audycie, dowody sprawdzeń i otwarte zależności produkcyjne są opisane w [snapshocie audytu przed wydaniem](docs/audit/2026-11-11-status.md). Zmiany z audytu przygotowano na `codex/audit-2026-11-11` do włączenia do `main` i publikacji. Opis funkcji poniżej obejmuje tę wersję; aktualny commit produkcji sprawdzaj w historii Vercel. Bieżąca weryfikacja lokalna: 150 testów w 39 zestawach, 34 sprawdzenia przeglądarkowe, build frontendu oraz testy publicznego RLS i 9 grup asercji Auli na tymczasowym PostgreSQL — wszystkie przeszły. [Pełne podsumowanie po polsku](docs/audit/2026-11-12-release-summary.md) rozdziela te wyniki, potwierdzoną przez użytkownika migrację Auli i status publikacji. Historyczne wyniki pivotu pozostają osobnym raportem.

## Dostępne bez konta

**Start** (`/`) — najpierw „Nie przegap”: rejestracje i niedawne odwołania / zmiany zajęć z oficjalnym źródłem, następnym krokiem i lokalnym oznaczeniem „Sprawdzone”. Poniżej są poradniki, pomoc Versusia, komunikaty, rejestracje i kalendarz, zapisane elementy oraz aktualność danych. Odhaczenie punktu nie zapisuje na zajęcia ani nie załatwia formalności.

**Wybór wydziału** — w kilka sekund, bez rejestracji; zapisuje się w przeglądarce (`localStorage`, klucz `ujverse.infoPrefs.v1`). Zalogowanym domyślnie podpowiadamy wydział z profilu, a wybór na urządzeniu nigdy nie zmienia profilu.

**Kierunek — pilotaż** — lokalny wybór elektronicznego przetwarzania informacji (WZiKS) lub filozofii (Wydział Filozoficzny), studiów I / II stopnia i roku. Oba zweryfikowane programy stacjonarne trwają odpowiednio 3 / 2 lata. Obecne komunikaty i rejestracje nie mają potwierdzonego przypisania do kierunku, stopnia ani roku, więc pozostają filtrowane według wydziału. [Zakres i źródła](docs/design/study-profile-pilot.md).

**Poradniki** (`/poradniki`) — stypendium rektora, akademik i rejestracje USOS: dla kogo, co przygotować, kolejne kroki, gdzie sprawdzić termin i status oraz kontakt. Oficjalne źródła sprawdzono 11 listopada 2026 r.; postęp jest lokalny. Poradnik akademików UJ wyraźnie odsyła CM do osobnej procedury.

**Komunikaty** (`/komunikaty`) — ogłoszenia z 16 oficjalnych stron wydziałów (ostatnie 30 dni), filtry rodzaju (odwołane zajęcia, zdalnie, dyżury, wydarzenia), pełna treść na żądanie i link do oryginału. Streszczenia AI są oznaczone jako AI.

**Rejestracje** (`/rejestracje`) — trwające i nadchodzące tury z publicznego katalogu USOSweb, pogrupowane po wydziałach (na podstawie kodu jednostki USOS), z terminami w czasie warszawskim. Zakończone rejestracje nie są pokazywane jako aktywne.

**Wydarzenia** (`/wydarzenia`) — wydarzenia ogólnouczelniane z kalendarza uj.edu.pl (daty; godziny i miejsce w źródle).

**Szukaj** (`/szukaj`, Ctrl/Cmd+K) — komunikaty, rejestracje, wydarzenia i narzędzia. Wyszukiwarka publiczna nie przeszukuje profili, wpisów ani Auli. Odczyt danych przez klienta Supabase podlega politykom RLS po stronie serwera; prywatne wyszukiwanie używa sesji użytkownika.

**Niezbędnik** (`/niezbednik`) — USOSweb, PEGAZ, poczta, katalog rejestracji, kalendarz UJ oraz narzędzia UJverse (Znajdź salę działa bez konta).

**Zapisz na później** — zakładka przy każdym komunikacie, rejestracji i wydarzeniu; lista żyje tylko na tym urządzeniu.

**Versuś** (`/chat`) — asystent AI do informacji o uczelni, dostępny także bez logowania. Korzysta z modeli GPT-OSS uruchamianych przez Groq oraz danych UJverse. „O Versusiu” wyjaśnia modele, źródła, przekazywane dane i ograniczenia. Do odczytu planu i innych danych osobistych wymagana jest zweryfikowana sesja. Część prostych pytań otrzymuje gotową odpowiedź bez wywołania modelu, w tym dopasowane pytania proceduralne z linkiem do poradnika i oficjalnych zasad; to nie jest decyzja o uprawnieniach studenta.

**Dobrowolny pomiar pilotażu** — panel „Pomóż sprawdzić UJverse” wymaga świadomego włączenia. Przez maksymalnie 28 dni przechowuje na urządzeniu dni odwiedzin, liczniki otwarć źródeł i czas zadania. Raport JSON można pobrać lub usunąć; nic nie jest wysyłane automatycznie. Pomiar nie potwierdza poprawności znalezionego źródła ani wykonania formalności. [Materiały badań](docs/research/README.md) są gotowe do rekrutacji; nie ma jeszcze uczestników, wywiadów ani wyników retencji.

## Z kontem UJverse

**Mój Plan** (`/moj-plan`) — plan z USOSweb (import ICS), widok dnia i tygodnia, egzaminy, tygodniowy briefing, komunikaty subskrybowanych wykładowców.

**Aula** (`/aula`) — czaty roczników: kanały, wiadomości realtime, reakcje, ankiety, załączniki, notatki i zadania.

**Alarmy rejestracji** (`/usos`) — przypomnienia przed turami i wpisy społeczności (dawny widok „Rejestracje USOS").

**Couponek UJ** (`/znizki`), **Miejsca do nauki** (`/miejsca`) — zniżki i miejsca nauki współtworzone przez studentów.

Wejście na te strony bez sesji pokazuje krótkie wyjaśnienie, dlaczego potrzebne jest konto, i przycisk logowania; po zalogowaniu wracasz na tę samą stronę.

## Społeczność (funkcje zachowane, drugoplanowe)

Feed z wpisami, komentarzami i polubieniami jest teraz pod `/spolecznosc` (dawniej `/`), a w nawigacji w grupie „Twoje konto". Bez zmian działają profile i obserwowanie, wpisy `/thread/:id`, profile `/profile/:handle`, strefy `/wydzialy/:slug` i `/strefy/:slug`, wydarzenia społeczności z RSVP i kalendarzem (`/events`), wyszukiwarka społeczności (`/search`) i powiadomienia. Żadne dane ani tabele nie zostały usunięte.

## Dostęp bez logowania i bezpieczeństwo

- Widoki publiczne czytają wyłącznie dane przepisane przez scrapery z publicznych stron: `announcements`, `official_events` i te wiersze `usos_registrations`, które pochodzą z katalogu USOSweb (`source_usos_tura_id IS NOT NULL`). Wpisy społeczności i przykładowe dane (seed) widzą tylko zalogowani.
- Odczyt profili, wpisów, wiadomości Auli i danych konta musi być autoryzowany przez polityki RLS w Supabase, niezależnie od filtrów interfejsu. Samo ukrycie linku lub filtr rocznika w przeglądarce nie stanowi zabezpieczenia.
- Klient Supabase używa klucza publicznego (publishable/anon) i dostępnej sesji; klucz service-role zostaje po stronie API. Wyszukiwanie przeglądarkowe nie powinno otrzymywać klucza Meilisearch z dostępem do prywatnych indeksów.

> **Zależność wdrożenia do sprawdzenia:** repozytorium zawiera migrację
> [`supabase/migrations/20261104120000_public_information_read_access.sql`](supabase/migrations/20261104120000_public_information_read_access.sql)
> z ograniczonym publicznym `SELECT`. Odczyty produkcyjne z 12 listopada potwierdziły publiczny dostęp `anon` do trzech domen oraz brak widocznych wierszy rejestracji spoza USOS, wiadomości Auli, planów i powiadomień, przy istniejących danych potwierdzonych administracyjnie. Nie potwierdza to dokładnych definicji zdalnych polityk ani izolacji między zalogowanymi rocznikami; te sprawdzenia pozostają otwarte w raporcie audytu. 12 listopada użytkownik potwierdził wykonanie bez błędów dodatkowej migracji integralności Auli `20261112120000_aula_scope_integrity.sql`; nie jest to niezależny odczyt katalogu polityk przez agenta. Lokalna kontrola migracji: `bash scripts/pivot-rls-check/run.sh`; wyniki lokalne i produkcyjne zapisuj osobno.

## Skąd pochodzą dane i jak są świeże

| Dane | Źródło | Harmonogram (cron) | Co oznacza data w UI |
| --- | --- | --- | --- |
| Komunikaty | 16 stron wydziałów ([`api/scrape-faculty-announcements.ts`](api/scrape-faculty-announcements.ts)) | 3× dziennie | „dodano" = pierwsze pobranie przez UJverse, nie data publikacji |
| Rejestracje | publiczny katalog USOSweb ([`api/scrape-usos-registrations.ts`](api/scrape-usos-registrations.ts)) | 2× dziennie | terminy z USOSweb; „potwierdzone w USOSweb" = ostatni przebieg scrapera |
| Wydarzenia | kalendarz uj.edu.pl ([`api/scrape-uj-events.ts`](api/scrape-uj-events.ts)) | codziennie | dzień wydarzenia; „sprawdzone" = ostatnie pobranie |

Dane nie są „na żywo". Jeśli scraper rejestracji nie zaktualizował danych przez ponad 36 h, UI ostrzega, że mogą być nieaktualne, i nie pokazuje odliczania.

## Trasy

| Ścieżka | Widok | Konto |
| --- | --- | --- |
| `/` | Start (informacje) | nie |
| `/komunikaty`, `/rejestracje`, `/wydarzenia`, `/szukaj`, `/niezbednik`, `/sale` | strony informacyjne, Znajdź salę | nie |
| `/poradniki`, `/poradniki/stypendium-rektora`, `/poradniki/akademik`, `/poradniki/rejestracje-usos` | poradniki procedur | nie |
| `/chat` | Versuś — publiczne pytania; narzędzia konta wymagają sesji | nie dla informacji publicznych |
| `/logowanie` | logowanie / rejestracja (`?next=` = powrót) | — |
| `/spolecznosc`, `/thread/:id`, `/profile`, `/profile/:handle`, `/events`, `/search`, `/notifications` | społeczność | tak |
| `/moj-plan` (`/dzis`, `/briefing`), `/aula`, `/usos`, `/znizki`, `/miejsca`, `/admin/*` | funkcje konta | tak |
| `/settings` | preferencje lokalne; ustawienia konta po zalogowaniu | zależnie od sekcji |

## Stack

| Warstwa | Technologie |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4, Framer Motion, React Router 7, TanStack Query |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Realtime) |
| API | Vercel serverless / Edge — scrapery, chat, sync wyszukiwarki |
| Search | Supabase/PostgREST + RLS; opcjonalna synchronizacja indeksu Meilisearch po stronie serwera |
| AI | Groq, Vercel KV (cache + rate limit) |

Dane w UI idą przez [`DataService`](src/services/DataService.ts) i adaptery; warstwa informacyjna to [`PublicInfoAdapter`](src/services/adapters/PublicInfoAdapter.ts) + czyste moduły w [`src/lib/info/`](src/lib/info/). Schemat bazy: [`supabase/migrations/`](supabase/migrations/). Dokumentacja pivotu: [`docs/pivot/`](docs/pivot/).

## Uruchomienie lokalne

```bash
npm ci
cp .env.example .env.local   # uzupełnij VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

```bash
npm run build          # tsc (strict) + produkcyjny build
npm run lint
npm test               # Node 22.8+ (zalecany 24): node:test + tsx
npm run chat:prewarm   # prewarm cache asystenta
bash scripts/pivot-rls-check/run.sh            # lokalny test polityk RLS (wymaga PostgreSQL)
bash scripts/aula-security-check/run.sh       # lokalna izolacja kohort i integralność Auli
node scripts/audit-browser-checks.mjs         # aktualne scenariusze; wymaga playwright-core i Chromium
```

### Zmienne środowiskowe

| Zmienna | Gdzie | Po co |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (alias `VITE_SUPABASE_ANON_KEY`) | klient | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | API | scrapery, narzędzia AI |
| `GROQ_API_KEY` | Edge | `/api/chat` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Edge | cache + rate limit |
| `MEILI_HOST` / `MEILI_MASTER_KEY` | serverless | opcjonalny publiczny mirror; nigdy w `VITE_*` ani w kodzie klienta |
| `SEARCH_INDEX_SYNC_ENABLED` | serverless | jawne włączenie opcjonalnej synchronizacji publicznych komunikatów; domyślnie wyłączona |
| `MEILI_PUBLIC_INDEX` | serverless | osobny publiczny indeks; domyślnie `ujverse_public_information` |
| `CRON_SECRET` | cron | autoryzacja jobów |

Wyszukiwanie aplikacji korzysta z ograniczonych zapytań tekstowych do bazy i nie zależy od dostępności Meilisearch. Nie ma obecnie tolerancji literówek dawnego indeksu. Opcjonalna synchronizacja obejmuje wyłącznie komunikaty; indeksy profili, wpisów i Auli nie są odtwarzane przez tę ścieżkę. Konfigurację i stan synchronizacji sprawdzaj osobno od odczytów Supabase. Zmieniono także zgodnościowy kod Supabase `sync-search`; odczyt produkcyjnego endpointu zwrócił 404 `NOT_FOUND`, więc ta stara funkcja nie jest zainstalowana w skonfigurowanym projekcie. Publikacja Vercel nie wdraża funkcji Supabase; osobne wdrożenie nie jest tu potrzebne. Usunięcie starego klucza z nowego pakietu klienta nie odwołuje wcześniej rozpowszechnionych kluczy u dostawcy.

## Deploy

Produkcja idzie na Vercel jako **prebuilt artifact** — zdalny `vercel build` czasem nie rejestruje części plików z `api/`, więc deploy robimy lokalnie:

```powershell
./deploy.ps1
# lub
npm run deploy:prod
```

Przed publikacją ustal docelową gałąź i commit oraz sprawdź konfigurację Git integration w Vercelu. Merge do `main` może uruchomić automatyczne wdrożenie; nie łącz go bez sprawdzenia tej zależności z osobnym ręcznym wydaniem. Weryfikuj, że alias produkcyjny wskazuje ten sam commit i pliki, które sprawdzono. Kontrola dostępu do danych jest opisana w sekcji „Dostęp bez logowania i bezpieczeństwo” oraz w raporcie audytu.

### Crony ([`vercel.json`](vercel.json))

| Endpoint | Harmonogram |
| --- | --- |
| `/api/scrape-uj-events` | codziennie 05:00 UTC |
| `/api/scrape-faculty-announcements` | 06:00, 14:00, 20:00 UTC |
| `/api/scrape-usos-registrations` | 06:15, 19:00 UTC |
| `/api/extract-usos-registrations` | 06:30 UTC |
| `/api/generate-briefings` | poniedziałek 06:00 UTC |
| `/api/scrape-discounts` | expire 03:00, scrape 04:00 UTC |

## Roadmap

- Synchronizacja zapisanych elementów i wyboru wydziału między urządzeniami (dla zalogowanych)
- Weryfikacja i wydanie „Nie przegap”, poradników i pilotażu kierunków — status w [raporcie audytu](docs/audit/2026-11-11-status.md)
- Badania użytecznych działań i powrotów po siedmiu dniach; wyniki dopiero po rzeczywistym pilotażu
- Godziny wydarzeń z podstron kalendarza UJ
- Web Push na bazie istniejących notyfikacji

## Autor

**Franciszek Dranka** — projekt osobisty, niezależny od UJ.

- Email: [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl)
- Repo: [github.com/tenkejj/ujverse](https://github.com/tenkejj/ujverse)

Licencja komercyjna, white-label i użycie poza podglądem kodu — kontakt z autorem. Szczegóły w [LICENSE](./LICENSE).

Copyright © 2026 Franciszek Dranka. Nazwa **UJverse** i logo są znakami autora (niezarejestrowane).
