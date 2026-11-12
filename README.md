<p align="center">
  <strong>Polski</strong> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="public/logo.png" alt="UJverse" width="140">
</p>

<h1 align="center">UJverse</h1>

<p align="center">Komunikaty, terminy i pomoc w sprawach studenckich na UJ.</p>

<p align="center">
  <a href="https://ujverse.vercel.app/">Otwórz UJverse</a> ·
  <a href="https://github.com/tenkejj/ujverse">GitHub</a> ·
  <a href="LICENSE">Licencja</a>
</p>

UJverse to niezależny serwis dla studentów Uniwersytetu Jagiellońskiego. Łączy informacje z oficjalnych stron uczelni z asystentem Versusiem, wyszukiwarką i narzędziami studenckimi. Komunikaty, rejestracje, wydarzenia i poradniki są dostępne **bez zakładania konta**.

Projekt nie jest powiązany z UJ ani zatwierdzony przez uczelnię. Ważne terminy i zasady potwierdzaj w podlinkowanym źródle.

## Co znajdziesz w serwisie

| Funkcja | Co oferuje | Adres |
| --- | --- | --- |
| Start | Wejście do rozmowy z Versusiem, podgląd informacji z uczelni, kalendarz i zapisane elementy | `/` |
| Versuś | Rozmowa o komunikatach, zapisach, wydarzeniach i sprawach studenckich | `/chat` |
| Komunikaty | Ogłoszenia wydziałów, filtry rodzaju, treść i odnośnik do oryginału | `/komunikaty` |
| Rejestracje | Trwające i nadchodzące tury z publicznego katalogu USOSweb | `/rejestracje` |
| Wydarzenia | Kalendarz, wybór dnia i wydarzenia ogólnouczelniane | `/wydarzenia` |
| Wyszukiwanie | Wspólne wyszukiwanie informacji, poradników i narzędzi | `/szukaj` |
| Poradniki | Sprawy studenckie krok po kroku: finanse, studia, codzienność i wsparcie | `/poradniki` |
| Niezbędnik | USOSweb, PEGAZ, poczta i pozostałe przydatne odnośniki | `/niezbednik` |
| Znajdź salę | Wyszukiwanie sal i budynków | `/sale` |

Wydział wybierzesz w widocznym selektorze w nagłówku. Wybór i zapisane informacje zostają w przeglądarce; nie zmieniają danych konta. Dostępne są motywy jasny, ciemny i UJ oraz ustawienia pod `/settings`.

Poradniki są podzielone na finanse, studia, codzienność i wsparcie. Wybierz kategorię lub wyszukaj temat, sprawdź krótkie podsumowanie i otwieraj kolejne kroki. Każda procedura wskazuje termin, przygotowanie, kontakt oraz oficjalne źródło. Lokalne oznaczenia postępu nie zastępują wykonania czynności w serwisie uczelni.

### Funkcje po zalogowaniu

- **Mój Plan** (`/moj-plan`) — import planu z USOSweb przez ICS, dzień i tydzień, egzaminy oraz briefing.
- **Aula** (`/aula`) — kanały rocznika, wiadomości, reakcje, ankiety, załączniki, notatki i zadania.
- **Społeczność** (`/spolecznosc`) — wpisy, komentarze, profile, obserwowanie i wydarzenia społeczności.
- **Alarmy rejestracji** (`/usos`) — przypomnienia przed turami i informacje dodawane przez społeczność.
- **Couponek UJ** (`/znizki`), **Miejsca do nauki** (`/miejsca`) i **Powiadomienia** (`/notifications`).

Próba wejścia do funkcji osobistej bez sesji prowadzi do logowania z możliwością powrotu do wybranego widoku. Lokalne preferencje w ustawieniach są dostępne bez konta; ustawienia konta wymagają sesji.

## Versuś

Versuś korzysta z danych UJverse i modeli GPT-OSS uruchamianych przez **Groq**. Domyślna konfiguracja to GPT-OSS 20B do lżejszych zadań i układania odpowiedzi oraz GPT-OSS 120B do pracy z szerszym zestawem narzędzi. Modele można zmienić zmiennymi serwerowymi.

Proste pytania, w tym część pytań o procedury, otrzymują gotową odpowiedź bez dodatkowego wywołania modelu. Gdy model jest potrzebny, do Groq trafiają pytanie, potrzebny fragment rozmowy i dane użyte do odpowiedzi. Panel „O Versusiu” opisuje źródła, działanie i ograniczenia asystenta.

Pytania o informacje publiczne nie wymagają logowania. Odczyt zapisanego planu i innych danych konta wymaga zweryfikowanej sesji. Versuś nie wykonuje formalności w USOS i nie przeszukuje całego internetu przy każdym pytaniu. Odpowiedzi mogą zawierać błędy lub opierać się na opóźnionych danych.

## Źródła i aktualność danych

| Dane | Źródło | Planowane pobieranie |
| --- | --- | --- |
| Komunikaty | Oficjalne strony wydziałów UJ | 06:00, 14:00 i 20:00 UTC |
| Rejestracje | Publiczny katalog USOSweb | 06:15 i 19:00 UTC |
| Wydarzenia | Kalendarz na uj.edu.pl | 05:00 UTC |

Harmonogramy definiuje [vercel.json](vercel.json). Pobieranie nie odbywa się na żywo; harmonogram nie gwarantuje udanego odświeżenia. Daty w interfejsie są prezentowane w strefie Europe/Warsaw. Serwis rozróżnia dodanie komunikatu, potwierdzenie terminu rejestracji i pobranie wydarzenia. Przy nieaktualnych danych rejestracji pokazuje ostrzeżenie i ukrywa odliczanie.

## Technologia i struktura

| Warstwa | Technologie |
| --- | --- |
| Interfejs | React 19, TypeScript, Vite 7, Tailwind CSS 4, Framer Motion, Lucide |
| Nawigacja i dane | React Router 7, TanStack Query, Zustand |
| Baza i konto | Supabase: PostgreSQL, RLS, Auth, Storage, Realtime |
| API i zadania cykliczne | Vercel Functions, Edge i Cron |
| Asystent | Groq, pamięć podręczna i limity z użyciem Vercel KV |
| Wyszukiwanie | Ograniczone zapytania Supabase/PostgREST z uprawnieniami bieżącej sesji |

```text
src/components/       widoki i współdzielone elementy interfejsu
src/hooks/            pobieranie danych i preferencje
src/lib/info/         logika informacji i poradników
src/services/         DataService, adaptery i klient asystenta
api/                  czat, scrapery i funkcje serwerowe
supabase/migrations/  schemat bazy i polityki dostępu
scripts/              narzędzia utrzymania
public/               logo, maskotka i pozostałe zasoby
```

## Uruchomienie lokalne

Wymagania: **Node.js 24**, npm oraz dostęp do skonfigurowanego projektu Supabase. Instrukcje dotyczą właściciela projektu i uprawnionych współpracowników; warunki użycia kodu określa [LICENSE](LICENSE).

```bash
git clone https://github.com/tenkejj/ujverse.git
cd ujverse
npm ci
cp .env.example .env.local
```

W `.env.local` ustaw adres projektu i jego **publiczny** klucz Supabase:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Akceptowana jest też starsza nazwa `VITE_SUPABASE_ANON_KEY`. Baza musi mieć schemat i polityki dostępu z [migracji](supabase/migrations/). Samo skopiowanie przykładowych wartości nie podłącza danych.

```bash
npm run dev
```

Otwórz **http://localhost:5173**. Jeśli port jest zajęty, użyj adresu wypisanego w terminalu. Ten tryb uruchamia frontend Vite i odczyty Supabase; **nie uruchamia funkcji z `api/`**.

Do lokalnego działania czatu i pozostałego API uzupełnij zmienne serwerowe, zaloguj i podłącz Vercel CLI do projektu, a następnie zamiast samego Vite uruchom:

```bash
npx vercel dev --listen 3000
```

Otwórz **http://localhost:3000**. Klient czatu w trybie deweloperskim domyślnie korzysta z API pod tym adresem; inne położenie API czatu można ustawić przez `VITE_API_BASE_URL`.

### Konfiguracja środowiska

Punkt wyjścia stanowi [.env.example](.env.example). Sekrety przechowuj w `.env.local` albo w ustawieniach środowiska Vercel.

| Zmienna | Zastosowanie |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Publiczna konfiguracja klienta |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Serwerowy dostęp do Supabase dla funkcji API |
| `GROQ_API_KEY` | Dostęp API czatu do Groq |
| `GROQ_MODEL`, `GROQ_SMALLTALK_MODEL` | Opcjonalna zmiana modeli asystenta |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Współdzielona pamięć podręczna i limity |
| `CRON_SECRET` | Autoryzacja zadań cyklicznych |
| `SECRET_WEBHOOK_KEY` | Autoryzacja webhooka synchronizacji |

Zmienne `VITE_*` trafiają do przeglądarki. Nigdy nie umieszczaj w nich klucza service-role, klucza Groq ani innych sekretów. Wyszukiwanie działa przez Supabase i nie wymaga Meilisearch; opcjonalna serwerowa synchronizacja publicznych komunikatów jest domyślnie wyłączona.

### Przydatne polecenia

```bash
npm run build    # kontrola TypeScript i produkcyjny build frontendu
npm run preview  # lokalny podgląd gotowego frontendu
npm test         # testy modułów aplikacji
```

`npm run preview` również nie uruchamia API. Sprawdzenie polityk dostępu na tymczasowej lokalnej bazie PostgreSQL opisują [skrypt publicznego RLS](scripts/pivot-rls-check/run.sh) i [kontrola Auli](scripts/aula-security-check/README.md).

## Publikacja na Vercel

Projekt publikuje się jako **prebuilt**, aby dostarczyć razem frontend i komplet funkcji API. Po zalogowaniu do Vercel CLI i wskazaniu właściwego konta:

```bash
npx vercel link
npx vercel pull --yes --environment=production
npm run deploy:prod
```

Dostępny jest też skrypt PowerShell [deploy.ps1](deploy.ps1). Migracje bazy stosuje się oddzielnie w Supabase; publikacja Vercel ich nie wykonuje. Zmienne serwerowe muszą być ustawione w docelowym środowisku Vercel.

## Prywatność i dostęp

Publiczne strony korzystają z danych uczelni. Plan, wiadomości Auli i inne dane osobiste wymagają sesji oraz uprawnień bazy/API. Polityki RLS wymuszają dostęp niezależnie od widoczności przycisków i filtrów interfejsu.

Wybór wydziału, zapisane elementy i postęp poradników przechowuje przeglądarka. Opcjonalny pomiar „Pomóż sprawdzić UJverse” wymaga osobnej zgody, pozostaje na urządzeniu do 28 dni i umożliwia eksport lub usunięcie danych. Nie wysyła raportu automatycznie. Ogólna analityka witryny jest odrębnym mechanizmem.

## Autor i licencja

**Franciszek Dranka** · [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl)

Kod jest udostępniony do wglądu na warunkach [licencji własnościowej](LICENSE), nie jako projekt open source. Inne wykorzystanie, licencja komercyjna lub white-label wymagają kontaktu z autorem.

Copyright © 2026 Franciszek Dranka. Nazwa UJverse i logo są znakami autora.
