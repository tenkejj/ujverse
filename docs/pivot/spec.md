# UJverse pivot — specification

Status: implemented on branch `cursor/info-hub-pivot-0474` (see `verification.md` for what was actually verified).
Scope: turn UJverse from a social network with utilities into an **information-first student hub** inside the existing app.

---

## 1. Product goals

1. A visitor opening `/` immediately sees what matters at UJ: announcements, registration deadlines, upcoming university events and student tools.
2. Reading public university information never requires an account.
3. Choosing a faculty takes seconds, works without an account and survives a refresh.
4. Every item points to its authoritative source and dates are never presented as more precise or fresher than they are.
5. Existing social features, data and deep links keep working, but stop being the centre of the product.

Product promise (UI copy): **„Wszystko, co ważne na UJ, w jednym miejscu."** — always paired with the unofficial-project disclaimer.

## 2. Non-goals

- New social features, feed redesign, DMs, gamification, recommender systems, AI ranking.
- A second application, new backend framework, new state manager, new component library.
- Changing cron schedules or scraper sources.
- Push notifications.
- Applying migrations or deploying (manual, reviewed steps — see `implementation-plan.md` §6).

## 3. Personas and journeys

| Persona | Journey |
| --- | --- |
| **First-time visitor** (any UJ student, no account) | Opens `/` → sees latest announcements from all faculties, open registrations, events → picks a faculty in the header/inline picker → content narrows → refresh keeps the choice. |
| **Returning student with account** | Signs in → lands on the same dashboard, faculty defaulted from `profiles.department` → can still open Aula, Mój plan, Społeczność, profile, notifications. |
| **Student looking for something specific** | Presses Ctrl/Cmd+K or the search tab → types „stypendium" / „lektorat" → gets announcements, registrations, events and tools, each linking to the source. |
| **Anonymous visitor hitting a protected feature** | Opens `/moj-plan` or `/aula` → sees why an account is needed and a sign-in button; after signing in returns to the same page. |
| **Existing user with an old link** | Opens `/thread/123`, `/profile/jan`, `/events`, `/usos` → the preserved feature renders (after sign-in if needed). |

## 4. Functional requirements

Priority P0 = must ship in this run, P1 = ship if P0 is stable.

### PIVOT-001 — New default homepage (P0)
- `/` renders `InfoDashboard` for everyone (anonymous and authenticated). The social feed moves to `/spolecznosc`.
- Sections (rendered only when they have content or a meaningful state): intro row with faculty control and trust line; **Ważne teraz**; **Komunikaty** (faculty-aware heading); **Nadchodzące rejestracje**; **Wydarzenia na UJ**; **Niezbędnik studenta**; source/freshness footer with the unofficial disclaimer.
- No marketing hero; useful content must be visible in the first mobile viewport.

### PIVOT-002 — No mandatory registration for information (P0)
- Remove the global `if (!session) return <Auth />` gate. Public views: `/`, `/komunikaty`, `/rejestracje`, `/wydarzenia`, `/szukaj`, `/niezbednik`, `/sale` (room finder; tables already public).
- Protected views keep requiring a session and render an inline `AuthRequired` panel for anonymous users instead of the old full-screen login.
- `/logowanie` hosts the existing `AuthShell` + `Login`; `?next=` (validated, internal paths only) and an OAuth-safe session-storage hand-off return the user to the intended page.
- Public data must load for the `anon` role: add narrowly scoped `SELECT` policies (migration `20261104120000_public_information_read_access.sql`). No write access, no access to profiles/posts/messages/timetables/storage.

### PIVOT-003 — Faculty personalization without an account (P0)
- Faculty list, aliases and grouping come from `src/lib/departments.ts` (`UJ_DEPARTMENTS`, `canonicalDepartment`, `departmentGroup`, `DEPT_SHORT`). No new identifiers.
- Stored in `localStorage` key `ujverse.infoPrefs.v1` (versioned JSON, schema-validated on read, in-memory fallback when storage is unavailable, cross-tab sync via `storage` events).
- Resolution (deterministic, unit-tested):
  1. Signed in **and** the stored choice was made by this same user → stored choice.
  2. Signed in and `profiles.department` resolves to a canonical faculty → profile faculty.
  3. Otherwise → stored choice (including an explicit „Cały UJ").
  4. Otherwise → none (all-university view).
- The profile is never written by this feature.
- Registrations map to faculties via the USOS org-unit code prefix (second segment of `source_unit_code`, e.g. `UJ.WZ.*` → WZiKS). The mapping is derived from unit names observed in live data (§6.2); unknown prefixes (doctoral schools, MISH, SMP, Studium WF CM…) are treated as „inne jednostki", not guessed.
- Official events are university-wide (`faculty = 'Uniwersytet Jagielloński'` for every row) and are not filtered by faculty; the UI says so.
- No filtering by study programme or year (the data does not support it).

### PIVOT-004 — Real aggregated dashboard (P0)
- Data flows through `DataService` → new `PublicInfoAdapter` → Supabase with explicit column lists and limits; normalisation is pure code in `src/lib/info/` (typed `InfoItem` contract).
- **Announcements**: `announcements` (last 30 days, max 80 rows, faculty filter through `departmentGroup`). Fields: title (or lecturer for ISI rows), faculty, source label, status, excerpt, source URL (falls back to the faculty's listing page from `api/_lib/scrapers/sources.ts` when the row has no own URL), `created_at` labelled as *added to UJverse*.
- **Registrations**: `usos_registrations` rows scraped live from USOSweb only (`source_usos_tura_id IS NOT NULL`); seed and community rows are excluded from the information hub. Closed rows (`closes_at <= now`) are never shown as active.
- **Events**: `official_events` (upcoming, bounded); the generic placeholder location written by the scraper is hidden; only the date (not the synthetic 13:00 time) is shown. Community events from `public.events` are not mixed in (they stay at `/events`).
- **Resources**: static list (USOSweb, PEGAZ, poczta) + internal tools; account-only tools are marked.
- Deduplication: announcements by identical normalised `source_url` only; events by `external_id`, then identical normalised title on the same Warsaw day; registrations by `source_usos_tura_id`. Similar-but-different titles are never merged.
- Partial failure: each domain is a separate query with its own loading / error / empty state.

### PIVOT-005 — Relevance (P0)
Deterministic rules in `src/lib/info/relevance.ts` (unit-tested):
- **Ważne teraz** is shown only when a faculty is selected and contains, for that faculty: registrations closing within 72 h (score 100 within 24 h, else 85), registrations opening within 72 h (70), announcements with status `cancelled` (90) or `remote` (75) added within the last 72 h. Max 4 items; ties broken by the relevant timestamp, then id.
- Lists: announcements newest first; registrations by phase (open, closing soonest first → upcoming, opening soonest first); events by date ascending.
- Countdown wording only for registrations verified by the scraper within the last 48 h and closing/opening within 7 days; otherwise absolute dates.
- All user-facing dates use `Europe/Warsaw` (`Intl` with `timeZone`), day differences are computed on Warsaw calendar days (DST-safe).

### PIVOT-006 — Freshness and trust (P0)
- Copy uses „Z oficjalnych źródeł UJ", „Regularnie aktualizowane", „Sprawdź w źródle" — never „na żywo"/„real-time".
- Timestamp meanings are kept separate:
  - announcements: `created_at` = *dodano do UJverse* (first ingestion, not publication);
  - registrations: `updated_at` = *ostatnio potwierdzone w USOSweb* (bumped by the scraper's upsert trigger on every run);
  - events: `scraped_at` = *ostatnio widziane na uj.edu.pl*; `date` = event day.
- Stale detection: registrations whose newest `updated_at` is older than 36 h get an explicit „dane mogą być nieaktualne" note; rows not re-confirmed in the latest run lose countdowns.
- Disclaimer „UJverse to niezależny projekt studencki — nie jest oficjalnym serwisem UJ" visible in the dashboard footer and Niezbędnik.

### PIVOT-007 — Information-first search (P0 core, P1 polish)
- `/szukaj?q=` (public): announcements (Meilisearch `ujverse_content` with `type = "komunikat"`, hydrated from Supabase; bounded Supabase `ilike` fallback with an honest notice), registrations and official events (bounded Supabase `ilike`), tools (static list).
- Header search field (desktop) and the centre tab of the bottom nav (mobile) lead there; Ctrl/Cmd+K focuses search.
- The old social search (`/search`: posts, people, Aula) stays available to signed-in users and is linked from `/szukaj`.

### PIVOT-008 — Navigation (P0)
- Primary (everyone): Start, Komunikaty, Rejestracje, Wydarzenia, Szukaj, Niezbędnik.
- Account group (signed in): Mój plan, Aula, Społeczność, Powiadomienia, Profil; settings/theme/logout at the bottom. Anonymous users see one quiet „Zaloguj się" entry instead.
- Mobile bottom nav: Start · Komunikaty · **Szukaj** (centre) · Rejestracje · Wydarzenia; everything else in the drawer. Post creation moves to a button on `/spolecznosc`.
- Deep links preserved: `/thread/:id`, `/profile/:handle`, `/profile`, `/events`, `/usos`, `/search`, `/aula`, `/moj-plan` (+`/dzis`, `/briefing`), `/znizki`, `/miejsca` (+`/sale-nauki`), `/settings`, `/chat`, `/admin/*`, group paths. `/rejestracje` now opens the public registrations page (the alarm/community view remains at `/usos`).

### PIVOT-009 — Design and accessibility (P0)
- Reuse `BaseCard`, `theme.ts`, `sidePanelStyles`, `EVENTS_HUB`/`FILTER_PILL` tokens, `NavItem`, three existing themes. No new visual library.
- Semantic landmarks and headings, visible focus rings, labelled controls, dialog focus management for the faculty picker, `prefers-reduced-motion` respected via existing `MotionConfig`.
- 360–390 px: no horizontal overflow, ≥40 px touch targets, no hover-only actions.

### PIVOT-010 — Lightweight preferences (P1)
- In the same versioned store: which dashboard sections are hidden (Komunikaty / Rejestracje / Wydarzenia / Niezbędnik), editable from a small „Dostosuj" panel.

### PIVOT-011 — Save for later (P1)
- Device-local saved list (`ujverse.saved.v1`) for announcements, registrations and events; „Zapisane" section on the dashboard when non-empty. No server sync (no existing bookmarks backend).

### PIVOT-012 — Contextual account creation (P0)
- No sign-up popups on reading routes. Sign-in is offered where an action needs it (`AuthRequired` panels, account-only tools in Niezbędnik, header link).

### PIVOT-013 — Preserve existing functionality (P0)
- No tables, policies, scrapers, API routes, social components or data are deleted. Social views stay reachable for signed-in users.

### Engineering requirements
- **PIVOT-014 Performance (P1)**: legacy views are lazy-loaded; the dashboard never fetches posts, likes, comments, follows or notifications; the feed query is disabled outside views that render posts; `EventsProvider` mounts only where community events are used.
- **PIVOT-015 Tests (P0)**: unit tests for pure logic with Node's built-in runner + existing `tsx` (no new dependencies).
- **PIVOT-016 Docs (P0)**: README / README.en / architecture map updated; manual steps documented.
- **PIVOT-017 Scraper time zones (P1)**: `api/scrape-usos-registrations.ts` converts USOSweb local times with real Europe/Warsaw rules instead of the month heuristic (which was off by 1 h at the end of March and October).

## 5. Non-functional requirements

- Bounded queries only (limits on every list; search requires ≥ 2 characters; debounced).
- Public data must not wait for auth initialisation.
- No service-role keys or other secrets in the client.
- External links: `target="_blank" rel="noopener noreferrer"`, only `http(s)` URLs are rendered as links.
- Polish UI copy; no claims of official endorsement or real-time updates.

## 6. Data sources and access constraints

### 6.1 Tables used by the public layer

| Table | Written by | Before pivot (live DB) | After migration |
| --- | --- | --- | --- |
| `announcements` | `api/scrape-faculty-announcements.ts` (3×/day) | `SELECT` for `public` already exists in prod (policy „Allow public read access", not in migrations) | `announcements_select_anon` created only if no anon/public `SELECT` policy exists |
| `official_events` | `api/scrape-uj-events.ts` (daily) | `authenticated` only | + `anon` `SELECT` (all rows; scraped from uj.edu.pl) |
| `usos_registrations` | `api/scrape-usos-registrations.ts` (2×/day) | `authenticated` only | + `anon` `SELECT` **only where `source_usos_tura_id IS NOT NULL`** (USOSweb rows; community and seed rows stay private to signed-in users) |
| `uj_buildings`, `uj_rooms`, published floor plans | migrations | already public | unchanged |

Unchanged and still protected: `profiles`, `posts`, `comments`, `likes`, `follows`, `notifications`, `cohort_*`, `user_timetable_entries`, `lecturer_subscriptions`, `usos_registration_subscriptions`, `usos_scraper_runs`, `student_discounts`, `study_spots`, storage buckets.

### 6.2 Facts verified against the live database (read-only, 2026-11-04)
- 479 announcements, newest added 2026-11-04 14:05 UTC; 85 in the last 30 days across 13 faculties; 76/85 have `source_url`.
- 557 USOSweb registration rows (latest `updated_at` 2026-11-04 19:58 UTC) + 10 seed rows (fabricated examples, excluded); 19 live rows open or upcoming.
- 289 official events, last scraped 2026-11-04 05:10 UTC, 12 upcoming; all university-wide; event times are synthetic (13:00 Warsaw).
- USOS unit prefixes observed: `WBl` Biologii, `WBt` Biochemii…, `WCh` Chemii, `WF` Filologiczny, `WFa` Farmaceutyczny, `WFAI` FAIS, `WFz` Filozoficzny, `WH` Historyczny, `WL` Lekarski, `WMI` MiI, `WOZ` Nauk o Zdrowiu, `WPA` Prawa i Administracji, `WPl` Polonistyki, `WSM` SMiP, `WZ` WZiKS; non-faculty: `SDH`, `SDS`, `SDSP`, `MISH`, `SMP`, `CM-SWF`, bare `UJ`.

### 6.3 Search
- Meilisearch `ujverse_content` holds posts and announcements (`type` filterable). Events and registrations are not indexed → bounded Supabase queries.
- **Pre-existing risk (not introduced here):** the public search key shipped to browsers can query every index it is allowed to, including `ujverse_users` and `ujverse_aula`; Aula isolation is enforced only by the client filter. The pivot UI never queries those indexes for anonymous users, but the real fix is a key restricted to `ujverse_content` (and tenant tokens for Aula) — listed as a manual action.

## 7. Architecture

### Decisions (A–H)

- **A. Routing** — keep the single shell in `App.tsx` (hybrid `parseAppRoute` + `navigate`, no `<Routes>`). New view ids for public pages; a single `VIEW_ACCESS` map marks views `public`/`auth`. Only `/logowanie` and `/reset-password` render outside the shell. No duplicated shell.
- **B. Authentication** — `authReady` flag; public views render before `getSession()` resolves; protected views show a skeleton until auth is known, then content or `AuthRequired`. Session-dependent effects stay guarded by `session`. Explicit logout navigates to `/`; passive expiry keeps the URL and shows `AuthRequired` on protected views.
- **C. Data access** — anonymous requests go through the normal anon Supabase client; RLS policies are the security boundary (the existing pattern: client → Supabase). A server-side read endpoint was rejected: duplicate data path, not served by the Vite dev server, and the RLS change is three small reviewable policies.
- **D. Personalization** — rules in §PIVOT-003; local choice never overwrites the profile.
- **E. Social features** — routes, components and data untouched; navigation demoted to the account group; feed moved to `/spolecznosc`; compose moved from the global bottom bar to the feed page.
- **F. Search** — new public page reusing `SearchService`/Meili with a `type` filter plus Supabase fallbacks; social search kept at `/search`.
- **G. Rendering** — new code in `src/components/info/`, `src/hooks/usePublicInfo.ts`, `src/hooks/useInfoPreferences.ts`, `src/lib/info/`; `App.tsx` only gains routing/access glue and lazy imports.
- **H. Visual consistency** — the dashboard promotes the existing side widgets (Komunikaty Akademickie, Niezbędnik, Wydarzenia UJ) to the main stage using the same glass cards, uppercase gold/navy section labels and pills.

### Module map

```
src/lib/info/        types.ts, time.ts, faculty.ts, normalize.ts, relevance.ts, links.ts, preferences.ts, saved.ts
src/services/adapters/PublicInfoAdapter.ts   (Supabase reads, explicit columns, limits)
src/services/DataService.ts                  (+ public info facade methods)
src/hooks/usePublicInfo.ts                   (TanStack Query, faculty-scoped keys)
src/hooks/useInfoPreferences.ts              (useSyncExternalStore over the versioned store)
src/components/info/*                        (dashboard, pages, cards, faculty picker, AuthRequired, search)
supabase/migrations/20261104120000_public_information_read_access.sql
```

## 8. Acceptance criteria (summary)

| ID | Criterion |
| --- | --- |
| A | Fresh browser at `/` shows real public information, no login modal. |
| B | Selecting a faculty changes announcements/registrations/„Ważne teraz"; survives refresh. |
| C | Signing in lands on the same dashboard; feed, profile, Aula, notifications still reachable. |
| D | Announcements are real rows with working „Sprawdź w źródle" links. |
| E | Registrations show correct open/close dates and phase; closed ones are absent. |
| F | If one domain fails, the others still render with an explicit error for the failed one. |
| G | Anonymous user on a protected route sees `AuthRequired`; no private data is fetched. |
| H | `/thread/:id`, `/profile/:handle`, `/events`, `/usos` still work for signed-in users. |
| I | 360 px viewport: navigation, search, faculty picker usable, no horizontal scroll. |
| J | Items with only an ingestion date are labelled as such; nothing claims „updated just now" without data. |

## 9. Testing and migration strategy

- `npm test`: Node test runner (`node --import tsx --test`) over `tests/**/*.test.ts`, type-checked by `tsconfig.test.json`. Covers time zones/DST, faculty mapping and preference resolution, normalisation, dedup, relevance, link safety, storage parsing.
- `npm run build` (tsc strict + Vite), `npm run lint`, plus an ad-hoc ESLint run with `react-hooks` + `typescript-eslint` rules on the new files.
- RLS migration exercised on a local PostgreSQL with Supabase-like `anon`/`authenticated` roles.
- Browser checks (desktop + 375 px) against the real project with the public anon key, without signing in.
- The migration is additive and idempotent; it is **not** applied by this work.

## 10. Risks, assumptions, limitations

- Until the migration is applied, anonymous visitors see announcements (already public in prod) but **registrations and events return empty** — RLS filters rows silently, so the client cannot distinguish this from „no data". This is the main deployment dependency.
- `announcements.created_at` is ingestion time; a newly onboarded source back-fills many rows with the same date.
- Official event dates come from listing pages; the scraper falls back to the scrape time when no date is found (none observed in live data, but the client ignores events whose date is within 10 min of `scraped_at`).
- USOS rows stored before the scraper fix may be 1 h off for dates between ~1–28 March and ~25–31 October; they self-correct on the next scraper run after deployment.
- Meilisearch in production may be unavailable; the fallback is honest but less tolerant of typos.
- Faculty preference is per device; there is no cross-device sync for anonymous users.
