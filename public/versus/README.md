# Versuś pixel mascot

Original navy, cream and gold ink-drake with a book, adapted into a shared 32-colour pixel-art sprite set. Each sprite is 96×96 with binary transparency and no antialiasing. Upscale with `image-rendering: pixelated`.

States: `idle`, `greeting`, `listening`, `thinking`, `answering`, `success`, `error`. Every state includes `.webp`, `.gif`, and a meaningful static `.png` for reduced motion. Every state also has a `face-STATE` portrait; `face.*` aliases `face-idle.*`. A shared lower-edge mask keeps detached paws and book fragments out of the portrait crop.

Animations play one 3.6-second cycle and stop on a neutral pose with open eyes. WebP uses loop count 1; GIF has no Netscape looping extension. All poses share a fixed crop and limited palette. No additional CSS or Framer wobble is needed.
