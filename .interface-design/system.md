# UJverse interface

Intent: a student quickly checking university news, deadlines and dates, with an accessible AI assistant. Preserve `public/logo.png`, system typography and existing light/dark/UJ tokens. Use the established navy, gold, neutral surfaces and text roles; no replacement font, main logo or decorative gradient.

The signature is an original slender pixel-art creature with tall ear fins, cream muzzle, intelligent eyes and a book. The AI identity stands openly beside one question field, with no surrounding card or inner identity panel. On phones the identity and heading share a row, then the labelled form spans the width. Sending precedes optional examples. The question field is the primary task; controls use native semantics and reuse existing components.

Hierarchy: page heading 28 px (25 phone), assistant heading 25 px (22/20 phone), section heading 20 px (18 phone), preview titles 17 px, body 14–16 px, metadata 11–12 px. Four-pixel spacing base, 24–32 px surface padding and 24–32 px between groups. Primary actions 48 px, secondary controls 44 px. Homepage content maximum 1640 px; sidebar 224 px. Header logo is centred on the viewport, not on the remaining content column.

Colour is purposeful: small navy/gold icon fields and action shapes, selected/today/event-count cues in the calendar, and real event photography. The assistant, information overview have no enclosing panels. Individual information entries use thin neutral borders, with restrained labelled status/topic colours. Input boundaries remain clear. Original theme tokens supply all colours; no decorative glows, blur or gradients.

One information category is selected with native pressed filter buttons, beside an always-visible source-photo event preview unless events are hidden. Preserve `?sekcja=`. The events category renders the shared interactive calendar. Month/day state lives in `miesiac`/`dzien`; the full page defaults to calendar and supports explicit list view. Keep selected-day agenda, source links, saved items, hidden sections, and honest empty/error states. Keyboard date navigation has one tab stop and moves focus with selection.

Data timing is visible at the active information heading and on catalogues. Distinguish announcement addition, USOS confirmation, event ingestion and browser data read; never call announcement `created_at` the last scraper run. Show exact Europe/Warsaw day/hour, with loading/error/unknown/stale text. Do not reuse another faculty's timestamp during placeholders.

The visibly labelled faculty strip remains below the header, one visible selector per viewport. Mobile reserves 88 px and desktop 80 px; chat height still includes this space. Search supports full names, abbreviations and Polish diacritics. Long names remain available through accessible text/title/dialog. Public settings expose local preferences only; account panels remain authenticated and remount on identity changes.

Mascot assets: `public/versus/{idle,greeting,listening,thinking,answering,success,error}.*` and matching `face-*`. Native 96×96, shared 24-colour palette, sharp pixel rendering and binary alpha. Idle/listening/thinking/answering WebP/GIF loops stay attached to their activities, while greeting/success/error play once; system and UJverse reduced-motion preferences select PNG. Stable message IDs replay for a new turn without restarts on every streamed chunk. No extra bobbing or colour inversion.

The footer has two named navigation groups with semantic icons. Keep the full toolkit link beside its heading, account requirements written out and project/source information together. Expanding sources keeps its trigger stationary. Scrollbars follow the app background with quiet thumbs; keep keyboard/touch scrolling and native forced-colour controls. Scroll padding accounts for sticky chrome and mobile navigation.

Current sources were fetched through MCP UI Skills: interface-design, better-layout and better-ui. Decisions and verification limits: `docs/design/campus-workspace.md`. These are implemented patterns, not a usability study. The user requested no automated test suites for visual iterations.

Versuś conversation: natural questions without slash menus, stable Markdown, truthful activity labels, 40 ms word/grapheme rendering groups, a bounded ready-reply presentation settle, and immediate stop/reduced-motion flushing, and user-controlled scroll anchoring. See `docs/design/versus-refresh.md` for scope and verification limits.

Current open-layout refinement: `docs/design/open-campus.md`. Portraits crop transparent padding and use larger unframed marks; full companion art is 184px on the homepage and 160px in the chat welcome. Event images originate from the actual UJ event catalogue, with honest fallback for missing/failed photos.

Latest refinement: `docs/design/semantic-ui-tweaks.md`. Keep the catalogue introductions and generic overview heading visually absent. Search uses useful icon topics and a two-column item grid on desktop. The companion has readable rectangular gold glasses and theme-specific static palettes; never show fabricated inference/TPS metrics.
