---
name: ujverse-ui
description: Design, refine and review UJverse dashboards and public information pages while preserving the established logo, colour themes and typography. Use for UI layout, navigation, information hierarchy and frontend interaction work.
---

# UJverse UI

## Product and visual identity

UJverse is an unofficial student information hub. The main tasks are finding faculty announcements, registration deadlines, upcoming events and student tools. Public information is readable without an account.

The current Start hierarchy leads with source-backed “Nie przegap” actions and procedural guide links, followed by compact Versuś assistance. Versuś remains a public entry point through a labelled question field, sidebar entry and mobile shortcut. Offer concrete questions about public university information. Explain account requirements for personal features; never promise response speed without measurement or show a fake online indicator. Keep AI prominent without duplicating the entire conversation interface on the dashboard.

The user wants the existing visual identity preserved. Layout work must reuse the original `public/logo.png`, header branding and existing light/dark/UJ themes. Source tokens from `src/styles/theme.ts`, `src/styles/mobile-theme.ts` and `src/index.css`. Use the existing font stack. Do not introduce replacement wordmarks, fonts or palettes as a side effect of a layout redesign. If the user explicitly requests an identity change, follow that request.

## Design process

1. Inspect the actual current branch and existing components before designing.
2. Identify which user task the change improves. Sketch hierarchy before adding decoration.
3. Distinguish layout from branding. Use existing tokens. Use `BaseCard` when an independent surface is needed; use distinct neutral surfaces to group complete tasks, keeping related copy and controls together. Avoid disconnected text and controls.
4. Review desktop and phone screenshots after implementation, including long titles, empty data and errors. Remove visual elements that carry no useful information.

## Dashboard hierarchy

- Keep a short page heading and one visible faculty control per viewport.
- Label the selector visibly as “Wydział”, provide at least a 44 px target and keep it accessible while scrolling. A tiny icon or an unexplained “UJ” is insufficient.
- Lead Start with source-backed next actions; initially show at most three, support reversible local acknowledgement and expansion, and keep freshness/error states explicit. Local “Sprawdzone” never means enrollment or a completed procedure.
- Keep the supporting Start assistant as one compact task workspace: a small identity field beside the labelled question area; sending comes before optional examples on phones. Reuse the seven activity states and both reduced-motion preferences.
- The shared events calendar provides month/day selection, keyboard navigation, Today/nearest-event shortcuts and a source-backed agenda. Preserve URL state and never invent event times.
- Show exact Europe/Warsaw timing near the active information and catalogue headings. Separate announcement addition, USOS confirmation, event ingestion and browser cache read; do not relabel created_at as a source scraper check.
- Use a 224 px desktop sidebar and a viewport-centred original header logo. Keep theme/settings/login accessible, local settings public and account controls private. Preserve identity resets and sticky-header scroll clearance.
- The faculty dialog should support labelled name/abbreviation search, a clear all-university option and long accessible names. Preserve the strip height and focus behaviour.
- Group footer destinations by purpose, keep the toolkit link near its heading, and place project/source information together. Expanding sources must not move its trigger.
- Group announcements, registrations, events and tools by function. Show bounded previews and a clear link to each full section.
- Use the [layout](../ujverse-layout/SKILL.md) and [simplify](../ujverse-simplify/SKILL.md) workflows for crowded pages. Group by meaning and spacing, with different emphasis for announcements, deadlines and event dates. Do not return to the rejected equal-panel dashboard or force all sections into one viewport.
- Make actionable urgent information prominent using verified relevance rules. Do not invent statistics, urgency, recommendations or data.
- Explain the product in plain language on the first visit. Keep verified next actions first, guide links close to the task, and the AI question/examples/access label in a compact supporting group. Preserve the information categories and labelled university services.
- `/poradniki` and its three procedure routes expose official sources, applicability, checked dates, preparation, steps/status/contact and local progress. Distinguish past deadlines and the UJ/CM housing scopes.
- Programme context currently covers EPI/WZiKS and philosophy only (full-time, I degree 3 years / II degree 2 years). Unmapped announcements/registrations stay faculty-wide; never invent programme audiences or deadlines.
- Optional pilot measurement requires explicit opt-in, stays on the device for up to 28 days and allows export/deletion. Source clicks, local progress and browser visits are not verified formalities, participant counts or research results.
- Avoid new decorative gradients, marketing heroes, oversized numbers, all-cap eyebrows and repeated entrance animations. The smooth hairless Versuś scholar with round glasses is the distinctive pixel-art detail; preserve the main UJverse logo.
- The pixel-art mascot has idle, greeting, listening, thinking, answering, success and error activities. Tie response activities to real request phases and keep their animation key stable across streamed chunks. Replay for a new turn using a stable message ID; cancellation must not trigger success. Animations finish after one short cycle. Both system and UJverse reduced-motion preferences must select static PNG.
- Preserve usable scrolling. Document tracks follow the existing app background; sidebar tracks remain transparent with a thin, quiet thumb. Keep stable page gutters and native forced-colour accessibility.
- Use whitespace, alignment, readable type and selective emphasis. Keep content aligned to the left.
- On mobile use a single natural page scroll, not independently scrolling widgets. Keep actions usable without hover.

## Frontend quality

- Use semantic sections, headings, real links for destinations, buttons for actions and labels for fields.
- Provide visible focus, keyboard operation and clear icon-button names. Respect reduced motion and browser zoom.
- Preserve independent loading, failure, empty and stale states. A source error must not be called "no information".
- Keep source links and distinguish ingestion, verification and event dates. Format times in Europe/Warsaw. Never display a synthetic event time as authoritative.
- Persist meaningful filters and pagination in URLs. Preserve faculty preferences, saved items and section customisation.
- Check contrast using existing text roles rather than changing the overall theme palette.

## Verification

Follow the current task’s testing and publication instructions. A November 8 visual-only iteration avoided automated suites; that was historical scope, not a permanent repository rule. The November 12 audit explicitly included regression and authorized production release. Never carry an earlier permission or test result forward as a blanket rule for a later task.

Run the production build and checks appropriate to changed behaviour. `scripts/audit-browser-checks.mjs` covers the current radar/guides/programme/pilot public flows; configure Chrome/Playwright according to its header. The old pivot/Versuś scripts contain historical selectors and need adaptation before acting as release gates. The default ESLint config may be empty, so do not report it as a substantive lint audit. Inspect all three themes and narrow widths. Local preview alone does not authorize publication; follow the user’s current release authorization and record exact deployment evidence.

For public AI changes, run current chat-access and procedural-reply tests and applicable browser scenarios; adapt historical Versuś selectors when needed. Distinguish simulated SSE UI tests from real provider inference. Anonymous tools must use public records, and cache keys must separate access scopes, users and conversation context. Clear conversation state at account boundaries.

## Guidance sources

Adapted to this project from:

- https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md
- https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md

These sources guide quality, not a replacement UJverse visual identity.

Additional UI Skills sources used for layout refinement:

- https://github.com/Dammyjay93/interface-design/blob/main/.claude/skills/interface-design/SKILL.md
- https://github.com/jakubkrehel/skills/blob/main/skills/better-layout/SKILL.md
- https://github.com/jakubkrehel/skills/blob/main/skills/better-ui/SKILL.md

The November 8 workspace refinement fetched interface-design, better-layout and better-ui directly through the available UI Skills MCP tools. See docs/design/campus-workspace.md for the current decisions and verification limits.

Current product/release decisions: `DESIGN.md` and `docs/audit/2026-11-12-release-summary.md`. The audit reports distinguish local tests, user-confirmed SQL execution, actual deployment metadata and unperformed participant research.
