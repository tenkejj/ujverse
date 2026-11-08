# Versuś pixel mascot

Original sleek inkfin companion with angular muzzle, tall pointed ear fins and a book. Navy, cream and gold pixel-art sprites use a shared 24-colour palette. The navy silhouette has cream face markings, intelligent eyes and a slim curved tail with a gold tip. Each sprite is 96×96 with binary transparency and no antialiasing. Upscale with `image-rendering: pixelated`.

States: `idle`, `greeting`, `listening`, `thinking`, `answering`, `success`, `error`. Every state includes `.webp`, `.gif`, and a meaningful static `.png` for reduced motion. Every state also has a `face-STATE` portrait; `face.*` aliases `face-idle.*`. A fixed rectangular crop preserves the entire ear fins and angular muzzle; disconnected arm fragments are excluded.

Animations play one 3.6-second cycle and stop on a neutral pose with open eyes. WebP uses loop count 1; GIF has no Netscape looping extension. All poses share a fixed crop and limited palette. No additional CSS or Framer wobble is needed.
