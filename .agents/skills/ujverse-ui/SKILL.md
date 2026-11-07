---
name: ujverse-ui
description: Design, refine and review UJverse dashboards and public information pages while preserving the established logo, colour themes and typography. Use for UI layout, navigation, information hierarchy and frontend interaction work.
---

# UJverse UI

## Product and visual identity

UJverse is an unofficial student information hub. The main tasks are finding faculty announcements, registration deadlines, upcoming events and student tools. Public information is readable without an account.

Versuś AI is a primary public entry point: a useful question field on Start, a prominent sidebar entry and a labelled mobile shortcut. Offer concrete questions about public university information. Explain account requirements for personal features; never promise response speed without measurement or show a fake online indicator. Keep AI prominent without duplicating the entire conversation interface on the dashboard.

The user wants the existing visual identity preserved. Layout work must reuse the original `public/logo.png`, header branding and existing light/dark/UJ themes. Source tokens from `src/styles/theme.ts`, `src/styles/mobile-theme.ts` and `src/index.css`. Use the existing font stack. Do not introduce replacement wordmarks, fonts or palettes as a side effect of a layout redesign. If the user explicitly requests an identity change, follow that request.

## Design process

1. Inspect the actual current branch and existing components before designing.
2. Identify which user task the change improves. Sketch hierarchy before adding decoration.
3. Distinguish layout from branding. Use existing tokens. Use `BaseCard` when an independent surface is needed; use distinct neutral surfaces to group complete tasks, keeping related copy and controls together. Avoid disconnected text and controls.
4. Review desktop and phone screenshots after implementation, including long titles, empty data and errors. Remove visual elements that carry no useful information.

## Dashboard hierarchy

- Keep a short page heading and one visible faculty control per viewport.
- Label the selector visibly as “Wydział”, provide at least a 44 px target and keep it accessible while scrolling. A tiny icon or an unexplained “UJ” is insufficient.
- Group announcements, registrations, events and tools by function. Show bounded previews and a clear link to each full section.
- Use the [layout](../ujverse-layout/SKILL.md) and [simplify](../ujverse-simplify/SKILL.md) workflows for crowded pages. Group by meaning and spacing, with different emphasis for announcements, deadlines and event dates. Do not return to the rejected equal-panel dashboard or force all sections into one viewport.
- Make actionable urgent information prominent using verified relevance rules. Do not invent statistics, urgency, recommendations or data.
- Explain the product in plain language on the first visit. Keep the AI question, examples and access label in one group, followed by one information group and labelled university services.
- Avoid new decorative gradients, marketing heroes, oversized numbers, all-cap eyebrows and repeated entrance animations. The original Versuś creature is allowed as the distinctive illustrative detail; preserve the main UJverse logo.
- Mascot animation must finish after one short cycle and show a static PNG for reduced motion.
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

The user has explicitly requested no automated test suites during the current visual UI iterations. Respect that instruction instead of automatically running the suites below. Prioritize the actual implementation and visual preview; do not claim previous test results cover a newer revision.

Run the production build and checks appropriate to changed behaviour. `scripts/pivot-browser-checks/checks.mjs` covers the public flows; use a local Chrome executable when available. The default ESLint config may be empty, so do not report it as a substantive lint audit. Inspect all three themes and narrow widths. Do not deploy as part of local preview work.

For public AI changes, also run `scripts/versus-browser-checks.mjs` and the chat access unit tests. Distinguish simulated SSE UI tests from real provider inference. Anonymous tools must use public records, and cache keys must separate access scopes, users and conversation context. Clear conversation state at account boundaries.

## Guidance sources

Adapted to this project from:
- https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md
- https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md

These sources guide quality, not a replacement UJverse visual identity.
