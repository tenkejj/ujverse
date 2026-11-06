# UJverse interface

Sources: [interface-design](https://www.ui-skills.com/skills/dammyjay93/interface-design), [better-ui](https://www.ui-skills.com/skills/jakubkrehel/better-ui).

Intent: a UJ student checking university information between classes. One clear place to ask, followed by a small amount of directly browsable information. The domain is faculties, classes, registration windows, announcements, university services and campus events.

Preserve the existing logo, owl, system font and light/dark/UJ theme tokens. The existing navy, gold, neutral surfaces, ink and muted text are the colour world; no new palette, font or decorative gradient.

Hierarchy: Versuś and the question field are the focal point. Page title 22 px, assistant heading 36 px (28 px on phones), content titles 18 px, body 14–16 px, metadata 12 px. Four-pixel spacing base. The assistant has 48 px of separation from the page heading. Related controls use 8–12 px gaps; content previews use 32 px gaps.

Show one information category at a time using native filter buttons with explicit selected states. Preserve category in `?sekcja=`. Keep the full catalogues, saved items, faculty selection, customization and source links available. Avoid a long wall of equally prominent sections.

Depth: existing neutral surfaces and restrained structural borders; no decorative shadows. Input outer radius 23 px = button radius 10 px + padding 12 px + border 1 px. Button height 48 px; secondary controls at least 44 px. Hover styling is pointer-aware; optional press feedback is scale 0.96 over 150 ms, gated by reduced-motion preference. State changes remain immediate.

This records the implemented revision for review, not a usability study or an approved final visual direction. The user requested no automated test runs for this visual iteration.
