# UJverse interface

Intent: help a new student understand what UJverse does and take one clear action. The page introduces its scope, then groups AI assistance and directly browsable information into two distinct surfaces.

Preserve `public/logo.png`, system typography and existing light/dark/UJ tokens. Use the established navy, gold, neutral surfaces and text roles. The original Versuś creature is the only new illustrative element; it does not replace the main logo.

Hierarchy: page heading 28 px (25 px phone); assistant heading 24 px (22 px phone); information group heading 20 px (18 px phone); preview titles 17 px; body 14–16 px; metadata 12 px. Page maximum width 1040 px. Four-pixel spacing base, 24–32 px surface padding and 24–32 px between task groups. Surfaces have neutral backgrounds, structural borders, 16 px corners and no decorative shadow or blur. Form radius 12 px, button radius 8 px. Primary controls are at least 48 px; secondary controls at least 44 px.

AI identity, access label and one short explanation share a compact header with a 96 px illustration. The labelled question field is the focal point; sending precedes grouped secondary examples on phones. Mobile uses a 64 px illustration (smaller below 380 px), and the description spans the full width. Do not add a duplicate conversation interface.

Show one information category at a time using native filter buttons with explicit selected states. Preserve category in `?sekcja=` and wrap controls on narrow screens. Keep catalogues, saved items, faculty selection, customization, source links and honest source states.

Faculty selection has a sticky strip below the global header. The label “Twój wydział”, readable scope and “Wybierz” / “Zmień” stay explicit. A labelled search dialog supports full names and abbreviations, an explicit all-university option, selected state and empty search. Long names remain in the accessible name, title and dialog. Keep one visible selector per viewport. Mobile reserves 88 px and desktop 80 px; chat height includes the strip.

Mascot assets: `public/versus/{idle,greeting,listening,thinking,answering,success,error}.*` (full-body) and matching `face-*` (small avatars). Pixel art uses 96×96, a32-colour palette and `image-rendering: pixelated`. WebP/GIF play one short activity cycle. Both system and UJverse reduced-motion preferences select PNG. Request phases change only at actual request/stream/completion boundaries. No extra CSS/Framer bobbing, colour inversion or background disc.

Scrollbars: keep document stable gutters, match their background to `--bg-app`, and use a thin thumb mixed from existing text/surface tokens. Sidebar track stays transparent, overflow scrolling stays usable, and forced colours retain native controls.

Sources and evaluation limits are recorded in `DESIGN.md`. This is an implemented visual direction, not a usability study. The user requested no automated test suites for this iteration.

Footer: two named navigation groups share common edges, with account requirements written out. Keep the whole toolkit link at the section heading. Project information and expandable source/freshness data share a compact bottom area. Expanding sources does not move its trigger. See `docs/design/ui-skills-refinement.md` for the current public UI Skills sources and MCP limitation.
