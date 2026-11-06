# UI verification — 6 November 2026

## Completed checks

- Production build: `npm run build` (strict TypeScript + Vite), passed.
- Unit suite: `node --import tsx --test --test-isolation=none 'tests/**/*.test.ts'`: 80 tests across 29 suites passed. `npm test` also exits successfully; in this runner its isolated mode reports file-level results, so the non-isolated run was used to verify individual tests.
- Browser acceptance: `CHROME_PATH=/usr/bin/chromium node scripts/pivot-browser-checks/checks.mjs`; **82/82 checks passed**.
- Changed-component lint: TypeScript no-unused-vars plus React Hooks rules-of-hooks/exhaustive-deps, passed. The repository's default ESLint config is empty; `npm run lint` alone is not meaningful validation.
- `git diff --check`, passed.
- Automated accessibility: axe WCAG 2 A/AA + WCAG 2.1 AA, zero violations in the tested public Start, announcements, registrations, tools, events, search results and event calendar. Dark and UJ themes additionally audited on Start with zero violations.
- Visual review: desktop 1440×1000, mobile 360×780. Additional overflow checks at 390, 768, 1024 and 1920 px.
- No uncaught JavaScript page errors in the final independent accessibility/visual run.

## Browser coverage

Anonymous access, real public announcements and sources, registration unavailable/data states, ingestion date meaning, Ctrl+K, public search and DB fallback, browser history, navigation, faculty selection/filtering/storage/dialog focus/Escape, auth gates and return paths, closed registration exclusion, verified countdowns, independent source failures, mobile drawer and navigation, saved items and persistence, twelve-row pagination, filter URL persistence, event/calendar URL state, month selection and keyboard tab navigation.

The acceptance suite deliberately aborts an announcement request to test partial failure. Expected network console errors are recorded (also analytics certificate and unavailable local Meilisearch); they are not treated as JavaScript crashes.

## Limits

No real-user usability study. No private account or personal data tested. Public preview transport is read-only. No production database migration, deployment, merge or push performed.

Vite still warns about the pre-existing large main bundle (>500 kB). This task does not attempt a whole-application performance refactor.
