import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Udawanie przeglądarki — mniejsza szansa blokady po stronie UJ/WZiKS. */
const CHROME_LIKE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const ALLOWED_INGEST_HOSTS = new Set(['www.uj.edu.pl', 'uj.edu.pl', 'wziks.uj.edu.pl'])

export default defineConfig({
  assetsInclude: ['**/*.html'],
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'ujverse-ingest-query-proxy',
      configureServer(server) {
        /** Dynamiczny target przez ?url= — rewrite jak w proxy (ścieżka API → pełny fetch docelowy). */
        server.middlewares.use(async (req, res, next) => {
          if (!req.url) {
            next()
            return
          }
          const ingestPath = new URL(req.url, 'http://localhost').pathname
          if (ingestPath !== '/api/ingest') {
            next()
            return
          }
          try {
            const urlObj = new URL(req.url, 'http://localhost')
            const target = urlObj.searchParams.get('url')
            if (!target) {
              res.statusCode = 400
              res.end('missing url')
              return
            }
            let u: URL
            try {
              u = new URL(target)
            } catch {
              res.statusCode = 400
              res.end('invalid url')
              return
            }
            if (u.protocol !== 'https:' && u.protocol !== 'http:') {
              res.statusCode = 400
              res.end('invalid protocol')
              return
            }
            if (!ALLOWED_INGEST_HOSTS.has(u.hostname)) {
              res.statusCode = 403
              res.end('host not allowed')
              return
            }
            const r = await fetch(target, {
              headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
                'User-Agent': CHROME_LIKE_UA,
              },
              redirect: 'follow',
            })
            const text = await r.text()
            res.statusCode = r.ok ? 200 : r.status
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(text)
          } catch (e) {
            console.warn('[vite ingest proxy]', e)
            res.statusCode = 502
            res.end('ingest proxy error')
          }
        })
      },
    },
  ],
  server: {
    proxy: {
      '/api/ingest-wziks': {
        target: 'https://wziks.uj.edu.pl',
        changeOrigin: true,
        rewrite: () => '/wiadomosci/aktualnosci',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', CHROME_LIKE_UA)
            proxyReq.setHeader('Accept-Language', 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7')
            proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
          })
        },
      },
      '/api/ingest-uj-wiadomosci': {
        target: 'https://www.uj.edu.pl',
        changeOrigin: true,
        rewrite: () => '/wiadomosci',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', CHROME_LIKE_UA)
            proxyReq.setHeader('Accept-Language', 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7')
            proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
          })
        },
      },
      '/api/ingest-uj-cal': {
        target: 'https://www.uj.edu.pl',
        changeOrigin: true,
        rewrite: () => '/wiadomosci/kalendarz',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', CHROME_LIKE_UA)
            proxyReq.setHeader('Accept-Language', 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7')
            proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
          })
        },
      },
    },
  },
})
