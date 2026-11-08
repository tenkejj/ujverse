# UJverse interface

Intent: a student quickly checking university news, deadlines and dates, with an accessible AI assistant. Preserve `public/logo.png`, system typography and existing light/dark/UJ tokens. Use the established navy, gold, neutral surfaces and text roles; no replacement font, main logo or decorative gradient.

The signature is an original slender pixel-art creature with tall ear fins, cream muzzle, intelligent eyes and a book. The AI identity has its own small tonal field beside the question workspace, rather than a large floating hero. On phones the identity and heading share a row, then the labelled form spans the width. Sending precedes optional examples. The question field is the primary task; controls use native semantics and reuse existing components.

Hierarchy: page heading 28 px (25 phone), assistant heading 25 px (22/20 phone), section heading 20 px (18 phone), preview titles 17 px, body 14–16 px, metadata 11–12 px. Four-pixel spacing base, 24–32 px surface padding and 24–32 px between groups. Primary actions 48 px, secondary controls 44 px. Main content maximum 1120 px; sidebar 224 px. Header logo is centred on the viewport, not on the remaining content column.

Colour is purposeful: a gentle navy/gold tint and stronger structural outline on the AI area, small semantic icon fields for tools/categories, and selected/today/event-count cues in the calendar. Inputs remain inset. Preview items have restrained borders. Original theme tokens supply all colours; no decorative glows, blur or gradients.

One information category is shown at a time with native pressed filter buttons. Preserve `?sekcja=`. The events category renders the shared interactive calendar. Month/day state lives in `miesiac`/`dzien`; the full page defaults to calendar and supports explicit list view. Keep selected-day agenda, source links, saved items, hidden sections, and honest empty/error states. Keyboard date navigation has one tab stop and moves focus with selection.

Data timing is visible at the active information heading and on catalogues. Distinguish announcement addition, USOS confirmation, event ingestion and browser data read; never call announcement `created_at` the last scraper run. Show exact Europe/Warsaw day/hour, with loading/error/unknown/stale text. Do not reuse another faculty's timestamp during placeholders.

The visibly labelled faculty strip remains below the header, one visible selector per viewport. Mobile reserves 88 px and desktop 80 px; chat height still includes this space. Search supports full names, abbreviations and Polish diacritics. Long names remain available through accessible text/title/dialog. Public settings expose local preferences only; account panels remain authenticated and remount on identity changes.

Mascot assets: `public/versus/{idle,greeting,listening,thinking,answering,success,error}.*` and matching `face-*`. Native 96×96, shared 24-colour palette, sharp pixel rendering and binary alpha. WebP/GIF play one short cycle; system and UJverse reduced-motion preferences select PNG. Stable message IDs replay for a new turn without restarts on every streamed chunk. No extra bobbing or colour inversion.

The footer has two named navigation groups with semantic icons. Keep the full toolkit link beside its heading, account requirements written out and project/source information together. Expanding sources keeps its trigger stationary. Scrollbars follow the app background with quiet thumbs; keep keyboard/touch scrolling and native forced-colour controls. Scroll padding accounts for sticky chrome and mobile navigation.

Current sources were fetched through MCP UI Skills: interface-design, better-layout and better-ui. Decisions and verification limits: `docs/design/campus-workspace.md`. These are implemented patterns, not a usability study. The user requested no automated test suites for visual iterations.

Versuś conversation: natural questions without slash menus, stable Markdown, truthful activity labels, 40 ms received-delta rendering batches with immediate completion/stop, and user-controlled scroll anchoring. See `docs/design/versus-refresh.md` for scope and verification limits.
