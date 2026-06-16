<p align="center">
  <strong>Polski</strong> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="public/logo.png" alt="UJverse" width="140">
</p>

<h1 align="center">UJverse</h1>

<p align="center">
  Nieoficjalna platforma społecznościowa dla studentów i pracowników Uniwersytetu Jagiellońskiego.
</p>

<p align="center">
  <a href="https://ujverse.pl">ujverse.pl</a>
  ·
  <a href="mailto:franciszek.dranka@student.uj.edu.pl">franciszek.dranka@student.uj.edu.pl</a>
  ·
  <a href="./LICENSE">License</a>
</p>

---

UJverse to feed, wydarzenia, komunikaty wydziałowe i narzędzia studenckie w jednej aplikacji — bez algorytmów i bez szumu z ogólnopolskich sociali. Chronologiczny feed, dane z USOSweb i oficjalnych stron UJ, wyszukiwarka po całej treści.

Projekt nie jest powiązany z UJ, sponsorowany ani zatwierdzony przez uczelnię.

## Co jest w środku

**Feed** — posty, komentarze, lajki, tagi `#wydział`, filtr po wydziale, media w Supabase Storage, deep-linki `/thread/:id` i `/profile/:handle`.

**Wydarzenia** — wydarzenia użytkowników + oficjalne z `uj.edu.pl` (cron, scraper w [`api/scrape-uj-events.ts`](api/scrape-uj-events.ts)). RSVP, mapa (Leaflet), modal tworzenia.

**Komunikaty wydziałowe** — scraper 16 wydziałów + CM ([`api/scrape-faculty-announcements.ts`](api/scrape-faculty-announcements.ts)), 3 adaptery HTML, statusy (odwołane zajęcia, zdalnie, dyżury itd.).

**Mój Plan** (`/moj-plan`) — plan z USOSweb (import ICS), widok dnia i tygodnia, najbliższe egzaminy, tygodniowy briefing, komunikaty od subskrybowanych wykładowców.

**Rejestracje USOS** — live scraper publicznego katalogu rejestracji USOSweb UJ ([`api/scrape-usos-registrations.ts`](api/scrape-usos-registrations.ts)), alarmy przed końcem tur.

**Aula** — czaty kohortowe (rocznik/wydział): kanały, wiadomości realtime, reakcje, ankiety, załączniki, notatki i taski grupowe.

**Wyszukiwarka** — Meilisearch + InstantSearch, paleta Ctrl/Cmd+K, indeks users/posts/events/announcements, webhooki z Supabase, `npm run search:resync`.

**Asystent** — [`api/chat.ts`](api/chat.ts) na Vercel Edge (Groq), function calling po wydarzeniach/komunikatach/postach, cache KV, rate limiting.

**Wydziały i strefy** — grupy `/wydzialy/:slug`, `/strefy/:slug`, auto-routing postów po tagach.

**Znajdź salę** — przeszukiwanie budynków i sal UJ, trasy piesze do Google Maps.

**Miejsca nauki** — katalog bibliotek, kawiarni i miejsc do pracy w Krakowie, check-iny społeczności.

**Couponek UJ** (`/zniski`) — katalog zniżek studenckich, scraping + wpisy od użytkowników ([`api/scrape-discounts.ts`](api/scrape-discounts.ts)).

**Profile** — follow, badge'e z aktywności, zakładki (posty, odpowiedzi, media, wydarzenia), ustawienia prywatności.

**Niezbędnik** — skróty do USOSweb, PEGAZ, poczty studenckiej.

## Stack

| Warstwa | Technologie |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4, Framer Motion, React Router 7 |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Realtime) |
| API | Vercel serverless / Edge — chat, scrapery, sync wyszukiwarki |
| Search | Meilisearch |
| AI | Groq (`llama-3.1-8b-instant`), Vercel KV (cache + rate limit) |

Dane w UI idą przez [`DataService`](src/services/DataService.ts) i adaptery. Schemat bazy: [`supabase/migrations/`](supabase/migrations/).

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env.local   # jeśli masz szablon; inaczej uzupełnij ręcznie
npm run dev
```

```bash
npm run build          # produkcyjny build
npm run lint
npm run search:resync  # przebudowa indeksu Meilisearch
npm run chat:prewarm     # prewarm cache asystenta
```

### Zmienne środowiskowe

| Zmienna | Gdzie | Po co |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | klient | Supabase |
| `VITE_MEILI_HOST` / `VITE_MEILI_SEARCH_KEY` | klient | wyszukiwarka (read) |
| `SUPABASE_SERVICE_ROLE_KEY` | API | scrapery, narzędzia AI |
| `GROQ_API_KEY` | Edge | `/api/chat` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Edge | cache + rate limit |
| `MEILI_HOST` / `MEILI_ADMIN_KEY` | serverless | sync + resync |
| `CRON_SECRET` | cron | autoryzacja jobów |

## Deploy

Produkcja idzie na Vercel jako **prebuilt artifact** — zdalny `vercel build` czasem nie rejestruje części plików z `api/`, więc deploy robimy lokalnie:

```powershell
./deploy.ps1
# lub
npm run deploy:prod
```

Wyłącz auto-deploy z gita w ustawieniach projektu Vercel, żeby push nie nadpisał ręcznego deployu.

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

- Paginacja kursorowa feedu
- DM 1:1
- Zakładki / „zapisz na później"
- Streaming odpowiedzi asystenta token po tokenie
- Web Push na bazie istniejących notyfikacji

## Autor

**Franciszek Dranka** — projekt osobisty, niezależny od UJ.

- Email: [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl)
- Repo: [github.com/tenkejj/ujverse](https://github.com/tenkejj/ujverse)

Licencja komercyjna, white-label i użycie poza podglądem kodu — kontakt z autorem. Szczegóły w [LICENSE](./LICENSE).

Copyright © 2026 Franciszek Dranka. Nazwa **UJverse** i logo są znakami autora (niezarejestrowane).
