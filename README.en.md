<p align="center">
  <a href="README.md">Polski</a> · <strong>English</strong>
</p>

<p align="center">
  <img src="public/logo.png" alt="UJverse" width="140">
</p>

<h1 align="center">UJverse</h1>

<p align="center">
  Everything that matters at UJ, in one place.
</p>

<p align="center">
  <a href="https://ujverse.vercel.app/">ujverse.vercel.app</a>
  ·
  <a href="mailto:franciszek.dranka@student.uj.edu.pl">franciszek.dranka@student.uj.edu.pl</a>
  ·
  <a href="./LICENSE">License</a>
</p>

---

UJverse is an independent information hub for students of Jagiellonian University. It aggregates faculty announcements, USOSweb registrations and university events from official sources, lets you pick your faculty and search across it all — **without creating an account**. An account is only needed for personal features (timetable, Aula, community).

This project is not affiliated with, endorsed by, or sponsored by Jagiellonian University. Data is collected automatically from public UJ websites — always check the source for anything important.

## Available without an account

**Start** (`/`) — overview: "Ważne teraz" (registration deadlines and recently cancelled / remote classes for your faculty), latest announcements, upcoming registrations, UJ events, student essentials, saved items, and a note on sources and data freshness.

**Faculty selection** — takes seconds, no sign-up; stored in the browser (`localStorage`, key `ujverse.infoPrefs.v1`). Signed-in users get their profile faculty by default; a device-level choice never changes the profile.

**Announcements** (`/komunikaty`) — posts from 16 official faculty websites (last 30 days), type filters (cancelled classes, remote, office hours, events), full text on demand and a link to the original. AI summaries are labelled as AI.

**Registrations** (`/rejestracje`) — open and upcoming rounds from the public USOSweb catalogue, grouped by faculty (derived from the USOS unit code), times in Europe/Warsaw. Closed registrations are never shown as active.

**Events** (`/wydarzenia`) — university-wide events from the uj.edu.pl calendar (dates; times and venues in the source).

**Search** (`/szukaj`, Ctrl/Cmd+K) — announcements (Meilisearch with a safe database fallback), registrations, events and tools. Public search does not query profiles, posts or Aula.

**Essentials** (`/niezbednik`) — USOSweb, PEGAZ, email, registration catalogue, UJ calendar and UJverse tools (the room finder works without an account).

**Save for later** — bookmark announcements, registrations and events; the list lives on this device only.

## With a UJverse account

**My Plan** (`/moj-plan`), **Aula** (`/aula`), **registration alarms** (`/usos`), **assistant** (`/chat`), **discounts** (`/znizki`) and **study spots** (`/miejsca`). Visiting them without a session shows why an account is needed and a sign-in button; after signing in you return to the same page.

## Community (kept, secondary)

The feed moved from `/` to `/spolecznosc` and lives in the "Twoje konto" navigation group. Profiles, follows, `/thread/:id`, `/profile/:handle`, zones (`/wydzialy/:slug`, `/strefy/:slug`), community events with RSVP and calendar (`/events`), community search (`/search`) and notifications work as before. No data or tables were removed.

## Anonymous access and security

- Public views read only data copied by scrapers from public websites: `announcements`, `official_events`, and the `usos_registrations` rows that come from USOSweb (`source_usos_tura_id IS NOT NULL`). Community and seed rows remain visible to signed-in users only.
- Profiles, posts, comments, Aula messages, timetables, subscriptions and files stay behind RLS for authenticated users. The `anon` role gets no write access.
- The browser only ever uses the publishable/anon key; the service-role key stays in the API.

> **Required manual step before deploying:** apply
> [`supabase/migrations/20261104120000_public_information_read_access.sql`](supabase/migrations/20261104120000_public_information_read_access.sql)
> (Supabase SQL editor or `supabase db push`). Without it, visitors see announcements (public read already exists in production as a manual policy) but **registrations and events show as "temporarily unavailable"**. The migration is additive and idempotent; local policy test: `bash scripts/pivot-rls-check/run.sh`.

## Data sources and freshness

| Data | Source | Schedule (cron) | Meaning of the date in the UI |
| --- | --- | --- | --- |
| Announcements | 16 faculty websites ([`api/scrape-faculty-announcements.ts`](api/scrape-faculty-announcements.ts)) | 3× daily | "dodano" = first ingested by UJverse, not the publication date |
| Registrations | public USOSweb catalogue ([`api/scrape-usos-registrations.ts`](api/scrape-usos-registrations.ts)) | 2× daily | dates from USOSweb; "potwierdzone w USOSweb" = last scraper run |
| Events | uj.edu.pl calendar ([`api/scrape-uj-events.ts`](api/scrape-uj-events.ts)) | daily | event day; "sprawdzone" = last fetch |

Data is not real-time. If the registration scraper has not refreshed data for more than 36 h, the UI warns that it may be outdated and hides countdowns.

## Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4, Framer Motion, React Router 7, TanStack Query |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Realtime) |
| API | Vercel serverless / Edge — scrapers, chat, search sync |
| Search | Meilisearch |
| AI | Groq, Vercel KV (cache + rate limit) |

UI data flows through [`DataService`](src/services/DataService.ts) and adapters; the information layer is [`PublicInfoAdapter`](src/services/adapters/PublicInfoAdapter.ts) plus pure modules in [`src/lib/info/`](src/lib/info/). Schema: [`supabase/migrations/`](supabase/migrations/). Pivot docs: [`docs/pivot/`](docs/pivot/).

## Local development

```bash
npm install
cp .env.example .env.local   # set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

```bash
npm run build          # tsc (strict) + production build
npm run lint
npm test               # information-layer unit tests (node:test + tsx)
npm run search:resync  # rebuild Meilisearch index
npm run chat:prewarm   # prewarm assistant cache
bash scripts/pivot-rls-check/run.sh            # local RLS policy test (needs PostgreSQL)
node scripts/pivot-browser-checks/checks.mjs   # browser acceptance checks (see file header)
```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (alias `VITE_SUPABASE_ANON_KEY`) | client | Supabase |
| `VITE_MEILISEARCH_HOST` / `VITE_MEILISEARCH_SEARCH_KEY` / `VITE_MEILISEARCH_INDEX` | client | search (search-only key) |
| `SUPABASE_SERVICE_ROLE_KEY` | API | scrapers, AI tools |
| `GROQ_API_KEY` | Edge | `/api/chat` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Edge | cache + rate limit |
| `MEILI_HOST` / `MEILI_MASTER_KEY` | serverless | sync + resync |
| `CRON_SECRET` | cron | job authorization |

## Deploy

Production runs on Vercel as a **prebuilt artifact** — remote `vercel build` sometimes fails to register some `api/` files, so deploy locally:

```powershell
./deploy.ps1
# or
npm run deploy:prod
```

Disable git auto-deploy in Vercel project settings so pushes don't overwrite manual deploys. Apply the migration above before deploying this version.

### Crons ([`vercel.json`](vercel.json))

| Endpoint | Schedule |
| --- | --- |
| `/api/scrape-uj-events` | daily 05:00 UTC |
| `/api/scrape-faculty-announcements` | 06:00, 14:00, 20:00 UTC |
| `/api/scrape-usos-registrations` | 06:15, 19:00 UTC |
| `/api/extract-usos-registrations` | 06:30 UTC |
| `/api/generate-briefings` | Monday 06:00 UTC |
| `/api/scrape-discounts` | expire 03:00, scrape 04:00 UTC |

## Roadmap

- Sync saved items and faculty choice across devices (signed-in users)
- Meilisearch key restricted to the information index (see `docs/pivot/verification.md`)
- Event times from UJ calendar detail pages
- Web Push on top of existing notifications

## Author

**Franciszek Dranka** — personal project, independent of UJ.

- Email: [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl)
- Repo: [github.com/tenkejj/ujverse](https://github.com/tenkejj/ujverse)

Commercial licensing, white-label, and use beyond source review — contact the author. See [LICENSE](./LICENSE).

Copyright © 2026 Franciszek Dranka. The name **UJverse** and logo are the author's marks (unregistered).
