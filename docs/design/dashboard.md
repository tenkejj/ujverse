# Dashboard revision: keep the existing UJverse identity

## Accepted direction

The user rejected the replacement palette and wordmark. This revision restores the original header/logo, sidebar, bottom navigation, font stack and three colour themes. `src/ThemeContext.tsx`, `src/index.css` and `src/styles/theme.ts` remain unchanged. Page-layout aliases reference their existing values; no alternative light/dark/UJ palette is defined.

The earlier `ui-research.md` describes the initial investigation and an earlier visual proposal. Its Source Sans / white-blue system is superseded by this revision.

## Plan

- Typography: existing system font, 24–27 px page title, 16 px section titles, 14 px overview item titles. No custom font download.
- Colour: use existing roles. Light uses brand ink #1e293b, card/surface roles and existing secondary labels. Dark uses the original black surfaces and #e8c84a accent. UJ uses the original #0a121c / #121c2c surfaces and #e8c97a accent. These values are illustrative references to the original tokens, not a new palette.
- Layout: two columns on desktop, one on mobile, with four useful sections and bounded previews. Announcements and registration deadlines come first; events and student tools follow. Keep the main information visible without a large introductory hero.
- Versuś revision: a compact public AI question field precedes the four information sections. The sidebar combines a prominent AI entry, useful sample questions, information navigation and existing university service links. Faculty selection stays visible while scrolling, with an explicit “Wydział” label.

```
Original header and logo
Dziś na UJ                  Dostosuj
Zapytaj Versusia AI         [Public question field + suggested questions]
[Optional real priority alert]
Komunikaty                  Rejestracje USOS
3 source-aware rows         2 active/upcoming rows
Wszystkie komunikaty        Wszystkie rejestracje
Wydarzenia na UJ             Pod ręką
2 upcoming events           USOS / PEGAZ / Poczta / tools
Kalendarz wydarzeń          Cały niezbędnik
[Saved items when present]
Sources and freshness (expandable)
```

## Self-review

The page should feel like the existing UJverse product with a better organised dashboard, not a new design system. Section cards use the existing `BaseCard` component. There are no new metric tiles, decorative gradients or marketing panels. Counts reflect the complete filtered data, not merely the preview length. Source-specific errors and unavailable data never become a false zero count.

## Persistent project skill

See [ujverse-ui](../../.agents/skills/ujverse-ui/SKILL.md). It records the identity constraint and the practical Frontend Design / Web Design Guidelines principles for subsequent work.

Public assistant access and local API requirements are documented in [versus-public.md](versus-public.md).
