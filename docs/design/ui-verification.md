# UI verification — dashboard revision, 6 November 2026

## Current: UI Skills revision

The user requested implementation without automated test runs. No unit, browser acceptance, lint or axe suites were run for this revision. The production bundle compiled and desktop/phone renders were viewed. Earlier counts below refer to older revisions. Current previews: [desktop](previews/ui-skills-desktop.png), [phone](previews/ui-skills-mobile.png). Design sources and decisions are in the root `DESIGN.md` and `.interface-design/system.md`.

## Current: open overview inspired by Baltic Wheels

- `npm run build`, `npm test` and the individual 90-test run pass. Changed TypeScript files pass no-unused-vars and React Hooks lint rules.
- Public acceptance: 90/90 browser checks pass. Public AI: 22/22 checks pass with simulated SSE. The former requirement to fit every section above the fold has intentionally been replaced by an open-section and spacing check.
- Dashboard main-content axe checks: zero violations in light, dark and UJ themes. Chat, the sidebar AI entry and faculty selector also report zero violations in all three themes.
- Dashboard widths 360, 390, 768, 1024 and 1920 px have no horizontal overflow. New catalogue layouts retain filters, pagination, saved items and calendar behavior.
- Theme definition files and original logo remain unchanged. Obsolete compact-dashboard CSS was removed; the new layout has a dedicated stylesheet.
- Read [open-overview.md](open-overview.md) for the reference analysis, skill selection, preview images and limits. The sections below describe earlier revisions.

## Public Versuś follow-up

- Production build and `npm test` pass. The individual test run now passes **90 tests across 30 suites**, including public tool boundaries, source-backed record sets, cache separation, post-pivot announcements and conversation reset.
- Existing browser acceptance: **90/90 passed**. Public AI browser checks: **22/22 passed**, with simulated SSE and failure responses. These cover guest access, one-time dashboard handoff, lack of an Authorization header, reload, suggested questions, clearing a conversation, visible errors, sticky faculty selection, floating assistant dialog and focus restoration, and mobile composer placement.
- Live public announcement tool: ten real public records validated successfully, without database writes. No real Groq inference was tested.
- Main dashboard axe checks pass in light/dark/UJ themes; public chat, added sidebar AI entry and faculty control were also checked. Widths 360, 390, 768, 1024 and 1920 have no horizontal dashboard overflow.
- Changed TypeScript files pass no-unused-vars and React Hooks lint rules. Both chat API entry points bundle successfully. An additional standalone strict API typecheck still reports existing errors in `notificationHelpers.ts`, `userMemory.ts` and the unchanged history-pruning lines in `api/chat.ts`; this is separate from the configured production build and test checks.
- Identity files (`public/logo.png`, `src/index.css`, `src/ThemeContext.tsx`, `src/styles/theme.ts`) remain unchanged in this revision. No deployment, migration or merge.

The earlier revision's results below are retained as history. See [versus-public.md](versus-public.md) for the current access model and local API requirements.

## Completed checks

- Production build: `npm run build` (strict TypeScript + Vite), passed.
- Unit suite: `node --import tsx --test --test-isolation=none 'tests/**/*.test.ts'`: 80 tests across 29 suites passed. `npm test` also exits successfully; in this runner its isolated mode reports file-level results, so the non-isolated run was used to verify individual tests.
- Browser acceptance: `CHROME_PATH=/usr/bin/chromium node scripts/pivot-browser-checks/checks.mjs`; **90/90 checks passed**.
- Changed-component lint: TypeScript no-unused-vars plus React Hooks rules-of-hooks/exhaustive-deps, passed. The repository's default ESLint config is empty; `npm run lint` alone is not meaningful validation.
- `git diff --check`, passed.
- Automated accessibility: axe WCAG 2 A/AA + WCAG 2.1 AA, zero violations in the tested main content of the dashboard in light/dark/UJ themes and announcements, registrations, tools, events and search results. The original header and navigation were restored rather than redesigned.
- Visual review: desktop 1440×1000, mobile 360×780. Additional overflow checks at 390, 768, 1024 and 1920 px.
- No uncaught JavaScript page errors in the final independent accessibility/visual run.

## Browser coverage

Anonymous access, real public announcements and sources, registration unavailable/data states, ingestion date meaning, Ctrl+K, public search and DB fallback, browser history, navigation, faculty selection/filtering/storage/dialog focus/Escape, auth gates and return paths, closed registration exclusion, verified countdowns, independent source failures, mobile drawer and navigation, saved items and persistence, twelve-row pagination, filter URL persistence, event/calendar URL state, month selection and keyboard tab navigation. Dashboard-specific checks verify the original image-based logo, system font, four overview sections fitting a 1440×1000 viewport, existing theme controls and persistent section customisation.

The acceptance suite deliberately aborts an announcement request to test partial failure. Expected network console errors are recorded (also analytics certificate and unavailable local Meilisearch); they are not treated as JavaScript crashes.

## Limits

No real-user usability study. No private account or personal data tested. Public preview transport is read-only. No production database migration, deployment or merge performed. Changes are published to the existing review branch so they can be pulled locally.

Vite still warns about the pre-existing large main bundle (>500 kB). This task does not attempt a whole-application performance refactor.
