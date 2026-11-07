# Versuś mascot

Original ink-drake character generated for UJverse. Navy, cream and gold; a friendly, alert university companion with a small book. It is not an existing Pokémon or the former owl.

- `idle.webp` / `idle.gif`: transparent, one four-second idle and blink cycle, 320×320.
- `face.webp` / `face.gif`: small-interface portrait, one four-second blink cycle, 160×160.
- `idle.png` / `face.png`: static reduced-motion fallback.

Both animations play once and stop on the neutral pose with open eyes. WebP uses loop count 1; GIF has no Netscape looping extension. The web component selects static PNG when `prefers-reduced-motion: reduce`, otherwise animated WebP with GIF fallback. Animation is intentionally quiet and does not use a second CSS/Framer wobble.
