# Open information overview — 6 November 2026

The user rejected the compact equal-panel dashboard and selected [Baltic Wheels](https://balticwheels.pl/en/) as a reference. The new composition preserves UJverse's original logo, system font, theme tokens, faculty selection and public AI access. It changes reading order, density and framing.

Rendered previews: [desktop](previews/open-start-desktop.png) · [phone](previews/open-start-mobile.png).

## Reference research

The live Baltic Wheels page was inspected in Chromium at desktop and phone widths. Its useful principles are broad content margins, distinct typography levels, generous section separation, a clear opening action, and content grouped into different compositions rather than one repeated row treatment. It also contains cards, tables and marketing imagery; those are not the requested direction for UJverse. No Baltic Wheels images, code, branding or content are reused.

The previous UJverse composition gave four panels almost equal visual weight, used tightly spaced rows and repeated the assistant prompts in the sidebar. Its acceptance check even required every section heading to fit within a single desktop viewport. That density target directly conflicted with the user's latest feedback and has been replaced with an explicit spacing check.

## Skills researched and selected

- [Impeccable layout](https://github.com/pbakaus/impeccable/blob/c3bb418ee38ee49a6b999b7752c1368f3123a2bd/skill/reference/layout.md): reading order, meaningful proximity, spacing rhythm and structural adaptation. Adapted as [ujverse-layout](../../.agents/skills/ujverse-layout/SKILL.md).
- [Impeccable distill](https://github.com/pbakaus/impeccable/blob/c3bb418ee38ee49a6b999b7752c1368f3123a2bd/skill/reference/distill.md): remove redundant containers, repeated information and competing actions while keeping useful functionality. Adapted as [ujverse-simplify](../../.agents/skills/ujverse-simplify/SKILL.md).
- [Taste Skill](https://github.com/Leonxlnx/taste-skill/blob/9b4bf937a1f69348126959c15d2f99a73e65699b/skills/taste-skill/SKILL.md) was inspected. Its current workflow targets promotional company pages and prescribes viewport-sized sections, visual assets and a separate styling system. That is a poor fit for this student information application, so it was not installed.

The two selected workflows are project-specific manual adaptations, not an installation of the entire Impeccable CLI or detector. Their upstream Apache licence and notices are included. Existing [ujverse-ui](../../.agents/skills/ujverse-ui/SKILL.md) guidance now points to them. `PRODUCT.md` records known product truth; `DESIGN.md` records this spatial direction. No new runtime dependencies were added.

## Implemented composition

- An open two-column opening pairs the short page heading with Versuś. The assistant has a multiline question field, a text-labelled send action, actual public question shortcuts and a direct chat link. On phones the heading and assistant stack naturally.
- Announcements show two readable previews, with title, source, ingestion date and a short excerpt. The first has more emphasis. Complete results remain at `/komunikaty`.
- Registrations sit in one quiet area with two independent previews and truthful deadlines. Source links and unavailable/stale states are retained.
- Event dates act as visual anchors. Titles and sources remain real; no invented poster images or synthetic event times were added.
- University tools become simple links. The sidebar retains navigation and university services while removing the duplicate question menu and extra assistant frame.
- Full announcements, registration and event catalogues use open columns on desktop and one column on phones. Filters, pagination, calendar view, saved items and customization remain functional.

Desktop overview sections use 64 px separation; phones use 40 px. The page scrolls naturally. The original logo and theme definition files are unchanged. Layout styles now live in `src/styles/student-start.css`; obsolete compact-dashboard styles were removed from `campus.css`.

## Limits

This is an implemented design direction for review, not a claim of validated usability. No real-user study or response-speed measurement was performed. AI browser checks simulate SSE responses; real provider configuration is unchanged. No deployment or database changes were made.

The production build, 90 unit tests, 90 public-flow browser checks and 22 public AI browser checks pass. Dashboard, assistant, faculty selection and sidebar contrast were checked in the original themes. Public catalogue views and narrow-width reflow were inspected separately. The existing large-bundle warning remains.
