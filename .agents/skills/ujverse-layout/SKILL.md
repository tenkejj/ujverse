---
name: ujverse-layout
description: Restructure UJverse public pages with generous spacing, open sections and clear reading order. Use when the interface feels cramped, repetitive or dominated by boxes and lists.
---

# UJverse layout

Project adaptation of Impeccable's layout workflow. Read `../ujverse-ui/SKILL.md` for identity and product constraints. The user has selected Baltic Wheels as a composition reference, while retaining UJverse's existing logo, colours and system font.

## Diagnose before editing

Inspect the rendered desktop and phone page. Identify the first useful action, the next information group, and the visual weight of both. Record whether borders compensate for weak spacing, whether every region looks equally important, and what wraps at 390 px and 200% zoom.

## Spatial direction

- Start opens directly with the centred Versuś conversation entry, followed by procedural guides and the university information area. The user removed the introductory heading, programme picker and “Nie przegap” radar. Keep section customisation beside “Na uczelni” and preserve a restore action when all information sections are hidden.
- Use broad open sections and variable emphasis. Do not make all information fit above the fold.
- Give sections 56–80 px of desktop separation and 40–48 px on phones; use 16–24 px inside related groups. Use the 4 px spacing scale.
- Replace equal overview panels with an open announcement feature, a quieter registration area, typographic event dates and a small utility footer.
- Use real titles and excerpts. Never invent photographs, urgency, statistics or AI answers to decorate a composition.
- Keep filters, source links, saved items, customization and error states functional. Full catalogues can retain structured lists when needed for a task.
- Break the layout into one natural column on phones. Preserve DOM/focus order and 44 px targets.

## Verify

Inspect 390, 768, 1024 and 1440 px, all three original themes, long titles, failures and empty data. Check actual section gaps, field visibility, overflow, focus and contrast. A screenshot is evidence; a subjective claim of better UX is not a usability test.

## Source

Adapted from [Impeccable layout](https://github.com/pbakaus/impeccable/blob/c3bb418ee38ee49a6b999b7752c1368f3123a2bd/skill/reference/layout.md), Apache-2.0. This adaptation uses the manual assessment and browser verification; it does not install or invoke Impeccable's binary loader or detector. See `../ujverse-simplify/LICENSE.impeccable` for the upstream licence.
