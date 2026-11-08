# Versuś pixel mascot

Original simple hairless scholar companion with a book and clear round prescription glasses. Navy, cream and gold pixel-art sprites use a shared 24-colour palette. The smooth rounded character has no hair, fur, ears, horns or tail. Each sprite is 96×96 with binary transparency and no antialiasing. Upscale with `image-rendering: pixelated`.

States: `idle`, `greeting`, `listening`, `thinking`, `answering`, `success`, `error`. Every state includes `.webp`, `.gif`, and a meaningful static `.png` for reduced motion. Every state also has a `face-STATE` portrait; `face.*` aliases `face-idle.*`. A shared lower-edge mask keeps detached paws and book fragments out of the portrait crop.

Animations play one 3.6-second cycle and stop on a neutral pose with open eyes. WebP uses loop count 1; GIF has no Netscape looping extension. All poses share a fixed crop and limited palette. No additional CSS or Framer wobble is needed.
