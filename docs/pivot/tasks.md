# UJverse pivot — tasks

Status legend: `todo` · `doing` · `done` · `deferred` · `blocked`

| # | Task | Req | Status |
| --- | --- | --- | --- |
| T01 | Repository investigation (routing, auth gate, data layer, RLS in migrations **and** live DB, scrapers, search, styles, tooling) | all | done |
| T02 | Spec, implementation plan, task list | 016 | done |
| T03 | Pure info modules: types, Warsaw time, faculty mapping, links, normalisation, dedup, relevance, preferences, saved items | 003–006, 010, 011 | done |
| T04 | Unit tests + `npm test` (Node runner + tsx, no new deps) | 015 | done |
| T05 | Migration: anon `SELECT` on `official_events`, scoped anon `SELECT` on `usos_registrations`, conditional anon `SELECT` on `announcements` | 002 | done |
| T06 | Verify migration on local PostgreSQL with `anon`/`authenticated` roles | 002, 015 | done |
| T07 | `PublicInfoAdapter` + `DataService` facade + `usePublicInfo` hooks | 004 | done |
| T08 | Preferences store + faculty picker | 003 | done |
| T09 | UI blocks: section shell, cards, states, freshness footer, disclaimer | 004, 006, 009 | done |
| T10 | Dashboard at `/` | 001, 005 | done |
| T11 | Pages: Komunikaty, Rejestracje, Wydarzenia, Niezbędnik | 004, 008 | done |
| T12 | Public search `/szukaj` + header search + Ctrl/Cmd+K | 007 | done |
| T13 | `AuthRequired`, `/logowanie`, post-login redirect | 002, 012 | done |
| T14 | `App.tsx`: remove global gate, access map, feed → `/spolecznosc`, scoped providers, logout handling | 002, 008, 013 | done |
| T15 | Lazy-load legacy views; disable feed query outside post views | 014 | done |
| T16 | Navigation: SideNav, BottomNav, MobileDrawer, Header | 008 | done |
| T17 | Mobile compose entry on `/spolecznosc` | 013 | done |
| T18 | USOS scraper Europe/Warsaw conversion | 017 | done |
| T19 | P1: dashboard section preferences („Dostosuj") | 010 | done |
| T20 | P1: save for later (local) | 011 | done |
| T21 | Build, lint, tests, hooks lint; fix regressions | 015 | done |
| T22 | Browser verification desktop + 375 px (anonymous) | 009, 015 | done |
| T23 | README, README.en, architecture map, index.html copy | 016 | done |
| T24 | `verification.md` with actual results | 015 | done |
| T25 | Commit / push / PR (no prod migration without auth) | 016 | done |

Ops follow-ups (not code tasks): apply `20261104120000` on remote Supabase; redeploy scrapers after merge — see `verification.md` §4.
