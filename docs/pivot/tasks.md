# UJverse pivot — tasks

This is the historical task list for the original November 4 pivot. `done` records work performed for that revision, not a fresh regression or production policy check. Remediation requested by the November 11 audit is tracked in [`../audit/2026-11-11-status.md`](../audit/2026-11-11-status.md).

Current remediation code and research materials are implemented on `codex/audit-2026-11-11`: source-backed “Nie przegap”, `/poradniki` and its three guide routes, the two-programme local pilot, explicit opt-in local measurement and Supabase/RLS search. Current build/unit/browser/RLS results, PR and release remain separate checklist items in the audit report. No participants have been recruited; interviews and observed return windows remain outstanding.

Status legend for the historical table: `todo` · `doing` · `done` · `deferred` · `blocked`

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

Historical ops follow-ups: verify/apply `20261104120000` on remote Supabase and release the scraper changes — see `verification.md` §4 for the original checkpoint. Current remote state and release evidence belong in the audit report; do not infer them from this older list.
