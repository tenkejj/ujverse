# UJverse student workspace

The Start page opens with **Co słychać na UJ?** and keeps the existing UJverse logo, system font and three navy/gold/neutral themes. A narrower 224 px sidebar serves the main content, which can use 1120 px. The header logo is centred on the viewport and exposes theme, settings and login actions.

Versuś is the primary question workspace: an original hairless pixel-art scholar with round glasses sits beside its identity, explanation and labelled form. A restrained accent border marks this area; source-backed question suggestions use semantic icons. The existing public conversation handoff and all seven request/interaction animations remain intact.

A common information area switches between announcements, registrations and an interactive event calendar. The calendar has selectable dates, a daily agenda, month controls, Today/nearest-event actions and keyboard navigation. The full events page defaults to the same calendar. Categories, month/day state, saved items, faculty preferences, customisation and source links remain available.

Source timing is visible next to the information. Added/confirmed/ingested source timestamps are explicitly distinguished from the browser's latest successful data read. Unknown, loading, stale and failure states are honest. The footer groups university services and UJverse tools with icons, concise descriptions and account requirements.

The existing settings page is available for local preferences without signing in; account and AI-memory controls remain authenticated. State is reset on identity changes. Header touch targets and logo placement were reviewed at narrow widths, and sticky chrome reserves scrolling space.

This iteration fetched `interface-design`, `better-layout` and `better-ui` through **MCP UI Skills**. Detailed decisions, source links, timestamp semantics, historical settings evidence and verification limits are in [Campus workspace](docs/design/campus-workspace.md). Automated test suites are intentionally not run, as requested by the user; production compilation and visual preview are separate checks.
