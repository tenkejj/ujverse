# UJverse: clear tasks for a first visit

Start explains the product immediately: university announcements, registration windows and events for students. Two independent surfaces group the primary tasks: **Zapytaj Versusia** and **Informacje z uczelni**. University services follow as a quiet, labelled utility group. Related copy, controls and feedback stay together; the page no longer relies on disconnected text strips.

The AI surface contains its purpose, public-access label, visible question label, growing textarea, explicit send action and three concrete examples. It opens the existing public conversation flow, preserving request delivery and authentication boundaries. The original main logo, system font and light/dark/UJ tokens remain unchanged. No decorative gradients or new palette are introduced.

Versuś is an original navy, cream and gold pixel-art creature with a book, drawn at 96×96 with a 32-colour palette. Seven distinct activities cover idle, greeting, composing, thinking, answering, completion and error. Full-body and face assets share `VersuMark`; nearest-neighbour rendering keeps pixels sharp. WebP is used on the site and GIF is available directly. Each activity plays once; both system and UJverse motion preferences select PNG. Real request phases drive thinking, answering and completion; cancellation never celebrates success. See [pixel mascot notes](docs/design/versus-pixel.md).

The information surface shows one category at a time with native `aria-pressed` filter buttons. The category stays in `?sekcja=`. Two previews lead to the full catalogue and original sources. Faculty preferences, hidden sections, saved items and independent loading, error, empty and stale states remain intact. The visibly labelled faculty selector stays in the sticky strip below the header.

Guidance selected from [Top Agent Skills](https://top-agent-skills.com/top-skills-for-frontend-design), checked against their actual source files:

- [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): intentional structure, coherent visual hierarchy and one distinctive detail within the existing identity.
- [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md) and [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md): meaningful labels, semantic controls, visible focus and reduced motion.

The catalogue's linked `design-critique` and `ux-copy` locations returned 404 during research, so they are not claimed as applied skills. The changes also received a read-only React component review. Automated test suites are intentionally not run for this visual iteration, as requested by the user. Compilation and screenshots are separate verification steps.
