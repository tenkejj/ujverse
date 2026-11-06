# UJverse: public information UI, 6 November 2026

> Historical first proposal. The user subsequently requested restoration of the original logo, colours and font, with a dashboard layout. See [the current dashboard direction](dashboard.md). The custom Source Sans / white-blue visual system below is no longer used.

## Baseline and decision

Base: `cursor/info-dashboard-simplify-0474`, `488f42d`. Both pivot PR #24 and follow-up PR #25 are pushed but unmerged. Work is isolated on `codex/info-ui-research`.

Choose a content-first student overview: a short title, one faculty selection, announcements in a main column, registrations and useful links beside it. The previous navigation-card landing pushed the first announcement to ~912 px on a 390×844 viewport. Useful content should appear in the first viewport.

Three low-fidelity alternatives were compared on the same sample content:

| Criterion | Weight | Personal overview | Search-first | Editorial edition |
| --- | --- | --- | --- | --- |
| Finding information | 30% | 4.5 | 4 | 4 |
| Attention and readability | 25% | 4.5 | 4 | 3.5 |
| Mobile | 20% | 4 | 4.5 | 3.5 |
| Discoverability | 15% | 4 | 3.5 | 4 |
| Maintenance | 10% | 4.5 | 4.5 | 3 |
| Weighted / 5 | | 4.33 | 4.08 | 3.68 |

These are expert judgments, not user-study scores. Search-first requires known intent; editorial editions require reliable leading stories, titles and images. The overview handles heterogeneous source data with less editorial maintenance.

## Source research

The public HTML and information structure of these sources were reviewed. No claim is made to having tested their private product interfaces.

- https://www.gov.uk/ and https://design-system.service.gov.uk/: task-oriented structure, meaningful links, accessible controls.
- https://www.service-public.gouv.fr/: search plus browse, grouped by needs; avoid importing a large taxonomy.
- https://www.ox.ac.uk/students: student news, dates and useful links have distinct roles.
- https://news.mit.edu/: content hierarchy; do not promote a story just because a hero component exists.
- https://www.are.na/: restraint and content; no copying of its collection layout.
- https://linear.app/features: consistent product language; its SaaS marketing aesthetics are not suitable here.
- https://www.uj.edu.pl/: source context and blue identity, with an explicit unofficial-project disclaimer.

## Visual system

- White #ffffff, navigation #f5f7f9, text #202d3a, secondary #596977, UJ blue #00519e, contextual fill #edf4fa.
- Source Sans 3, one humanist family, self-hosted WOFF2 with OFL license. No remote font requests.
- Titles 32–42 px, section headings 19–21 px, item titles 17–19 px, metadata 13–14 px.
- Left alignment, distinct main/context columns, real whitespace. No decorative gradients, marketing hero, identical card grid or animated entrances for each result.
- Urgency comes from existing deterministic relevance/freshness rules. Dates preserve source meaning. No fabricated content or times.
- All existing themes retained; surface changes scoped to the app shell and public information pages.

## Skills

Read and applied:
- https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md — deliberate subject-specific direction, token plan, self-critique and visual inspection.
- https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md — review against fresh interface guidelines, semantics, focus, contrast, responsive layout, URL state.

Evaluated but not used as a generator:
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill — README and SKILL inspected; generic automatic style selection was unnecessary for this brief.

## Implementation

- Start: three announcements, two registrations, two upcoming events, quick links and an optional factual priority alert. Existing saved items and section preferences remain functional.
- Announcements: source-aware rows, URL filters/search, twelve rows per page, URL pagination. No arbitrary spotlight.
- Registrations: phase filters in URL, honest stale/unavailable states, verified deadline labels, account link for reminders.
- Tools: described links, account requirements retained.
- Events: public source-aware list by month and a calendar driven by the same public event records. Calendar month/day/view in URL; tab keyboard navigation. The legacy academic/community calendar remains reachable at `/events` after authentication.
- Search: consistent item presentation; existing public search/fallback behavior retained.
- Public events no longer mount the legacy community events provider or fetch its data.

## Preview and operation

Standard local setup: copy `.env.example` to `.env.local`, set your existing public Supabase URL/publishable key, run `npm ci` and `npm run dev -- --host 0.0.0.0`.

In the current managed session the browser cannot trust the outbound proxy certificate directly. The preview uses a temporary read-only local transport proxy through the system's trusted TLS store. It does not disable TLS verification, use service-role credentials, change production or write to the database. Temporary transport scripts and configuration are outside the repository and are not required on a normal developer machine. The active preview is the public, anonymous experience.

## Verification

See `ui-verification.md` for the final checks. The repository's `npm run lint` has an empty ESLint config, so a separate TypeScript / Hooks lint was run over the changed components.

## Recommended user test

Five students, different faculties, about fifteen minutes each. Find a faculty announcement; find a registration closing time; open PEGAZ; find an upcoming event. Record completion, wrong turns, time and hesitation. No user testing has been performed in this implementation session. Private authenticated views were not tested with a real account.
