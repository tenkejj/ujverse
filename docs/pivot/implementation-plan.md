# UJverse pivot — implementation plan

Least-disruptive path: keep the single shell in `App.tsx`, add public views, move social views behind an access map, and put all new logic in isolated modules.

## 1. Affected files

### New
| File | Purpose | Req |
| --- | --- | --- |
| `src/lib/info/types.ts` | `InfoItem` contracts (announcement / registration / event / resource), `DomainResult` | 004 |
| `src/lib/info/time.ts` | Europe/Warsaw formatting, Warsaw day keys, relative labels | 005, 006 |
| `src/lib/info/faculty.ts` | USOS unit → faculty map, faculty helpers over `departments.ts` | 003 |
| `src/lib/info/links.ts` | safe external URL check, internal `next` path validation | 002, 009 |
| `src/lib/info/normalize.ts` | DB rows → `InfoItem`, dedup | 004, 006 |
| `src/lib/info/relevance.ts` | registration phases, „Ważne teraz", sort orders | 005 |
| `src/lib/info/preferences.ts` | versioned storage schema + resolution rules | 003, 010 |
| `src/lib/info/saved.ts` | saved-items storage schema | 011 |
| `src/lib/info/searchResources.ts` | static tools list + matching | 004, 007 |
| `src/services/adapters/PublicInfoAdapter.ts` | bounded Supabase reads with explicit columns | 002, 004 |
| `src/hooks/usePublicInfo.ts` | TanStack Query hooks (faculty-scoped keys) | 004 |
| `src/hooks/useInfoPreferences.ts` | external store hook (faculty, hidden sections, saved) | 003, 010, 011 |
| `src/hooks/useInfoSearch.ts` | debounced public search | 007 |
| `src/components/info/*` | dashboard, pages, cards, faculty picker, `AuthRequired`, search, login page | 001–012 |
| `supabase/migrations/20261104120000_public_information_read_access.sql` | narrow anon `SELECT` policies | 002 |
| `tests/*.test.ts`, `tsconfig.test.json` | unit tests | 015 |
| `docs/pivot/*` | this contract | 016 |

### Modified
| File | Change | Req |
| --- | --- | --- |
| `src/App.tsx` | remove global auth gate; `authReady`; new views + `VIEW_ACCESS`; feed → `/spolecznosc`; lazy legacy views; scoped providers; post-login redirect; logout → `/` | 001, 002, 008, 013, 014 |
| `src/components/Header.tsx` | info search field, faculty control, login link for anonymous users, no bell/menu when anonymous | 003, 007, 008 |
| `src/components/SideNav.tsx` | information-first groups; account group only when signed in | 008 |
| `src/components/BottomNav.tsx` | Start · Komunikaty · Szukaj · Rejestracje · Wydarzenia | 008 |
| `src/components/MobileDrawer.tsx` | same IA as SideNav, anonymous header, search → `/szukaj` | 008 |
| `src/components/auth/AuthShell.tsx`, `Login.tsx` | unofficial-hub copy, „Przeglądaj bez konta", OAuth return path | 002, 012 |
| `src/services/DataService.ts` | public info facade methods | 004 |
| `api/scrape-usos-registrations.ts` | Europe/Warsaw conversion via `src/lib/warsawTime.ts` | 017 |
| `package.json` | `test` script, description | 015, 016 |
| `index.html` | description / OG copy | 016 |
| `README.md`, `README.en.md`, `.cursor/rules/ARCHITECT_MAP.md`, `.cursor/rules/architect.mdc` | new positioning, guest access, routes, manual steps | 016 |

Not touched: scrapers' sources and schedules, `vercel.json`, social components' internals, Supabase tables.

## 2. Dependency-ordered steps

1. **Contract & docs** — spec, plan, tasks.
2. **Pure logic + tests** (`src/lib/info/*`, `tests/*`) — no React/Supabase imports so they run under Node.
3. **Migration** — write SQL; verify on local PostgreSQL with `anon` / `authenticated` roles.
4. **Data layer** — `PublicInfoAdapter` → `DataService` facade → `usePublicInfo` hooks.
5. **Preferences store** — `useInfoPreferences` (+ faculty picker component).
6. **UI building blocks** — section shell, item rows/cards, states (loading / error / empty), freshness footer.
7. **Pages** — dashboard, Komunikaty, Rejestracje, Wydarzenia, Niezbędnik, Szukaj, `AuthRequired`, login page.
8. **Shell integration** — `App.tsx` routing/access/auth, lazy legacy views, providers, redirects.
9. **Navigation** — SideNav, BottomNav, MobileDrawer, Header.
10. **Scraper fix** — USOS local time conversion.
11. **P1** — preferences panel, saved items, search polish.
12. **Validation** — build, lint, tests, hooks lint, browser checks; fix regressions; write `verification.md`.
13. **Docs** — README(s), architecture map.

## 3. Data contracts

```ts
type InfoAnnouncement = {
  kind: 'announcement'; id: string; title: string; excerpt: string
  faculty: string | null; facultyShort: string | null
  sourceLabel: string; sourceUrl: string | null; sourceIsListing: boolean
  status: AnnouncementStatus; addedAt: string            // created_at = added to UJverse
  summary: string | null; lecturerName: string | null
}
type InfoRegistration = {
  kind: 'registration'; id: string; turaId: string; title: string
  unitName: string | null; unitCode: string | null; faculty: string | null
  opensAt: string; closesAt: string | null; url: string | null
  registrationKind: RegistrationKind; verifiedAt: string // updated_at = last scraper confirmation
}
type InfoEvent = {
  kind: 'event'; id: string; title: string; description: string
  day: string /* YYYY-MM-DD Warsaw */; startsAt: string
  location: string | null; category: string | null
  sourceName: string; url: string | null; seenAt: string // scraped_at
}
type DomainResult<T> = { items: T[]; fetchedAt: string; freshness: { latest: string | null } }
```

## 4. Query keys

`['info', 'announcements', facultyKey]`, `['info', 'registrations']`, `['info', 'events']`, `['info', 'search', normalizedQuery, facultyKey]`.
Registrations and events are fetched once (bounded) and filtered client-side by faculty, so switching faculty never races; announcements are fetched per faculty group and keyed by it, so a late response for an old faculty cannot overwrite the new one. `staleTime` 2–5 min, `retry: 1`, `placeholderData` keeps the previous list while a new faculty loads (marked as `isPlaceholderData` → dimmed).

## 5. Routes after the pivot

| Path | View | Access |
| --- | --- | --- |
| `/` | dashboard | public |
| `/komunikaty` | announcements | public |
| `/rejestracje` | registrations (USOSweb) | public |
| `/wydarzenia` | official events | public |
| `/szukaj` | information search | public |
| `/niezbednik` | tools | public |
| `/sale` | room finder | public |
| `/logowanie` | sign in / sign up (outside shell) | public |
| `/spolecznosc` | social feed (was `/`) | auth |
| `/usos` | registration alarms + community entries | auth |
| `/events` | community events + calendar | auth |
| `/search` | social search | auth |
| `/thread/:id`, `/profile`, `/profile/:handle`, `/aula`, `/moj-plan`, `/dzis`, `/briefing`, `/znizki`, `/miejsca`, `/sale-nauki`, `/notifications`, `/settings`, `/chat`, `/admin/*`, group paths | unchanged | auth |

## 6. Manual steps (not performed by this work)

1. Review and apply `supabase/migrations/20261104120000_public_information_read_access.sql` (SQL editor or `supabase db push`). Required for registrations and events to appear for anonymous visitors.
2. Optionally restrict the Meilisearch key used as `VITE_MEILISEARCH_SEARCH_KEY` to the `ujverse_content` index (pre-existing exposure of `ujverse_users` / `ujverse_aula`).
3. Deploy with the existing prebuilt flow (`deploy.ps1` / `npm run deploy:prod`) after review.
4. Make sure Supabase Auth redirect URLs include the site origin (unchanged requirement).
