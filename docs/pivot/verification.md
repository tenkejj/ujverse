# UJverse pivot — verification

**Historical report — 4 November 2026.** These checks describe the original pivot, not the latest UI or the remediation requested in the 11 November audit. Current scope, live checks and release status are recorded in [`../audit/2026-11-11-status.md`](../audit/2026-11-11-status.md). Do not carry the counts below forward as current results.

As of 12 November, the remediation branch includes Supabase/RLS search, “Nie przegap”, three public procedural guides, local context for two verified programmes and explicit opt-in device-only pilot measurement. Its current full regression and release are tracked in the audit report, separately from the November 4 counts. Read-only production evidence confirms public reads and selected anonymous private-table exclusions, but does not prove signed-in cross-cohort isolation. Research has no participants yet.

The original verification used branch `cursor/info-hub-pivot-0474`, a local Vite preview and the live Supabase project with its anon key. Times below are Europe/Warsaw.

At that checkpoint, migration `20261104120000_public_information_read_access.sql` had not been applied to the remote database. The subsequent production policy state must be checked separately; neither the presence of this migration nor a successful assistant API reply establishes anonymous browser access. The following results are retained as historical evidence.

---

## 1. Automated checks

| Check | Command / artefact | Result |
| --- | --- | --- |
| Unit tests | `npm test` | **80/80 pass**, 29 suites (2026-11-04) |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json` | clean |
| Production build | `npm run build` | clean |
| Hooks lint | `npm run lint:hooks` (eslint react-hooks) | clean after AuthRequired / search remount fixes |
| Local RLS | `scripts/pivot-rls-check` against local Postgres with the new migration applied | anon `SELECT` on `announcements`, `official_events`, scoped `usos_registrations` (`source_usos_tura_id IS NOT NULL`); no write; community/seed usos rows hidden from anon |
| Browser suite | `node scripts/pivot-browser-checks/checks.mjs` (Playwright + Chrome, BASE_URL=http://127.0.0.1:5173) | **64/64 pass** |

---

## 2. Browser acceptance (anonymous)

Script: [`scripts/pivot-browser-checks/checks.mjs`](../../scripts/pivot-browser-checks/checks.mjs). Viewport A = 1440×1000, I = 360×760.

| ID | Scenario | Result |
| --- | --- | --- |
| A1–A3 | `/` without login shows H1, no auth form, real announcements | PASS |
| B0–B6 | Faculty dialog a11y, WZiKS filter + localStorage `ujverse.infoPrefs.v1`, persist after refresh, „Cały UJ”, Escape restores focus | PASS |
| D1–D2 | Announcement source links are `https://…uj.edu.pl` | PASS |
| E1–E7 | Registrations/events via REST fixtures: open shown, closed hidden, countdown, no placeholder location, „Ważne teraz”, faculty filter | PASS (fixtures; live anon blocked until migration) |
| F1 | Announcements abort → section error while other domains still render | PASS |
| G1–G4 | `/moj-plan`, `/aula`, `/spolecznosc`, `/thread/123`, `/profile/jan`, `/usos`, `/events` → `AuthRequired` + `?next=`; open redirect rejected | PASS |
| H1–H2 | Unknown path → `/`; `/sale` public | PASS |
| I1–I6 | No horizontal overflow on public + login paths at 360 px; bottom nav; focused search; faculty dialog fits; drawer hides account items for anon | PASS |
| J1–J2 | Announcement `time` titled „Dodano do UJverse”; registrations without anon RLS → unavailable copy (not empty) | PASS against live DB without migration |
| N1–N3 | History back/forward; sidebar Start / Komunikaty / Rejestracje / Wydarzenia / Niezbędnik | PASS |
| S1–S4 | Ctrl+K → header search → `/szukaj?q=stypendium`; Meili fallback notice; no social search for anon | PASS |

Manual walkthrough recording: `/opt/cursor/artifacts/anonymous_visitor_dashboard_faculty_search_auth_walkthrough.mp4`.

Screenshots (Europe/Warsaw session):

- Dashboard desktop anon — `dashboard_desktop_anonymous.png`
- Dashboard mobile 375 — `dashboard_mobile_375_anonymous.png`
- Faculty WZiKS — `dashboard_kolory_uj_wziks.png`
- Komunikaty mobile dark — `komunikaty_mobile_dark_wziks.png`
- Search „stypendium” — `search_stypendium_dark.png`
- AuthRequired Mój plan — `auth_required_moj_plan.png`

---

## 3. Requirements matrix

| Req | Verdict | Notes |
| --- | --- | --- |
| PIVOT-001 Dashboard at `/` | **DONE** | Feed at `/spolecznosc`; sections + freshness footer |
| PIVOT-002 Anonymous info | **PARTIAL** | App + policies in repo; **remote migration not applied** — registrations/events anon reads blocked on live DB by design until ops apply SQL |
| PIVOT-003 Faculty prefs | **DONE** | `ujverse.infoPrefs.v1`, unit-tested resolution, USOS unit map |
| PIVOT-004 Aggregated data | **DONE** | `PublicInfoAdapter` + `DataService`; domain isolation |
| PIVOT-005 Relevance | **DONE** | Unit-tested „Ważne teraz” + sorts + countdown rules |
| PIVOT-006 Freshness / trust | **DONE** | Warsaw labels, source links, unofficial disclaimer |
| PIVOT-007 Public search | **DONE** | `/szukaj`, header + Ctrl/Cmd+K, Meili + DB fallback notice |
| PIVOT-008 Navigation | **DONE** | SideNav / BottomNav / drawer / Header info-first |
| PIVOT-009 Design / a11y | **DONE** | Existing glass/theme; dialog focus; mobile overflow checks |
| PIVOT-010 Section prefs | **DONE** | P1 „Dostosuj” in dashboard |
| PIVOT-011 Saved items | **DONE** | P1 local saved store |
| PIVOT-012 Contextual auth | **DONE** | `AuthRequired`, `/logowanie?next=`, postAuth hand-off |
| PIVOT-013 Preserve social | **DONE** | Deep links keep URL; features behind session |
| PIVOT-014 Performance | **DONE** | Lazy legacy views; feed query gated; EventsProvider scoped |
| PIVOT-015 Tests | **DONE** | 80 unit + 64 browser checks |
| PIVOT-016 Docs | **DONE** | README / README.en / ARCHITECT_MAP / this file |
| PIVOT-017 USOS TZ | **DONE** | `warsawLocalStringToUtcIso` / real Europe/Warsaw rules |

---

## 4. Blocked / deferred (ops)

| Item | Status |
| --- | --- |
| Apply `20261104120000_public_information_read_access.sql` on production Supabase | **BLOCKED** on human authorization — not applied by this agent |
| Redeploy Vercel with scraper TZ fix | **DEFERRED** to normal deploy after merge |
| Meili always available for public search | **DEFERRED** — honest DB fallback ships; ops can restore Meili independently |
| Live authenticated walkthrough (OAuth / password) | **DEFERRED** — anon paths + AuthRequired verified; signed-in faculty-from-profile covered by unit tests |

---

## 5. Security notes checked

- Anon policies are `SELECT` only; usos scoped to scraper rows (`source_usos_tura_id IS NOT NULL`).
- `sanitizeNextPath` rejects external / protocol-relative `?next=` (open-redirect test G4).
- No new secrets; client still uses existing anon key in `supabaseClient.ts` (pre-existing drift).
- Social tables, storage, timetables, discounts subscriptions untouched by the migration.
