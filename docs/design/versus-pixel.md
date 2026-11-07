# Versuś pixel-art activities

The existing mascot is redrawn as an original 96×96 pixel-art creature, retaining its navy/cream/gold identity and small book. Shared 32-colour palette, binary alpha and nearest-neighbour rendering preserve a sharp sprite at different interface sizes. The main UJverse logo and themes are unchanged.

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
