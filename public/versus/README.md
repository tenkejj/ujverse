# Versuś pixel mascot

Original sleek inkfin companion with angular muzzle, tall pointed ear fins and a book. Navy, cream and gold pixel-art sprites use a shared 24-colour palette. The navy silhouette has cream face markings, intelligent eyes behind small rectangular gold prescription glasses and a slim curved tail with a gold tip. Each sprite is 96×96 with binary transparency and no antialiasing. Upscale with `image-rendering: pixelated`.

States: `idle`, `greeting`, `listening`, `thinking`, `answering`, `success`, `error`. Every state includes `.webp`, `.gif`, and a meaningful static `.png` for reduced motion. Every state also has a `face-STATE` portrait; `face.*` aliases `face-idle.*`. A fixed rectangular crop preserves the entire ear fins and angular muzzle; disconnected arm fragments are excluded.

Idle blinking, focused listening, thinking and answering loop only while their corresponding activity is mounted. Greeting, success and error play once and finish neutral. Answering cycles mouth shapes, gestures and a blink in3.6seconds. The UI uses static PNGs under system/app reducedmotion. Theme-specific zero-intercept linear palettes brighten the navy body in dark mode and shift it towards UJ blue without changing the alpha mask or pixel art.
