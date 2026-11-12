# Versuś pixel-art activities

The current mascot is an original slender 96×96 pixel-art creature with tall ear fins, an angular muzzle, intelligent eyes and a small book. It retains navy/cream/gold colours, a shared 24-colour palette, binary alpha and nearest-neighbour rendering. Full-body and portrait activities use the same public API. This revision replaces the rounded scholar and its round glasses; the main UJverse logo and themes remain unchanged.

| Activity  | Interface trigger                                             |
| --------- | ------------------------------------------------------------- |
| idle      | Resting assistant and navigation entry                        |
| greeting  | Empty conversation and greeting interaction                   |
| listening | Question field focus/composition                              |
| thinking  | Request started, before any response content                  |
| answering | First response content arrives; remains stable between chunks |
| success   | Non-empty response completed successfully                     |
| error     | Request failure or empty response                             |

Every state has full-body and face variants in WebP, GIF and PNG. Short animations play once. Both the system motion preference and UJverse's own motion setting select PNG, including live settings changes. A cancelled request returns to idle, and clearing the conversation or changing account resets the response phase. The thinking indicator disappears as streamed response content becomes visible.

The document and sidebar use restrained theme-aware scrollbars. Root gutters keep their stable layout and follow the app background; the sidebar keeps a transparent track. Wheel, touch and keyboard scrolling remain available.

No automated test suites are run for this visual iteration, as requested by the user. Compilation, code review and visual previews are used; preview conversation states are illustrative browser memory, not evidence of real model inference.

Conversation and header refinement: [Versuś refresh](versus-refresh.md).
