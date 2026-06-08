import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Scraping UJ news/WZiKS/kalendarza działa teraz wyłącznie po stronie serwera
// (`api/scrape-uj-events.ts`, cron Vercela). Front czyta `public.official_events`
// z Supabase, więc proxy dla `wziks.uj.edu.pl` / `www.uj.edu.pl` w Vite jest
// zbędne — żadnych DNS lookupów po stronie deva, żadnych spamujących
// `getaddrinfo ENOTFOUND` w terminalu.

export default defineConfig({
  // Wymuszony root — gwarantuje, że Vite traktuje `./index.html` jako entry
  // HTML (a nie statyczny asset). Wcześniej była tu dyrektywa
  // `assetsInclude: ['**/*.html']`, która powodowała emisję `dist/index.html`
  // jako JS modułu `export default "<!doctype html>..."` — stąd „surowy
  // string zamiast strony" na Vercelu. Świadomie usunięta.
  root: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: './index.html',
    },
  },
  plugins: [react(), tailwindcss()],
})
