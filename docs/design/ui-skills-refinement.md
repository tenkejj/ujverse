# UI Skills refinement: assistant, faculty and footer

The user explicitly selected the UI Skills MCP app. Its tools were not exposed in this conversation: available tools, cloud/executor skill catalogues and plugin discovery did not supply the app. The implementation therefore uses the verified public UI Skills source files below. It does not claim a successful MCP invocation.

## Applied sources

- [interface-design](https://github.com/Dammyjay93/interface-design/blob/main/.claude/skills/interface-design/SKILL.md): preserve the product's identity, use existing semantic tokens, make the question field the primary task and distinguish the faculty dialog from its backdrop.
- [better-layout](https://github.com/jakubkrehel/skills/blob/main/skills/better-layout/SKILL.md): align common edges, keep related controls close and separate groups by larger spacing; do not manufacture whitespace with minimum heights.
- [better-ui](https://github.com/jakubkrehel/skills/blob/main/skills/better-ui/SKILL.md): respect the established design without decorative shadows, retain legible text and usable targets, and contain dialog scrolling.

The source files were selected from the current [UI Skills catalogue](https://www.ui-skills.com/). The actual files were read rather than relying on catalogue summaries.

## Implemented decisions

The assistant has one compact header: a 96 px pixel mascot, its name/action, a public-access label and one short explanation. A visible label, 16 px question text, distinct send button and grouped suggestions complete the form. The send action comes before secondary examples on phones. Public access, one-time conversation handoff, IME handling and keyboard submission are preserved.

The faculty trigger shows its label, current scope and a clear choice/change action. The dialog adds a labelled search by full name or abbreviation, handles Polish diacritics, retains an explicit all-university option and marks the active choice. Long names remain available through the trigger's title, accessible name and dialog. Focus, Escape, local preferences and the existing sticky-strip heights are preserved.

The footer groups external university services and UJverse tools into two named navigation groups. The full toolkit link stays beside the heading, account requirements are written out, and the project notice and real source/freshness details share one bottom area. Opening the sources keeps the trigger in the same place. Hiding tools leaves the source information available.

The original logo, fonts, three colour themes and all seven pixel-art activities are unchanged. This is an implementation review, not a usability study. No automated test suites are run, as requested by the user. Compilation and desktop/phone previews are used separately.

Previews: [desktop](previews/ui-refined-desktop.png), [phone](previews/ui-refined-mobile.png), [faculty search](previews/ui-refined-faculty.png).
