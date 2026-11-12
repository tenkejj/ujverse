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

The 11 November 2026 audit assessed deployed commit `1a29c24` from `codex/info-ui-research`. Current remediation status, verification evidence and production dependencies are recorded in the [pre-deploy audit snapshot](docs/audit/2026-11-11-status.md). Audit changes were prepared on `codex/audit-2026-11-11` for integration and authorized production publication. Current local verification passed: 150 tests in 39 suites, 34 browser checks, the frontend build, disposable public-RLS tests and 9 Aula assertion groups. The [detailed Polish release summary](docs/audit/2026-11-12-release-summary.md) separates those results, the user-confirmed Aula migration and deployment status. Check Vercel history and the final user report for the actual deployed commit; historical pivot results remain separate.

## Available without an account

**Start** (`/`) — “Nie przegap” comes first: registrations and recent class changes with an official source, next action and local “Sprawdzone” acknowledgement. Guides, compact Versuś assistance, announcements, registrations, calendar, saved items and data freshness follow. Checking an item does not enroll you or complete a university procedure.

**Faculty selection** — takes seconds, no sign-up; stored in the browser (`localStorage`, key `ujverse.infoPrefs.v1`). Signed-in users get their profile faculty by default; a device-level choice never changes the profile.

**Programme pilot** — device-local selection of Elektroniczne przetwarzanie informacji (WZiKS) or Filozofia (Faculty of Philosophy), first / second degree and year. Both verified full-time programmes last 3 / 2 years respectively. Current announcement and registration records lack verified programme, degree or year audiences, so information remains faculty-wide. [Scope and sources](docs/design/study-profile-pilot.md).

**Guides** (`/poradniki`) — rector’s scholarship, dormitory applications and USOS registrations: applicability, preparation, steps, official deadline/status information and contacts. Sources were checked on 11 November 2026; progress stays on this device. The dormitory guide identifies a separate CM procedure. Direct routes: `/poradniki/stypendium-rektora`, `/poradniki/akademik`, `/poradniki/rejestracje-usos`.

**Announcements** (`/komunikaty`) — posts from 16 official faculty websites (last 30 days), type filters (cancelled classes, remote, office hours, events), full text on demand and a link to the original. AI summaries are labelled as AI.

**Registrations** (`/rejestracje`) — open and upcoming rounds from the public USOSweb catalogue, grouped by faculty (derived from the USOS unit code), times in Europe/Warsaw. Closed registrations are never shown as active.

**Events** (`/wydarzenia`) — university-wide events from the uj.edu.pl calendar (dates; times and venues in the source).

**Search** (`/szukaj`, Ctrl/Cmd+K) — announcements, registrations, events and tools. Public search does not query profiles, posts or Aula. Supabase reads are subject to server-enforced RLS; private search uses the user's session.

**Essentials** (`/niezbednik`) — USOSweb, PEGAZ, email, registration catalogue, UJ calendar and UJverse tools (the room finder works without an account).

**Save for later** — bookmark announcements, registrations and events; the list lives on this device only.

**Versuś** (`/chat`) — an AI assistant for university information, also available without signing in. It uses GPT-OSS models hosted by Groq and UJverse data. The “O Versusiu” disclosure explains models, sources, transmitted data and limitations. Personal timetable and account tools require a verified session. Some simple questions use ready replies without a model call, including matched procedural questions with guide/official-source links; these replies do not determine individual eligibility.

**Optional pilot measurement** — the “Pomóż sprawdzić UJverse” panel requires explicit opt-in. It retains visit days, source-opening counts and task timings on this device for up to 28 days. Participants can download or delete the JSON report; nothing is transmitted automatically. A recorded click does not establish source correctness or completion of a university procedure. [Research materials](docs/research/README.md) are ready for recruitment; there are no participants, completed interviews or measured retention yet.

## With a UJverse account

**My Plan** (`/moj-plan`), **Aula** (`/aula`), **registration alarms** (`/usos`), **discounts** (`/znizki`) and **study spots** (`/miejsca`). Visiting them without a session shows why an account is needed and a sign-in button; after signing in you return to the same page. `/settings` exposes device preferences to guests and account settings after authentication.

## Community (kept, secondary)

The feed moved from `/` to `/spolecznosc` and lives in the "Twoje konto" navigation group. Profiles, follows, `/thread/:id`, `/profile/:handle`, zones (`/wydzialy/:slug`, `/strefy/:slug`), community events with RSVP and calendar (`/events`), community search (`/search`) and notifications work as before. No data or tables were removed.

## Anonymous access and security

- Public views read only data copied by scrapers from public websites: `announcements`, `official_events`, and the `usos_registrations` rows that come from USOSweb (`source_usos_tura_id IS NOT NULL`). Community and seed rows remain visible to signed-in users only.
- Profiles, posts, Aula messages and account data must be authorized by Supabase RLS independently of interface filters. Hiding a link or filtering a cohort in the browser is not an authorization boundary.
- The Supabase client uses a publishable/anon key and the available session; service-role credentials stay in the API. Browser search must not receive a Meilisearch key that grants access to private indexes.

> **Deployment dependency to verify:** the repository contains
> [`supabase/migrations/20261104120000_public_information_read_access.sql`](supabase/migrations/20261104120000_public_information_read_access.sql)
> with narrowly scoped public `SELECT` policies. Read-only production checks on 12 November confirmed anonymous access to all three public domains and no visible non-USOS registrations, Aula messages, timetable entries or notifications where administrative checks confirmed data exists. These reads do not establish exact remote policy definitions or isolation between signed-in cohorts; those checks remain open in the audit report. On 12 November the user confirmed successful execution of `20261112120000_aula_scope_integrity.sql` in Supabase SQL Editor; the agent has not independently inspected the remote policy catalog. Local migration check: `bash scripts/pivot-rls-check/run.sh`; record local and production evidence separately.

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
| Search | Supabase/PostgREST + RLS; optional server-side Meilisearch index synchronization |
| AI | Groq, Vercel KV (cache + rate limit) |

UI data flows through [`DataService`](src/services/DataService.ts) and adapters; the information layer is [`PublicInfoAdapter`](src/services/adapters/PublicInfoAdapter.ts) plus pure modules in [`src/lib/info/`](src/lib/info/). Schema: [`supabase/migrations/`](supabase/migrations/). Pivot docs: [`docs/pivot/`](docs/pivot/).

## Local development

```bash
npm ci
cp .env.example .env.local   # set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

```bash
npm run build          # tsc (strict) + production build
npm run lint
npm test               # information-layer unit tests (node:test + tsx)
npm run chat:prewarm   # prewarm assistant cache
bash scripts/pivot-rls-check/run.sh            # local RLS policy test (needs PostgreSQL)
bash scripts/aula-security-check/run.sh       # local Aula isolation/integrity assertions
node scripts/audit-browser-checks.mjs          # current flows; Chrome/Playwright setup in file header
```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (alias `VITE_SUPABASE_ANON_KEY`) | client | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | API | scrapers, AI tools |
| `GROQ_API_KEY` | Edge | `/api/chat` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Edge | cache + rate limit |
| `MEILI_HOST` / `MEILI_MASTER_KEY` | serverless | optional sync + resync; never in `VITE_*` or browser code |
| `SEARCH_INDEX_SYNC_ENABLED` | serverless | explicitly enable optional public-announcement synchronization; off by default |
| `MEILI_PUBLIC_INDEX` | serverless | separate public index; defaults to `ujverse_public_information` |
| `CRON_SECRET` | cron | job authorization |

Application search uses bounded database text queries and does not depend on Meilisearch availability. It currently lacks the old index's typo tolerance. Optional synchronization covers public announcements only; it does not recreate profile, post or Aula indexes. Check its configuration separately from Supabase reads. Supabase `sync-search` compatibility source was also updated; its production endpoint returned 404 `NOT_FOUND`, confirming the legacy function is not installed in the configured project. Vercel does not deploy Supabase functions; no separate rollout is needed there. Removing an old key from a new client bundle does not revoke previously distributed keys at the provider.

## Deploy

Production runs on Vercel as a **prebuilt artifact** — remote `vercel build` sometimes fails to register some `api/` files, so deploy locally:

```powershell
./deploy.ps1
# or
npm run deploy:prod
```

Before publishing, establish the intended branch and commit and inspect Vercel Git integration. Merging `main` may trigger an automatic deployment; check that dependency before combining it with a separate manual release. Verify that production aliases serve the commit and artifacts that were checked. Data-access requirements are documented above and in the audit report.

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
- Verification and release of actionable deadlines, guides and the programme pilot — status in the [audit report](docs/audit/2026-11-11-status.md)
- Useful-action and seven-day return research; results only after an actual student pilot
- Event times from UJ calendar detail pages
- Web Push on top of existing notifications

## Author

**Franciszek Dranka** — personal project, independent of UJ.

- Email: [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl)
- Repo: [github.com/tenkejj/ujverse](https://github.com/tenkejj/ujverse)

Commercial licensing, white-label, and use beyond source review — contact the author. See [LICENSE](./LICENSE).

Copyright © 2026 Franciszek Dranka. The name **UJverse** and logo are the author's marks (unregistered).
