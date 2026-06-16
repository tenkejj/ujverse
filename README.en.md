<p align="center">
  <a href="README.md">Polski</a> · <strong>English</strong>
</p>

<p align="center">
  <img src="public/logo.png" alt="UJverse" width="140">
</p>

<h1 align="center">UJverse</h1>

<p align="center">
  An unofficial social platform for students and staff at Jagiellonian University.
</p>

<p align="center">
  <a href="https://ujverse.vercel.app/">ujverse.vercel.app</a>
  ·
  <a href="mailto:franciszek.dranka@student.uj.edu.pl">franciszek.dranka@student.uj.edu.pl</a>
  ·
  <a href="./LICENSE">License</a>
</p>

---

UJverse bundles a feed, events, faculty announcements, and student tools in one app — no algorithms, no noise from mainstream social media. Chronological feed, data from USOSweb and official UJ sources, full-text search across all content.

This project is not affiliated with, endorsed by, or sponsored by Jagiellonian University.

## What's inside

**Feed** — posts, comments, likes, `#faculty` tags, department filter, media in Supabase Storage, deep links at `/thread/:id` and `/profile/:handle`.

**Events** — user-created events plus official ones from `uj.edu.pl` (cron, scraper in [`api/scrape-uj-events.ts`](api/scrape-uj-events.ts)). RSVP, map (Leaflet), create-event modal.

**Faculty announcements** — scraper for 16 faculties + Collegium Medicum ([`api/scrape-faculty-announcements.ts`](api/scrape-faculty-announcements.ts)), 3 HTML adapters, status badges (cancelled classes, remote teaching, office hours, etc.).

**My Plan** (`/moj-plan`) — timetable from USOSweb (ICS import), day and week views, upcoming exams, weekly briefing, updates from subscribed lecturers.

**USOS registrations** — live scraper of the public USOSweb UJ registration catalog ([`api/scrape-usos-registrations.ts`](api/scrape-usos-registrations.ts)), alerts before rounds close.

**Aula** — cohort chat (year/faculty): channels, realtime messages, reactions, polls, attachments, group notes and tasks.

**Search** — Meilisearch + InstantSearch, Ctrl/Cmd+K palette, index over users/posts/events/announcements, Supabase webhooks, `npm run search:resync`.

**Assistant** — [`api/chat.ts`](api/chat.ts) on Vercel Edge (Groq), function calling over events/announcements/posts, KV cache, rate limiting.

**Faculties & zones** — groups at `/wydzialy/:slug`, `/strefy/:slug`, auto-routing posts by tags.

**Room finder** — search UJ buildings and rooms, walking directions to Google Maps.

**Study spots** — catalog of libraries, cafés, and workspaces in Kraków, community check-ins.

**Couponek UJ** (`/zniski`) — student discount catalog, scraping plus user submissions ([`api/scrape-discounts.ts`](api/scrape-discounts.ts)).

**Profiles** — follow, activity badges, tabs (posts, replies, media, events), privacy settings.

**Essentials** — quick links to USOSweb, PEGAZ, student email.

## Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4, Framer Motion, React Router 7 |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Realtime) |
| API | Vercel serverless / Edge — chat, scrapers, search sync |
| Search | Meilisearch |
| AI | Groq (`llama-3.1-8b-instant`), Vercel KV (cache + rate limit) |

UI data flows through [`DataService`](src/services/DataService.ts) and adapters. Database schema: [`supabase/migrations/`](supabase/migrations/).

## Local development

```bash
npm install
cp .env.example .env.local   # if you have a template; otherwise fill in manually
npm run dev
```

```bash
npm run build          # production build
npm run lint
npm run search:resync  # rebuild Meilisearch index
npm run chat:prewarm   # prewarm assistant cache
```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | client | Supabase |
| `VITE_MEILI_HOST` / `VITE_MEILI_SEARCH_KEY` | client | search (read) |
| `SUPABASE_SERVICE_ROLE_KEY` | API | scrapers, AI tools |
| `GROQ_API_KEY` | Edge | `/api/chat` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Edge | cache + rate limit |
| `MEILI_HOST` / `MEILI_ADMIN_KEY` | serverless | sync + resync |
| `CRON_SECRET` | cron | job authorization |

## Deploy

Production runs on Vercel as a **prebuilt artifact** — remote `vercel build` sometimes fails to register some `api/` files, so deploy locally:

```powershell
./deploy.ps1
# or
npm run deploy:prod
```

Disable git auto-deploy in Vercel project settings so pushes don't overwrite manual deploys.

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

- Cursor-based feed pagination
- 1:1 DMs
- Bookmarks / save for later
- Token-by-token assistant streaming
- Web Push on top of existing notifications

## Author

**Franciszek Dranka** — personal project, independent of UJ.

- Email: [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl)
- Repo: [github.com/tenkejj/ujverse](https://github.com/tenkejj/ujverse)

Commercial licensing, white-label, and use beyond source review — contact the author. See [LICENSE](./LICENSE).

Copyright © 2026 Franciszek Dranka. The name **UJverse** and logo are the author's marks (unregistered).
