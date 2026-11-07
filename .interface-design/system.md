# UJverse interface

Intent: help a new student understand what UJverse does and take one clear action. The page introduces its scope, then groups AI assistance and directly browsable information into two distinct surfaces.

Preserve `public/logo.png`, system typography and existing light/dark/UJ tokens. Use the established navy, gold, neutral surfaces and text roles. The original Versuś creature is the only new illustrative element; it does not replace the main logo.

Hierarchy: page heading 28 px (25 px phone); assistant heading 30 px (25 px phone); information group heading 20 px (18 px phone); preview titles 17 px; body 14–16 px; metadata 12 px. Page maximum width 1040 px. Four-pixel spacing base, 28–32 px surface padding and 24–32 px between task groups. Surfaces have neutral backgrounds, structural borders, 16 px corners and no decorative shadow or blur. Form radius 12 px, button radius 8 px. Primary controls are at least 48 px; secondary controls at least 44 px.

AI identity, explanation, labelled question field, explicit submit action and examples belong inside one surface. On phone, illustration sits beside the assistant identity and heading, while the description spans the full width. Below 380 px use a smaller illustration. Keep the submit action reachable without adding a duplicate chat interface.

Show one information category at a time using native filter buttons with explicit selected states. Preserve category in `?sekcja=` and wrap controls on narrow screens. Keep catalogues, saved items, faculty selection, customization, source links and honest source states.

Faculty selection has a sticky strip below the global header. The label “Twój wydział”, full readable name and “Wybierz” / “Zmień” stay explicit. Keep one visible selector per viewport. Mobile reserves 88 px and desktop 80 px; chat height includes the strip.

Mascot assets: `public/versus/{idle,greeting,listening,thinking,answering,success,error}.*` (full-body) and matching `face-*` (small avatars). Pixel art uses 96×96, a32-colour palette and `image-rendering: pixelated`. WebP/GIF play one short activity cycle. Both system and UJverse reduced-motion preferences select PNG. Request phases change only at actual request/stream/completion boundaries. No extra CSS/Framer bobbing, colour inversion or background disc.

Scrollbars: keep document stable gutters, match their background to `--bg-app`, and use a thin thumb mixed from existing text/surface tokens. Sidebar track stays transparent, overflow scrolling stays usable, and forced colours retain native controls.

Sources and evaluation limits are recorded in `DESIGN.md`. This is an implemented visual direction, not a usability study. The user requested no automated test suites for this iteration.
