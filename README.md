# UJverse

> Author: **Franciszek Dranka** &nbsp;·&nbsp; Contact: [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl) &nbsp;·&nbsp; Copyright © 2026 — All Rights Reserved (see [LICENSE](./LICENSE)).

UJverse is a modern, real-time social platform designed exclusively for the academic community of Uniwersytet Jagielloński. It bundles a Twitter-style feed, an AI assistant grounded in live university data, an aggregated events hub (with daily scraping of official UJ sources), a Meilisearch-powered omni-search, faculty/zone groups and a curated "Niezbędnik UJ" — all behind a single, premium glass-themed UI.

The application is built with a strong focus on performance, real-time data synchronization, and a premium user experience, bridging the gap between outdated university forums and noisy mainstream social media.

## Project Vision & Motivation

The primary goal of UJverse is to centralize academic discourse in a distraction-free environment. Traditional social networks are heavily algorithm-driven and saturated with unrelated content, making it difficult for students to find critical university updates, share notes, or discuss faculty-specific topics.

UJverse solves this by offering a tailored, chronological ecosystem where the community identity is at the forefront. Every feature is designed to facilitate quick information retrieval and meaningful academic interaction.

## Core Features

### Social feed
* **Real-time feed & interactions** — posts, comments, likes and comment-likes synchronized instantly across all connected clients via Supabase Realtime channels.
* **Optimistic UI** — likes, comment submissions and replies render immediately, with rollback on server failure (no full re-fetch on success).
* **Recursive comment threads** — `parent_id` chains with cascade-delete client logic and explicit "reply to @user" targeting.
* **Smart Tags** — `#hashtags` are extracted from post bodies on insert, indexed in `post_tags`, and routed automatically to faculty group feeds (e.g. `#wmii` → Wydział Matematyki i Informatyki).
* **Department filter on the feed** — single-click filter by canonical UJ faculty.
* **Media handling** — secure uploads to Supabase Storage, in-memory image cropping (`react-easy-crop`), and a portal-based full-screen Lightbox that escapes CSS stacking contexts.
* **Per-post tags & deep-links** — dedicated `/thread/:id` views for sharing single posts, and `/profile/:handle` for permalinkable user pages.

### Events hub
* **Aggregated events** — a single `EventsView` mixes user-created events with **official UJ events scraped daily** from `www.uj.edu.pl/wiadomosci`, `www.uj.edu.pl/kalendarz` and (when reachable) WZiKS feeds. Scraping runs on a Vercel cron at `0 5 * * *` via [`api/scrape-uj-events.ts`](api/scrape-uj-events.ts) and upserts into `public.official_events`.
* **WZiKS Official Hub** — horizontal carousel of the freshest official UJ items at the top of the events page.
* **RSVP system** — one-click "Idę / Nie idę" with `event_rsvps` table, attendee counters, and an attendees modal.
* **Event modal with map** — Leaflet-based `LocationPicker` for venues, plus structured location/date display.
* **Create-event flow** — students can publish their own events with image, date, venue and description.
* **Lecturer announcements (ISI UJ)** — separate scraper [`api/scrape-wziks.ts`](api/scrape-wziks.ts) feeds `announcements` (cancellations, remote classes, office hours) with status badges and a dedicated drawer view.

### AI Assistant ("UJverse Asystent")
* **Edge-runtime LLM proxy** — [`api/chat.ts`](api/chat.ts) on Vercel Edge, talking to **Groq** (`llama-3.1-8b-instant`) via OpenAI-compatible Function Calling. The client (`ContextInjectedBielikAdapter`) parses the SSE stream identically for cached and live responses.
* **Function Calling tools (RAG-Lite)** — three server-side tools wired to Supabase Admin: `search_events`, `get_latest_announcements`, `get_latest_posts`. Single-shot tool flow: classification → execute → server-formatted markdown answer (no second LLM round-trip for synthesis, ~50% fewer Groq calls).
* **Vercel KV response cache** — 300s distributed cache keyed by normalized user message + tool-policy. Cross-instance survival of cold starts and identical questions short-circuit Groq *and* Supabase.
* **Per-tool cache** — independent KV cache for each tool with its own TTL (e.g. 30 s for posts, longer for announcements).
* **Small-talk throttle** — greetings/thanks/short ack patterns skip tools entirely (saves input tokens and prevents Supabase round-trips for "cześć").
* **Token budgeting & rate limiting** — history pruned to last 10 messages, hard 4000-char cap per message, per-user/IP token-bucket rate limiter, graceful 429 degradation as a friendly SSE message instead of a HTTP error.
* **Markdown Guard & think-tag stripping** — defensive output sanitizer that rewrites leaked tool-call JSON or `<think>` reasoning blocks before the user sees them.
* **Animated bot UX** — `ChatAssistantFab` floating action button + `ChatHubView` full-screen experience with typewriter markdown rendering and prewarm script (`npm run chat:prewarm`).

### Search (Meilisearch + InstantSearch)
* **OmniSearchHub (desktop)** — Ctrl/Cmd+K palette with debounced search-as-you-type (180 ms), multi-section results (users, posts, announcements, events), keyboard navigation, recent-search history, smart hints fallback, and slash-commands (`/p`, `/k`, `/ciemny`, `/jasny`).
* **Mobile full-screen `SearchBar`** — touch-optimized variant of the same data layer.
* **Unified content index** — Supabase database webhooks ([`supabase/migrations/20260520120000_unified_search_webhooks.sql`](supabase/migrations/20260520120000_unified_search_webhooks.sql) etc.) push posts, events and announcements to Meilisearch on every mutation, with the webhook URL stored as a dynamic `app_settings` row so dev/staging/prod can diverge without redeploys.
* **Resync tooling** — `npm run search:resync` (tsx) for rebuilding the index from scratch when schemas drift.

### Faculty groups & zones (Wydziały / Strefy)
* **Auto-routing of posts** — when a post tag matches a known faculty slug, a Postgres trigger ([`20260602120000_post_tags_group_trigger.sql`](supabase/migrations/20260602120000_post_tags_group_trigger.sql)) attaches it to the correct group.
* **Group pages** — `/wydzialy/:slug` and `/strefy/:slug` with member counts, joined-state, and the same post UX as the feed.
* **Trending groups widget** — sidebar surface that highlights active wydziały + strefy.

### Profiles
* **Public profiles** — `/profile/:handle` resolves shadow-login usernames to full profiles with bio, banner, avatar, faculty accent.
* **Profile tabs** — Posts, Replies (RPC-backed engagement snapshot), Media gallery, Attending Events.
* **Badge dock** — soft, non-gamified badges (e.g. "Aktywny komentator", "Bywalec wydarzeń", "Zasłużony") computed from real activity counts.
* **Follow system** — `follows` table with strict RLS, optimistic toggle with rollback, follower/following modal, and Realtime subscription on `public.follows` for live counts.
* **Privacy flags** — `is_searchable` (opt-out of Meili user index) and `show_department` (hide your faculty publicly) wired through Settings → Profile sync.

### Notifications
* **Real-time notification center** — `notifications` table with strict RLS for `auth.uid()` only, INSERT subscription that triggers a sound ping + bell-ring animation.
* **Read/unread persistence** — server-side state via `markRead`, `markAllRead`, `clearAll` RPCs in `NotificationsAdapter`.
* **Anchor-positioned popup + dedicated `/notifications` page** — same data, two presentation modes.

### Settings
* **Visual preferences** — light/dark theme, motion reduction, density, notification sound on/off, persisted via `userPreferences`.
* **Account management** — username (after manual claim), email, password reset (with `/reset-password` flow tied to Supabase recovery), local search-history clearing.
* **Privacy controls** — toggles for `is_searchable` and `show_department`, with optimistic profile-patch propagation back to `App`.

### Mobile
* **MobileDashboard** — touch-first home screen combining Niezbędnik + Strefy + Wydziały in a single horizontally pannable surface.
* **Mobile compose sheet** — bottom-sheet composer with spring physics (Framer Motion) and safe-area aware padding.
* **MobileQuickAccessBar + BottomNav** — icon-only navigation tuned for thumbs.

### Niezbędnik UJ
* Permanent quick-links to USOSweb, PEGAZ and student email — a dedicated card on desktop sidebar and a row inside `MobileDashboard`.

### Moderation & abuse handling
* **Reports** — `ReportModal` flow, `is_banned` flag on profiles fully filters the feed/search results.
* **Admin gate** — `is_profile_admin()` (reads `profiles.role = 'admin'`) drives comment-delete RLS policy.

## Tech Stack & Architecture

### Frontend
* **React 19** with Hooks, lazy + Suspense for chat/AI bundles.
* **TypeScript 5.9** (`nodenext`) for end-to-end type safety.
* **Vite 7** for dev server, HMR and optimized production builds.
* **Tailwind CSS v4** — CSS-first theming via `@theme` and CSS variables in [`src/index.css`](src/index.css), theme class on `<html>` driven by `ThemeContext`.
* **React Router DOM 7** — hybrid model (no global `<Routes>` table; `useLocation` + `navigate` + `parseAppRoute` in `App.tsx`).
* **Framer Motion 12** for transitions, sheets, hero animations.
* **Lucide React** + **Heroicons** for iconography.
* **Zustand** for narrow client stores (chat, omni-search), **Zod** for runtime validation.
* **react-instantsearch** + **@meilisearch/instant-meilisearch** for search UI.
* **react-leaflet / Leaflet** for event map picker.
* **react-markdown + remark-gfm** for safe markdown rendering of AI/announcement content.
* **react-easy-crop** for avatar/banner cropping.
* **react-hot-toast** (wrapped in `lib/appToast`) for toasts.

### Backend & infra
* **Supabase** — PostgreSQL with Row Level Security, Auth (email-based shadow login: `<username>@ujverse.test`), Storage (`media` bucket), and Realtime channels for posts/likes/comments/notifications/follows.
* **Vercel serverless / Edge functions** —
  * [`api/chat.ts`](api/chat.ts) — Edge runtime, AI orchestrator with Function Calling.
  * [`api/scrape-uj-events.ts`](api/scrape-uj-events.ts) — Node serverless cron (daily 05:00 UTC), Cheerio-based HTML scraping.
  * [`api/scrape-wziks.ts`](api/scrape-wziks.ts) — Node serverless, ISI UJ announcements scraper.
  * [`api/sync-search.ts`](api/sync-search.ts) — Meilisearch sync webhook target.
* **Vercel KV (Upstash Redis)** — distributed response and per-tool cache for the AI assistant, + per-IP/user rate limiting buckets.
* **Meilisearch** — typo-tolerant full-text search across users, posts, events, announcements; populated via Supabase database webhooks pointing at `/api/sync-search`.
* **Groq Cloud** — LLM provider for the AI assistant (`llama-3.1-8b-instant` by default, OpenAI-compatible API).

### Architecture conventions
* **DataService facade** ([`src/services/DataService.ts`](src/services/DataService.ts)) — single touch point between UI and data sources; adapters for posts, announcements, clubs, events, notifications.
* **Adapters pattern** — swap a data source (e.g. clubs from local mock → Supabase) without touching components.
* **Migrations as the contract** — [`supabase/migrations/`](supabase/migrations/) is the versioned source of truth for the database schema and RLS; `supabase_setup.sql` is bootstrap-only.
* **Architect notes** — see [`.cursor/rules/architect.mdc`](.cursor/rules/architect.mdc) for invariants (session ownership in `App.tsx`, hybrid routing model, no Realtime in `useProfileData`, etc.).

## Design Philosophy

The user interface is built around the concept of reducing cognitive load. Key design principles include:
* **Glassmorphism & depth** — strategic use of blurred backgrounds and translucent `BaseCard` variants to create a clear visual hierarchy without heavy borders.
* **Responsive layouts** — components like `PostCard` dynamically hug their content; the events hub uses a hub-layout (`max-w-[1800px]`) with a side rail for desktop, while feed/profile keep a tighter `max-w-7xl`.
* **Minimalism** — icon-only navigation, no emoji clutter, calibrated golden accents reserved for officialdom.
* **Premium dark mode** — full dark-theme parity, never an afterthought; tokens flow from `src/styles/theme.ts` and `src/styles/mobile-theme.ts`.

## Scripts

```bash
npm run dev               # Vite dev server
npm run build             # tsc -b && vite build
npm run lint              # ESLint
npm run preview           # Vite preview build
npm run deploy:prod       # vercel build --prod && vercel deploy --prebuilt --prod --force --yes
npm run search:resync     # Rebuild Meilisearch index from Supabase (tsx scripts/force-resync.ts)
npm run chat:prewarm      # Prewarm the Vercel KV chat cache with common queries
```

Additional one-off scripts in [`scripts/`](scripts/) cover backfilling tags, inspecting Meili indexes, purging events by category, etc.

## Deployment

Production deploys go to Vercel as **prebuilt artifacts** rather than via Vercel's git auto-detect pipeline. The remote `vercel build` running on Vercel's infrastructure deterministically refuses to register `api/scrape-wziks.ts` as a serverless function (the file passes TypeScript `nodenext` checks and esbuild bundles it cleanly, but Vercel's auto-detect silently drops it from the function list — confirmed by the hard error `"doesn't match any Serverless Functions inside the api directory"` when listed explicitly under `functions` in `vercel.json`). The local `vercel build` does not have this glitch and produces a `.vercel/output/` artifact containing all lambdas plus an isolated `/api/*` routing config.

Until the remote auto-detect is fixed (Vercel support or repro upstream), production deploys must be run manually:

```powershell
# Windows / PowerShell
./deploy.ps1
```

```bash
# Cross-shell (npm script)
npm run deploy:prod
```

Both invoke the same sequence:

1. `npx vercel build --prod` — local Vite build + local `@vercel/node` lambda compilation into `.vercel/output/`.
2. `npx vercel deploy --prebuilt --prod --force --yes` — upload the prebuilt artifact to production, bypassing remote re-detection.

Vercel's git auto-deploy should be disabled in the project dashboard (Project Settings → Git) to avoid the auto-deploy reverting `/api/scrape-wziks` to a 404/SPA-fallback state after each push.

First-time setup on a fresh checkout:

```powershell
npx vercel link --yes                              # link to tenkejjs-projects/ujverse
npx vercel pull --yes --environment=production     # populate .vercel/.env.production.local
```

### Required environment variables

Set in Vercel project settings (and `.env.local` for local dev):

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | Supabase anon key (RLS-protected) |
| `VITE_MEILI_HOST` / `VITE_MEILI_SEARCH_KEY` | client | Meilisearch read-only credentials |
| `SUPABASE_SERVICE_ROLE_KEY` | edge / serverless | Admin client for AI tools and scrapers |
| `GROQ_API_KEY` | edge | LLM provider for `/api/chat` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | edge | Vercel KV (Upstash Redis) for cache + rate limit |
| `MEILI_HOST` / `MEILI_ADMIN_KEY` | serverless | Meilisearch admin client used by `/api/sync-search` and resync scripts |
| `CRON_SECRET` | serverless | Shared secret for `?token=` / `Authorization: Bearer` on cron endpoints |

### Cron jobs

Defined in [`vercel.json`](vercel.json):

```json
{ "path": "/api/scrape-uj-events", "schedule": "0 5 * * *" }
```

Scrapes the official UJ news/calendar daily at 05:00 UTC and upserts into `public.official_events`.

## Future Roadmap

Architecture is prepared to support:
* Cursor-based pagination (infinite scroll) for feed and per-tag streams.
* Direct messaging (1-on-1 real-time chat) between community members.
* Bookmarks / "zapisz na później" for posts, announcements and events.
* Streaming AI responses (token-by-token), once we move past the synthesized single-chunk SSE.
* Push notifications (Web Push API) layered on top of the existing notification table.

## Author

UJverse was designed, architected, and implemented by **Franciszek Dranka** (Uniwersytet Jagielloński, Kraków). The project is a personal, independent work — it is not affiliated with, endorsed by, or sponsored by Uniwersytet Jagielloński, despite carrying the "UJ" prefix in its community-facing name.

- Author: Franciszek Dranka
- Email: [franciszek.dranka@student.uj.edu.pl](mailto:franciszek.dranka@student.uj.edu.pl)
- Repository: [github.com/tenkejj/ujverse](https://github.com/tenkejj/ujverse)
- Production: [ujverse.pl](https://ujverse.pl)

For commercial licensing, white-label deployments, partnerships, or any usage beyond personal source-review (see [LICENSE §2](./LICENSE)), please contact the author directly.

## License

Copyright © 2026 Franciszek Dranka. **All rights reserved.**

This software is released under a proprietary license. You may **view** the source for personal, non-commercial code-review purposes, but you may **not** copy, fork, mirror, deploy, modify, or use it (in whole or in part) to train AI/ML systems without prior written permission from the author. The full terms are in [LICENSE](./LICENSE).

The name **"UJverse"** and the UJverse logo are unregistered trademarks of Franciszek Dranka.
